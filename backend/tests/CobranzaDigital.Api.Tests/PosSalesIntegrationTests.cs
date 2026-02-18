using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PosSalesIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public PosSalesIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }


    [Fact]
    public async Task OpenShift_WithStartingCashAmount_PersistsResponseDbAndAudit()
    {
        await CloseAnyOpenShiftAsync();

        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var openReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/open", token);
        openReq.Headers.Add("X-Correlation-Id", "corr-shift-open-starting-cash");
        openReq.Content = JsonContent.Create(new
        {
            startingCashAmount = 200m,
            notes = "Cambio para iniciar",
            clientOperationId = Guid.NewGuid()
        });

        using var openResp = await _client.SendAsync(openReq);
        var openedShift = await openResp.Content.ReadFromJsonAsync<PosShiftResponse>();

        Assert.Equal(HttpStatusCode.OK, openResp.StatusCode);
        Assert.NotNull(openedShift);
        Assert.Equal(200m, openedShift!.OpeningCashAmount);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var dbShift = await db.PosShifts.AsNoTracking().FirstAsync(x => x.Id == openedShift.Id);
        Assert.Equal(200m, dbShift.OpeningCashAmount);

        var audit = await db.AuditLogs.AsNoTracking()
            .Where(x => x.Action == "Open" && x.EntityType == "PosShift" && x.EntityId == openedShift.Id.ToString())
            .OrderByDescending(x => x.OccurredAtUtc)
            .FirstOrDefaultAsync();

        Assert.NotNull(audit);
        Assert.False(string.IsNullOrWhiteSpace(audit!.AfterJson));

        using var afterJson = JsonDocument.Parse(audit.AfterJson!);
        var openingCashFromAudit = afterJson.RootElement.GetProperty("openingCashAmount").GetDecimal();
        Assert.Equal(200m, openingCashFromAudit);
    }

    private async Task CloseAnyOpenShiftAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var openShifts = await db.PosShifts
            .Where(x => x.ClosedAtUtc == null)
            .ToListAsync();

        if (openShifts.Count == 0)
        {
            return;
        }

        var closedAt = DateTimeOffset.UtcNow;
        foreach (var shift in openShifts)
        {
            shift.ClosedAtUtc = closedAt;
            shift.ClosingCashAmount ??= shift.OpeningCashAmount;
            shift.CloseNotes ??= "Closed by integration test setup to guarantee isolation.";
        }

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task CloseShift_ComputesExpectedCountedAndDifference_FromCashDenominations()
    {
        await CloseAnyOpenShiftAsync();

        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var openReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/open", token);
        openReq.Content = JsonContent.Create(new
        {
            startingCashAmount = 100m,
            notes = "Turno para validar cierre",
            clientOperationId = Guid.NewGuid()
        });

        using var openResp = await _client.SendAsync(openReq);
        Assert.Equal(HttpStatusCode.OK, openResp.StatusCode);

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = "Cierre POS", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Americano", categoryId = category.Id, basePrice = 50m, isActive = true });

        await CreateSaleAsync(token, product.Id, quantity: 1, total: 50m);

        using var previewReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/close-preview", token);
        using var previewResp = await _client.SendAsync(previewReq);
        var preview = await previewResp.Content.ReadFromJsonAsync<ShiftClosePreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(100m, preview!.OpeningCashAmount);
        Assert.Equal(50m, preview.SalesCashTotal);
        Assert.Equal(150m, preview.ExpectedCashAmount);

        using var closeReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/close", token);
        closeReq.Content = JsonContent.Create(new
        {
            countedDenominations = new[]
            {
                new { denominationValue = 100m, count = 1 },
                new { denominationValue = 50m, count = 2 }
            },
            closingNotes = "Sin diferencias",
            clientOperationId = Guid.NewGuid()
        });

        using var closeResp = await _client.SendAsync(closeReq);
        var close = await closeResp.Content.ReadFromJsonAsync<CloseShiftResultResponse>();

        Assert.Equal(HttpStatusCode.OK, closeResp.StatusCode);
        Assert.NotNull(close);
        Assert.Equal(150m, close!.ExpectedCashAmount);
        Assert.Equal(200m, close.CountedCashAmount);
        Assert.Equal(50m, close.Difference);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var dbShift = await db.PosShifts.AsNoTracking().FirstAsync(x => x.Id == close.ShiftId);

        Assert.Equal(200m, dbShift.ClosingCashAmount);
        Assert.Equal(150m, dbShift.ExpectedCashAmount);
        Assert.Equal(50m, dbShift.CashDifference);
        Assert.False(string.IsNullOrWhiteSpace(dbShift.DenominationsJson));

        var audit = await db.AuditLogs.AsNoTracking()
            .Where(x => x.Action == "Close" && x.EntityType == "PosShift" && x.EntityId == close.ShiftId.ToString())
            .OrderByDescending(x => x.OccurredAtUtc)
            .FirstOrDefaultAsync();

        Assert.NotNull(audit);
        Assert.False(string.IsNullOrWhiteSpace(audit!.AfterJson));
    }

    [Fact]
    public async Task CreateSale_PersistsSnapshot_And_Audit()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = "Bebidas POS", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Latte", categoryId = category.Id, basePrice = 75m, isActive = true });
        var extra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "Leche extra", price = 10m, isActive = true });

        var clientSaleId = Guid.NewGuid();
        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        request.Headers.Add("X-Correlation-Id", "corr-pos-sale");
        request.Content = JsonContent.Create(new
        {
            clientSaleId,
            items = new[]
            {
                new
                {
                    productId = product.Id,
                    quantity = 2,
                    selections = Array.Empty<object>(),
                    extras = new[] { new { extraId = extra.Id, quantity = 2 } }
                }
            },
            payment = new { method = "Cash", amount = 170m, reference = "CASH-001" }
        });

        using var response = await _client.SendAsync(request);
        var sale = await response.Content.ReadFromJsonAsync<CreateSaleResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(sale);
        Assert.Equal(170m, sale!.Total);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var saleItem = await db.SaleItems.AsNoTracking().FirstAsync(x => x.SaleId == sale.SaleId);
        Assert.Equal("Latte", saleItem.ProductNameSnapshot);
        Assert.Equal(75m, saleItem.UnitPriceSnapshot);

        var payment = await db.Payments.AsNoTracking().FirstAsync(x => x.SaleId == sale.SaleId);
        Assert.Null(payment.Reference);

        var audits = await db.AuditLogs.AsNoTracking()
            .Where(x => x.EntityType == "Sale" && x.EntityId == sale.SaleId.ToString())
            .ToListAsync();
        var audit = audits.OrderByDescending(x => x.OccurredAtUtc).FirstOrDefault();

        Assert.NotNull(audit);
        Assert.Equal("Create", audit!.Action);
        Assert.Equal("corr-pos-sale", audit.CorrelationId);
    }

    [Fact]
    public async Task CreateSale_WithCardPaymentAndReference_ReturnsOk()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"Bebidas-{Guid.NewGuid():N}", sortOrder = 3, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Cappuccino", categoryId = category.Id, basePrice = 80m, isActive = true });

        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        request.Content = JsonContent.Create(new
        {
            clientSaleId = Guid.NewGuid(),
            items = new[]
            {
                new
                {
                    productId = product.Id,
                    quantity = 1,
                    selections = Array.Empty<object>(),
                    extras = Array.Empty<object>()
                }
            },
            payment = new { method = "Card", amount = 80m, reference = "AUTH-123" }
        });

        using var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("request field is required", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Reports_DailySummary_And_TopProducts_Work()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"Comidas-{Guid.NewGuid():N}", sortOrder = 2, isActive = true });
        var productA = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Taco Pastor", categoryId = category.Id, basePrice = 30m, isActive = true });
        var productB = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Taco Bistec", categoryId = category.Id, basePrice = 35m, isActive = true });

        await CreateSaleAsync(token, productA.Id, quantity: 2, total: 60m);
        await CreateSaleAsync(token, productB.Id, quantity: 1, total: 35m);

        var mexicoTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, mexicoTimeZone).DateTime);

        using var dailyReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/daily-summary?date={today:yyyy-MM-dd}", token);
        using var dailyResp = await _client.SendAsync(dailyReq);
        var daily = await dailyResp.Content.ReadFromJsonAsync<DailySummaryResponse>();

        Assert.Equal(HttpStatusCode.OK, dailyResp.StatusCode);
        Assert.NotNull(daily);
        Assert.True(daily!.TotalTickets >= 2);
        Assert.True(daily.TotalAmount >= 95m);

        using var topReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/top-products?dateFrom={today:yyyy-MM-dd}&dateTo={today:yyyy-MM-dd}&top=5", token);
        using var topResp = await _client.SendAsync(topReq);
        var top = await topResp.Content.ReadFromJsonAsync<List<TopProductResponse>>();

        Assert.Equal(HttpStatusCode.OK, topResp.StatusCode);
        Assert.NotNull(top);
        Assert.Contains(top!, x => x.ProductId == productA.Id);
        Assert.Contains(top!, x => x.ProductId == productB.Id);
    }

    [Fact]
    public async Task CreateSale_WithMixedPayments_Works_And_ClosePreview_UsesCashPortionOnly()
    {
        await CloseAnyOpenShiftAsync();
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local", initialCash: 100m);

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"Bebidas-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Latte", categoryId = category.Id, basePrice = 120m, isActive = true });

        using var saleReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        saleReq.Content = JsonContent.Create(new
        {
            clientSaleId = Guid.NewGuid(),
            items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } },
            payments = new[]
            {
                new { method = "Cash", amount = 20m, reference = (string?)null },
                new { method = "Card", amount = 100m, reference = (string?)"MIXED-001" }
            }
        });

        using var saleResp = await _client.SendAsync(saleReq);
        Assert.Equal(HttpStatusCode.OK, saleResp.StatusCode);

        using var previewReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/close-preview", token);
        using var previewResp = await _client.SendAsync(previewReq);
        var preview = await previewResp.Content.ReadFromJsonAsync<ShiftClosePreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(20m, preview!.SalesCashTotal);
        Assert.Equal(120m, preview.ExpectedCashAmount);
    }

    [Fact]
    public async Task VoidSale_ExcludesSaleFromClosePreview()
    {
        await CloseAnyOpenShiftAsync();
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local", initialCash: 0m);

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"Void-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Mocha", categoryId = category.Id, basePrice = 90m, isActive = true });

        var saleId = Guid.NewGuid();
        using (var saleReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token))
        {
            saleReq.Content = JsonContent.Create(new
            {
                clientSaleId = saleId,
                items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } },
                payment = new { method = "Cash", amount = 90m }
            });
            using var saleResp = await _client.SendAsync(saleReq);
            Assert.Equal(HttpStatusCode.OK, saleResp.StatusCode);
            var payload = await saleResp.Content.ReadFromJsonAsync<CreateSaleResponse>();
            saleId = payload!.SaleId;
        }

        using (var voidReq = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{saleId}/void", token))
        {
            voidReq.Content = JsonContent.Create(new { reasonCode = "CashierError", reasonText = "captura", note = "test", clientVoidId = Guid.NewGuid() });
            using var voidResp = await _client.SendAsync(voidReq);
            Assert.Equal(HttpStatusCode.OK, voidResp.StatusCode);
        }

        using var previewReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/close-preview", token);
        using var previewResp = await _client.SendAsync(previewReq);
        var preview = await previewResp.Content.ReadFromJsonAsync<ShiftClosePreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(0m, preview!.SalesCashTotal);
    }

    [Fact]
    public async Task CreateSale_ReturnsConflict_When_Product_NotAvailable()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"prod-unavail-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "No Latte", categoryId = category.Id, basePrice = 70m, isActive = true, isAvailable = false });

        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        request.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 70m } });
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<JsonObject>();

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("Product", payload!["itemType"]!.GetValue<string>());
    }

    [Fact]
    public async Task CreateSale_ReturnsConflict_When_Extra_Or_Option_NotAvailable_And_Validation400_For_MissingIds()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var optionSet = await PostAsync<OptionSetResponse>("/api/v1/pos/admin/option-sets", token, new { name = $"opt-{Guid.NewGuid():N}", isActive = true });
        var optionItem = await PostAsync<OptionItemResponse>($"/api/v1/pos/admin/option-sets/{optionSet.Id}/items", token, new { name = "No topping", isActive = true, isAvailable = false, sortOrder = 1 });
        var extra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "No whip", price = 5m, isActive = true, isAvailable = false });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Cocoa", categoryId = category.Id, basePrice = 80m, isActive = true, isAvailable = true });

        using var optionRequest = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        optionRequest.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 1, selections = new[] { new { groupKey = "x", optionItemId = optionItem.Id } }, extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 80m } });
        using var optionResponse = await _client.SendAsync(optionRequest);
        Assert.Equal(HttpStatusCode.Conflict, optionResponse.StatusCode);

        using var extraRequest = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        extraRequest.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = new[] { new { extraId = extra.Id, quantity = 1 } } } }, payment = new { method = "Cash", amount = 85m } });
        using var extraResponse = await _client.SendAsync(extraRequest);
        Assert.Equal(HttpStatusCode.Conflict, extraResponse.StatusCode);

        using var invalidIdsRequest = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        invalidIdsRequest.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = Guid.NewGuid(), quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 1m } });
        using var invalidIdsResponse = await _client.SendAsync(invalidIdsRequest);
        Assert.Equal(HttpStatusCode.BadRequest, invalidIdsResponse.StatusCode);
    }

    [Fact]
    public async Task VoidSale_IsIdempotent_ByClientVoidId()
    {
        await CloseAnyOpenShiftAsync();
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local", initialCash: 0m);

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"VoidIdem-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Flat White", categoryId = category.Id, basePrice = 70m, isActive = true });

        using var saleReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        saleReq.Content = JsonContent.Create(new
        {
            clientSaleId = Guid.NewGuid(),
            items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } },
            payment = new { method = "Cash", amount = 70m }
        });
        using var saleResp = await _client.SendAsync(saleReq);
        var created = await saleResp.Content.ReadFromJsonAsync<CreateSaleResponse>();
        Assert.Equal(HttpStatusCode.OK, saleResp.StatusCode);

        var clientVoidId = Guid.NewGuid();
        var body = new { reasonCode = "CashierError", reasonText = "error", note = "idempotent", clientVoidId };

        using var voidReq1 = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{created!.SaleId}/void", token);
        voidReq1.Content = JsonContent.Create(body);
        using var voidResp1 = await _client.SendAsync(voidReq1);
        Assert.Equal(HttpStatusCode.OK, voidResp1.StatusCode);

        using var voidReq2 = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{created.SaleId}/void", token);
        voidReq2.Content = JsonContent.Create(body);
        using var voidResp2 = await _client.SendAsync(voidReq2);
        Assert.Equal(HttpStatusCode.OK, voidResp2.StatusCode);
    }

    private async Task CreateSaleAsync(string token, Guid productId, int quantity, decimal total)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        req.Content = JsonContent.Create(new
        {
            clientSaleId = Guid.NewGuid(),
            items = new[] { new { productId, quantity, selections = Array.Empty<object>(), extras = Array.Empty<object>() } },
            payment = new { method = "Cash", amount = total }
        });

        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    private async Task<T> PostAsync<T>(string url, string token, object body)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, url, token);
        req.Content = JsonContent.Create(body);
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        return (await resp.Content.ReadFromJsonAsync<T>())!;
    }

    private async Task EnsureOpenShiftAsync(string token, string cashierEmail, decimal initialCash = 500m)
    {
        using var currentReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/current", token);
        using var currentResp = await _client.SendAsync(currentReq);
        if (currentResp.StatusCode == HttpStatusCode.OK)
        {
            var current = await currentResp.Content.ReadFromJsonAsync<PosShiftResponse>();
            Assert.NotNull(current);
            return;
        }

        Assert.Equal(HttpStatusCode.NoContent, currentResp.StatusCode);

        using var openReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/open", token);
        openReq.Content = JsonContent.Create(new
        {
            startingCashAmount = initialCash,
            notes = $"Opened by {cashierEmail} for integration test",
            clientOperationId = Guid.NewGuid()
        });

        using var openResp = await _client.SendAsync(openReq);
        Assert.Contains(openResp.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Created });

        var openedShift = await openResp.Content.ReadFromJsonAsync<PosShiftResponse>();
        Assert.NotNull(openedShift);
        Assert.Equal(initialCash, openedShift!.OpeningCashAmount);

        using var verifyReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/current", token);
        using var verifyResp = await _client.SendAsync(verifyReq);
        Assert.Equal(HttpStatusCode.OK, verifyResp.StatusCode);
        var verifiedShift = await verifyResp.Content.ReadFromJsonAsync<PosShiftResponse>();
        Assert.NotNull(verifiedShift);
        Assert.Equal(initialCash, verifiedShift!.OpeningCashAmount);
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record CategoryResponse(Guid Id, string Name, int SortOrder, bool IsActive);
    private sealed record ProductResponse(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, bool IsAvailable, Guid? CustomizationSchemaId);
    private sealed record ExtraResponse(Guid Id, string Name, decimal Price, bool IsActive, bool IsAvailable);
    private sealed record OptionSetResponse(Guid Id, string Name, bool IsActive);
    private sealed record OptionItemResponse(Guid Id, Guid OptionSetId, string Name, bool IsActive, bool IsAvailable, int SortOrder);
    private sealed record CreateSaleResponse(Guid SaleId, string Folio, DateTimeOffset OccurredAtUtc, decimal Total);
    private sealed record PosShiftResponse(Guid Id, DateTimeOffset OpenedAtUtc, DateTimeOffset? ClosedAtUtc, decimal OpeningCashAmount, decimal? ClosingCashAmount, string? Notes, Guid StoreId);
    private sealed record ShiftClosePreviewResponse(Guid ShiftId, DateTimeOffset OpenedAtUtc, decimal OpeningCashAmount, decimal SalesCashTotal, decimal ExpectedCashAmount, decimal? CountedCashAmount, decimal? Difference);
    private sealed record CloseShiftResultResponse(Guid ShiftId, DateTimeOffset OpenedAtUtc, DateTimeOffset ClosedAtUtc, decimal OpeningCashAmount, decimal SalesCashTotal, decimal ExpectedCashAmount, decimal CountedCashAmount, decimal Difference, string? CloseNotes, string? CloseReason);
    private sealed record DailySummaryResponse(DateOnly Date, int TotalTickets, decimal TotalAmount, int TotalItems, decimal AvgTicket);
    private sealed record TopProductResponse(Guid ProductId, string ProductNameSnapshot, int Qty, decimal Amount);
}
