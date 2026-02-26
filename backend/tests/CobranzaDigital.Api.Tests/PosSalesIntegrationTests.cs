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
        await UpdateInventorySettingsAsync(token, false);

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
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Americano", categoryId = category.Id, basePrice = 50m, isActive = true, isInventoryTracked = false });

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
    public async Task CreateSale_Returns_OutOfStock_When_ShowOnlyInStock_Enabled_And_InsufficientInventory()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"stock-sales-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stock one", categoryId = category.Id, basePrice = 70m, isActive = true, isAvailable = true });
        var snapshot = await GetSnapshotAsync(token);

        await UpdateInventorySettingsAsync(token, true);
        await UpsertInventoryAsync(token, snapshot.StoreId, product.Id, 1m);

        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        request.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 2, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 140m } });
        using var response = await _client.SendAsync(request);

        var payload = await response.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("OutOfStock", payload!["reason"]!.GetValue<string>());
        Assert.Equal(1m, payload["availableQty"]!.GetValue<decimal>());
    }

    [Fact]
    public async Task CreateSale_Concurrent_LastUnit_Allows_One_And_Rejects_Other_When_ShowOnlyInStock_Enabled()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"stock-concurrency-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stock race", categoryId = category.Id, basePrice = 45m, isActive = true, isAvailable = true });
        var snapshot = await GetSnapshotAsync(token);

        await UpdateInventorySettingsAsync(token, true);
        await UpsertInventoryAsync(token, snapshot.StoreId, product.Id, 1m);

        var t1 = SendCreateSaleAsync(token, product.Id, 1, 45m);
        var t2 = SendCreateSaleAsync(token, product.Id, 1, 45m);
        var responses = await Task.WhenAll(t1, t2);

        Assert.Equal(1, responses.Count(x => x == HttpStatusCode.OK));
        Assert.Equal(1, responses.Count(x => x == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task CreateSale_Allows_StockZero_When_ShowOnlyInStock_Disabled()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"stock-off-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stock disabled", categoryId = category.Id, basePrice = 20m, isActive = true, isAvailable = true });
        var snapshot = await GetSnapshotAsync(token);

        await UpdateInventorySettingsAsync(token, false);
        await UpsertInventoryAsync(token, snapshot.StoreId, product.Id, 0m);

        await CreateSaleAsync(token, product.Id, 1, 20m);
    }

    [Fact]
    public async Task CreateSale_ReturnsConflict_WithStableItemUnavailablePayload_When_Product_NotAvailable()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"prod-unavail-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "No Latte", categoryId = category.Id, basePrice = 70m, isActive = true, isAvailable = true });

        using (var disableReq = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/overrides", token))
        {
            disableReq.Content = JsonContent.Create(new { itemType = "Product", itemId = product.Id, isEnabled = false });
            using var disableResp = await _client.SendAsync(disableReq);
            Assert.Equal(HttpStatusCode.OK, disableResp.StatusCode);
        }

        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        request.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 70m } });
        using var response = await _client.SendAsync(request);

        await AssertItemUnavailableResponseAsync(response, "Product", product.Id, product.Name, "DisabledByTenant");
    }

    [Fact]
    public async Task CreateSale_ReturnsConflict_WithStableItemUnavailablePayload_When_OptionItem_NotAvailable()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var optionSet = await PostAsync<OptionSetResponse>("/api/v1/pos/admin/option-sets", token, new { name = $"opt-{Guid.NewGuid():N}", isActive = true });
        var optionItem = await PostAsync<OptionItemResponse>($"/api/v1/pos/admin/option-sets/{optionSet.Id}/items", token, new { name = "No topping", isActive = true, isAvailable = false, sortOrder = 1 });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Cocoa", categoryId = category.Id, basePrice = 80m, isActive = true, isAvailable = true });

        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        request.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 1, selections = new[] { new { groupKey = "x", optionItemId = optionItem.Id } }, extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 80m } });
        using var response = await _client.SendAsync(request);

        await AssertItemUnavailableResponseAsync(response, "OptionItem", optionItem.Id, optionItem.Name, "ManualUnavailable");
    }

    [Fact]
    public async Task CreateSale_ReturnsConflict_WithStableItemUnavailablePayload_When_Extra_NotAvailable_And_Validation400_For_MissingIds()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var extra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "No whip", price = 5m, isActive = true, isAvailable = false });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Cocoa", categoryId = category.Id, basePrice = 80m, isActive = true, isAvailable = true });

        using var extraRequest = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        extraRequest.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = new[] { new { extraId = extra.Id, quantity = 1 } } } }, payment = new { method = "Cash", amount = 85m } });
        using var extraResponse = await _client.SendAsync(extraRequest);
        await AssertItemUnavailableResponseAsync(extraResponse, "Extra", extra.Id, extra.Name, "ManualUnavailable");

        using var invalidIdsRequest = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        invalidIdsRequest.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = Guid.NewGuid(), quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 1m } });
        using var invalidIdsResponse = await _client.SendAsync(invalidIdsRequest);
        Assert.Equal(HttpStatusCode.BadRequest, invalidIdsResponse.StatusCode);
    }

    [Fact]
    public async Task CreateSale_Returns_DisabledByStore_And_ManualUnavailable_Reasons()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"store-reason-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var pStore = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Store disabled", categoryId = category.Id, basePrice = 70m, isActive = true, isAvailable = true });
        var pManual = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Manual unavailable", categoryId = category.Id, basePrice = 75m, isActive = true, isAvailable = false });
        var snapshot = await GetSnapshotAsync(token);

        using (var putOverride = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/store-overrides", token))
        {
            putOverride.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = pStore.Id, state = "Disabled" });
            using var overrideResp = await _client.SendAsync(putOverride);
            Assert.Equal(HttpStatusCode.OK, overrideResp.StatusCode);
        }

        using var disabledReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        disabledReq.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = pStore.Id, quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 70m } });
        using var disabledResp = await _client.SendAsync(disabledReq);
        await AssertItemUnavailableResponseAsync(disabledResp, "Product", pStore.Id, pStore.Name, "DisabledByStore");

        using var manualReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        manualReq.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = pManual.Id, quantity = 1, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 75m } });
        using var manualResp = await _client.SendAsync(manualReq);
        await AssertItemUnavailableResponseAsync(manualResp, "Product", pManual.Id, pManual.Name, "ManualUnavailable");
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


    [Fact]
    public async Task CreateSale_Consumes_Tracked_Product_And_Writes_Adjustment()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"InvP-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Tracked Product", categoryId = category.Id, basePrice = 20m, isActive = true, isInventoryTracked = true });

        var storeId = await GetDefaultStoreIdAsync();
        await AdjustCatalogInventoryAsync(token, storeId, "Product", product.Id, 5m, "InitialLoad");

        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        req.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 2, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 40m } });
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var stock = await GetCatalogStockAsync(storeId, "Product", product.Id);
        Assert.Equal(3m, stock);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var adj = await db.CatalogInventoryAdjustments.AsNoTracking().FirstOrDefaultAsync(x => x.StoreId == storeId && x.ItemType.ToString() == "Product" && x.ItemId == product.Id && x.Reason == "SaleConsumption");
        Assert.NotNull(adj);
        Assert.Equal(-2m, adj!.DeltaQty);
    }

    [Fact]
    public async Task CreateSale_Consumes_Tracked_Extra_And_Void_Reverses_With_Idempotency()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"InvE-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Tracked Base", categoryId = category.Id, basePrice = 15m, isActive = true, isInventoryTracked = true });
        var extra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "Tracked Extra", price = 5m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var storeId = await GetDefaultStoreIdAsync();
        await AdjustCatalogInventoryAsync(token, storeId, "Product", product.Id, 5m, "InitialLoad");
        await AdjustCatalogInventoryAsync(token, storeId, "Extra", extra.Id, 10m, "InitialLoad");

        var clientSaleId = Guid.NewGuid();
        using var saleReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        saleReq.Content = JsonContent.Create(new { clientSaleId, items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = new[] { new { extraId = extra.Id, quantity = 3 } } } }, payment = new { method = "Cash", amount = 30m } });
        using var saleResp = await _client.SendAsync(saleReq);
        var sale = await saleResp.Content.ReadFromJsonAsync<CreateSaleResponse>();
        Assert.Equal(HttpStatusCode.OK, saleResp.StatusCode);

        Assert.Equal(7m, await GetCatalogStockAsync(storeId, "Extra", extra.Id));

        using var saleRetryReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        saleRetryReq.Content = JsonContent.Create(new { clientSaleId, items = new[] { new { productId = product.Id, quantity = 1, selections = Array.Empty<object>(), extras = new[] { new { extraId = extra.Id, quantity = 3 } } } }, payment = new { method = "Cash", amount = 30m } });
        using var saleRetryResp = await _client.SendAsync(saleRetryReq);
        Assert.Equal(HttpStatusCode.OK, saleRetryResp.StatusCode);
        Assert.Equal(7m, await GetCatalogStockAsync(storeId, "Extra", extra.Id));

        var clientVoidId = Guid.NewGuid();
        using var voidReq = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{sale!.SaleId}/void", token);
        voidReq.Content = JsonContent.Create(new { reasonCode = "CashierError", note = "void", clientVoidId });
        using var voidResp = await _client.SendAsync(voidReq);
        Assert.Equal(HttpStatusCode.OK, voidResp.StatusCode);

        Assert.Equal(10m, await GetCatalogStockAsync(storeId, "Extra", extra.Id));

        using var voidRetryReq = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{sale.SaleId}/void", token);
        voidRetryReq.Content = JsonContent.Create(new { reasonCode = "CashierError", note = "void", clientVoidId });
        using var voidRetryResp = await _client.SendAsync(voidRetryReq);
        Assert.Equal(HttpStatusCode.OK, voidRetryResp.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var voidRows = await db.CatalogInventoryAdjustments.AsNoTracking().CountAsync(x => x.StoreId == storeId && x.ItemType.ToString() == "Extra" && x.ItemId == extra.Id && x.Reason == "VoidReversal" && x.ReferenceId == sale.SaleId.ToString());
        Assert.Equal(1, voidRows);
    }

    [Fact]
    public async Task CreateSale_Prevents_Negative_Stock_And_Does_Not_Create_Adjustments()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await EnsureOpenShiftAsync(token, "admin@test.local");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"InvN-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Tracked Low", categoryId = category.Id, basePrice = 10m, isActive = true, isInventoryTracked = true });
        var storeId = await GetDefaultStoreIdAsync();
        await AdjustCatalogInventoryAsync(token, storeId, "Product", product.Id, 1m, "InitialLoad");

        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        req.Content = JsonContent.Create(new { clientSaleId = Guid.NewGuid(), items = new[] { new { productId = product.Id, quantity = 2, selections = Array.Empty<object>(), extras = Array.Empty<object>() } }, payment = new { method = "Cash", amount = 20m } });
        using var resp = await _client.SendAsync(req);
        var problem = await resp.Content.ReadFromJsonAsync<JsonObject>();

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        Assert.Equal("OutOfStock", problem!["reason"]!.GetValue<string>());
        Assert.Equal(1m, await GetCatalogStockAsync(storeId, "Product", product.Id));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var saleAdjustments = await db.CatalogInventoryAdjustments.AsNoTracking().CountAsync(x => x.StoreId == storeId && x.ItemId == product.Id && x.Reason == "SaleConsumption");
        Assert.Equal(0, saleAdjustments);
    }

    private async Task<HttpStatusCode> SendCreateSaleAsync(string token, Guid productId, int quantity, decimal total)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        req.Content = JsonContent.Create(new
        {
            clientSaleId = Guid.NewGuid(),
            items = new[] { new { productId, quantity, selections = Array.Empty<object>(), extras = Array.Empty<object>() } },
            payment = new { method = "Cash", amount = total }
        });

        using var resp = await _client.SendAsync(req);
        return resp.StatusCode;
    }

    private async Task UpdateInventorySettingsAsync(string token, bool showOnlyInStock)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/inventory/settings", token);
        req.Content = JsonContent.Create(new { showOnlyInStock });
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    private async Task UpsertInventoryAsync(string token, Guid storeId, Guid productId, decimal onHand)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token);
        req.Content = JsonContent.Create(new { storeId, itemType = "Product", itemId = productId, onHandQty = onHand, reason = "TestSeed" });
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }


    private async Task AdjustCatalogInventoryAsync(string token, Guid storeId, string itemType, Guid itemId, decimal quantityDelta, string reason)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token);
        req.Content = JsonContent.Create(new { storeId, itemType, itemId, quantityDelta, reason });
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    private async Task<decimal> GetCatalogStockAsync(Guid storeId, string itemType, Guid itemId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var parsed = Enum.Parse<CobranzaDigital.Domain.Entities.CatalogItemType>(itemType, true);
        var row = await db.CatalogInventoryBalances.AsNoTracking().FirstOrDefaultAsync(x => x.StoreId == storeId && x.ItemType == parsed && x.ItemId == itemId);
        return row?.OnHandQty ?? 0m;
    }

    private async Task<SnapshotResponse> GetSnapshotAsync(string token)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", token);
        using var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SnapshotResponse>())!;
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

    private static async Task AssertItemUnavailableResponseAsync(HttpResponseMessage response, string expectedItemType, Guid expectedItemId, string expectedItemName, string expectedReason = "UnavailableInStore")
    {
        var payload = await response.Content.ReadFromJsonAsync<JsonObject>();

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal("Conflict", payload!["title"]!.GetValue<string>());
        Assert.Equal(expectedItemType, payload["itemType"]!.GetValue<string>());
        Assert.Equal(expectedItemId.ToString("D"), payload["itemId"]!.GetValue<string>());
        Assert.Equal(expectedItemName, payload["itemName"]!.GetValue<string>());
        Assert.Equal(expectedReason, payload["reason"]!.GetValue<string>());
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
        await UpdateInventorySettingsAsync(token, false);

        var defaultStoreId = await GetDefaultStoreIdAsync();

        using var currentReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/current", token);
        using var currentResp = await _client.SendAsync(currentReq);
        if (currentResp.StatusCode == HttpStatusCode.OK)
        {
            var current = await currentResp.Content.ReadFromJsonAsync<PosShiftResponse>();
            Assert.NotNull(current);
            if (current!.StoreId == defaultStoreId)
            {
                return;
            }

            using var closeReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/close", token);
            closeReq.Content = JsonContent.Create(new
            {
                shiftId = current.Id,
                countedDenominations = new[] { new { denominationValue = 500m, count = 1 } },
                closeReason = "switch-store",
                clientOperationId = Guid.NewGuid(),
                storeId = current.StoreId
            });
            using var closeResp = await _client.SendAsync(closeReq);
            Assert.Equal(HttpStatusCode.OK, closeResp.StatusCode);
        }
        else
        {
            Assert.Equal(HttpStatusCode.NoContent, currentResp.StatusCode);
        }

        using var openReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/open", token);
        openReq.Content = JsonContent.Create(new
        {
            startingCashAmount = initialCash,
            notes = $"Opened by {cashierEmail} for integration test",
            clientOperationId = Guid.NewGuid(),
            storeId = defaultStoreId
        });

        using var openResp = await _client.SendAsync(openReq);
        Assert.Contains(openResp.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Created });

        var openedShift = await openResp.Content.ReadFromJsonAsync<PosShiftResponse>();
        Assert.NotNull(openedShift);
        Assert.Equal(initialCash, openedShift!.OpeningCashAmount);
        Assert.Equal(defaultStoreId, openedShift.StoreId);

        using var verifyReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/current", token);
        using var verifyResp = await _client.SendAsync(verifyReq);
        Assert.Equal(HttpStatusCode.OK, verifyResp.StatusCode);
        var verifiedShift = await verifyResp.Content.ReadFromJsonAsync<PosShiftResponse>();
        Assert.NotNull(verifiedShift);
        Assert.Equal(initialCash, verifiedShift!.OpeningCashAmount);
        Assert.Equal(defaultStoreId, verifiedShift.StoreId);
    }

    private async Task<Guid> GetDefaultStoreIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        return await db.PosSettings.AsNoTracking().OrderBy(x => x.Id).Select(x => x.DefaultStoreId).FirstAsync();
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
    private sealed record ProductResponse(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, bool IsAvailable, Guid? CustomizationSchemaId, bool? IsInventoryTracked = null);
    private sealed record ExtraResponse(Guid Id, string Name, decimal Price, bool IsActive, bool IsAvailable, bool? IsInventoryTracked = null);
    private sealed record OptionSetResponse(Guid Id, string Name, bool IsActive);
    private sealed record OptionItemResponse(Guid Id, Guid OptionSetId, string Name, bool IsActive, bool IsAvailable, int SortOrder);
    private sealed record CreateSaleResponse(Guid SaleId, string Folio, DateTimeOffset OccurredAtUtc, decimal Total);
    private sealed record PosShiftResponse(Guid Id, DateTimeOffset OpenedAtUtc, DateTimeOffset? ClosedAtUtc, decimal OpeningCashAmount, decimal? ClosingCashAmount, string? Notes, Guid StoreId);
    private sealed record SnapshotResponse(Guid TenantId, Guid VerticalId, Guid CatalogTemplateId, Guid StoreId, string TimeZoneId, DateTimeOffset GeneratedAtUtc, string CatalogVersion, string EtagSeed, List<ProductResponse> Products, List<SnapshotOverride> Overrides, string VersionStamp);
    private sealed record SnapshotOverride(Guid Id, Guid ProductId, string GroupKey, bool IsActive, List<Guid> AllowedOptionItemIds);

    private sealed record ShiftClosePreviewResponse(Guid ShiftId, DateTimeOffset OpenedAtUtc, decimal OpeningCashAmount, decimal SalesCashTotal, decimal ExpectedCashAmount, decimal? CountedCashAmount, decimal? Difference);
    private sealed record CloseShiftResultResponse(Guid ShiftId, DateTimeOffset OpenedAtUtc, DateTimeOffset ClosedAtUtc, decimal OpeningCashAmount, decimal SalesCashTotal, decimal ExpectedCashAmount, decimal CountedCashAmount, decimal Difference, string? CloseNotes, string? CloseReason);
    private sealed record DailySummaryResponse(DateOnly Date, int TotalTickets, decimal TotalAmount, int TotalItems, decimal AvgTicket);
    private sealed record TopProductResponse(Guid ProductId, string ProductNameSnapshot, int Qty, decimal Amount);
}
