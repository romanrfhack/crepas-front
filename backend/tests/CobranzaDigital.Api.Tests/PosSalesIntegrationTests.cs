using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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
    public async Task CreateSale_PersistsSnapshot_And_Audit()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!").ConfigureAwait(false);

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
            payment = new { method = 0, amount = 170m, reference = "CASH-001" }
        });

        using var response = await _client.SendAsync(request).ConfigureAwait(false);
        var sale = await response.Content.ReadFromJsonAsync<CreateSaleResponse>().ConfigureAwait(false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(sale);
        Assert.Equal(170m, sale!.Total);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var saleItem = await db.SaleItems.AsNoTracking().FirstAsync(x => x.SaleId == sale.SaleId).ConfigureAwait(false);
        Assert.Equal("Latte", saleItem.ProductNameSnapshot);
        Assert.Equal(75m, saleItem.UnitPriceSnapshot);

        var audits = await db.AuditLogs.AsNoTracking()
            .Where(x => x.EntityType == "Sale" && x.EntityId == sale.SaleId.ToString())
            .ToListAsync().ConfigureAwait(false);
        var audit = audits.OrderByDescending(x => x.OccurredAtUtc).FirstOrDefault();

        Assert.NotNull(audit);
        Assert.Equal("Create", audit!.Action);
        Assert.Equal("corr-pos-sale", audit.CorrelationId);
    }

    [Fact]
    public async Task Reports_DailySummary_And_TopProducts_Work()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!").ConfigureAwait(false);

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"Comidas-{Guid.NewGuid():N}", sortOrder = 2, isActive = true });
        var productA = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Taco Pastor", categoryId = category.Id, basePrice = 30m, isActive = true });
        var productB = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Taco Bistec", categoryId = category.Id, basePrice = 35m, isActive = true });

        await CreateSaleAsync(token, productA.Id, quantity: 2, total: 60m).ConfigureAwait(false);
        await CreateSaleAsync(token, productB.Id, quantity: 1, total: 35m).ConfigureAwait(false);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        using var dailyReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/daily-summary?date={today:yyyy-MM-dd}", token);
        using var dailyResp = await _client.SendAsync(dailyReq).ConfigureAwait(false);
        var daily = await dailyResp.Content.ReadFromJsonAsync<DailySummaryResponse>().ConfigureAwait(false);

        Assert.Equal(HttpStatusCode.OK, dailyResp.StatusCode);
        Assert.NotNull(daily);
        Assert.True(daily!.TotalTickets >= 2);
        Assert.True(daily.TotalAmount >= 95m);

        using var topReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/top-products?dateFrom={today:yyyy-MM-dd}&dateTo={today:yyyy-MM-dd}&top=5", token);
        using var topResp = await _client.SendAsync(topReq).ConfigureAwait(false);
        var top = await topResp.Content.ReadFromJsonAsync<List<TopProductResponse>>().ConfigureAwait(false);

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
            payment = new { method = 0, amount = total }
        });

        using var resp = await _client.SendAsync(req).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    private async Task<T> PostAsync<T>(string url, string token, object body)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, url, token);
        req.Content = JsonContent.Create(body);
        using var resp = await _client.SendAsync(req).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        return (await resp.Content.ReadFromJsonAsync<T>().ConfigureAwait(false))!;
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password }).ConfigureAwait(false);
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>().ConfigureAwait(false);
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
    private sealed record DailySummaryResponse(DateOnly Date, int TotalTickets, decimal TotalAmount, int TotalItems, decimal AvgTicket);
    private sealed record TopProductResponse(Guid ProductId, string ProductNameSnapshot, int Qty, decimal Amount);
}
