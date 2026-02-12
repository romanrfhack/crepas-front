using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
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

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

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
    private sealed record ProductResponse(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, Guid? CustomizationSchemaId);
    private sealed record ExtraResponse(Guid Id, string Name, decimal Price, bool IsActive);
    private sealed record CreateSaleResponse(Guid SaleId, string Folio, DateTimeOffset OccurredAtUtc, decimal Total);
    private sealed record PosShiftResponse(Guid Id, DateTimeOffset OpenedAtUtc, DateTimeOffset? ClosedAtUtc, decimal OpeningCashAmount, decimal? ClosingCashAmount, string? Notes);
    private sealed record DailySummaryResponse(DateOnly Date, int TotalTickets, decimal TotalAmount, int TotalItems, decimal AvgTicket);
    private sealed record TopProductResponse(Guid ProductId, string ProductNameSnapshot, int Qty, decimal Amount);
}
