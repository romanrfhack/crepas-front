using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using TimeZoneConverter;

namespace CobranzaDigital.Api.Tests;

public sealed class PosReportsIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private const string Prefix = "posreportsv1";
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public PosReportsIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ReportsOperationalV1_ReturnExpectedAggregations_AndTopProductsSupportsFilters()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var seed = await SeedReportDatasetAsync();

        var baseQuery = $"dateFrom=2026-03-01&dateTo=2026-03-02&storeId={seed.StoreId:D}";

        using var dailyReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/daily?{baseQuery}", adminToken);
        using var dailyResp = await _client.SendAsync(dailyReq);
        var dailyRows = await dailyResp.Content.ReadFromJsonAsync<List<DailySalesRowResponse>>();

        Assert.Equal(HttpStatusCode.OK, dailyResp.StatusCode);
        Assert.NotNull(dailyRows);
        Assert.Collection(dailyRows!,
            day1 =>
            {
                Assert.Equal(new DateOnly(2026, 3, 1), day1.BusinessDate);
                Assert.Equal(2, day1.Tickets);
                Assert.Equal(160m, day1.TotalSales);
                Assert.Equal(80m, day1.AvgTicket);
                Assert.Equal(0, day1.VoidsCount);
                Assert.Equal(0m, day1.VoidsTotal);
                Assert.Equal(100m, day1.Payments.Cash);
                Assert.Equal(60m, day1.Payments.Card);
                Assert.Equal(0m, day1.Payments.Transfer);
            },
            day2 =>
            {
                Assert.Equal(new DateOnly(2026, 3, 2), day2.BusinessDate);
                Assert.Equal(1, day2.Tickets);
                Assert.Equal(80m, day2.TotalSales);
                Assert.Equal(80m, day2.AvgTicket);
                Assert.Equal(1, day2.VoidsCount);
                Assert.Equal(50m, day2.VoidsTotal);
                Assert.Equal(0m, day2.Payments.Cash);
                Assert.Equal(0m, day2.Payments.Card);
                Assert.Equal(80m, day2.Payments.Transfer);
            });

        using var methodsReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/payments/methods?{baseQuery}", adminToken);
        using var methodsResp = await _client.SendAsync(methodsReq);
        var methodsPayload = await methodsResp.Content.ReadFromJsonAsync<PaymentsMethodsResponse>();

        Assert.Equal(HttpStatusCode.OK, methodsResp.StatusCode);
        Assert.NotNull(methodsPayload);
        Assert.Equal(3, methodsPayload!.Totals.Count);
        Assert.Contains(methodsPayload.Totals, x => (x.Method is "Cash" or "0") && x.Count == 1 && x.Amount == 100m);
        Assert.Contains(methodsPayload.Totals, x => (x.Method is "Card" or "1") && x.Count == 1 && x.Amount == 60m);
        Assert.Contains(methodsPayload.Totals, x => (x.Method is "Transfer" or "2") && x.Count == 1 && x.Amount == 80m);

        using var hourlyReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/hourly?{baseQuery}", adminToken);
        using var hourlyResp = await _client.SendAsync(hourlyReq);
        var hourlyRows = await hourlyResp.Content.ReadFromJsonAsync<List<HourlySalesRowResponse>>();

        Assert.Equal(HttpStatusCode.OK, hourlyResp.StatusCode);
        Assert.NotNull(hourlyRows);
        Assert.Equal(3, hourlyRows!.Count);
        Assert.Contains(hourlyRows, x => x.Hour == 9 && x.Tickets == 1 && x.TotalSales == 100m);
        Assert.Contains(hourlyRows, x => x.Hour == 10 && x.Tickets == 1 && x.TotalSales == 60m);
        Assert.Contains(hourlyRows, x => x.Hour == 15 && x.Tickets == 1 && x.TotalSales == 80m);

        using var cashiersReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/cashiers?{baseQuery}", adminToken);
        using var cashiersResp = await _client.SendAsync(cashiersReq);
        var cashiersRows = await cashiersResp.Content.ReadFromJsonAsync<List<CashierSalesRowResponse>>();

        Assert.Equal(HttpStatusCode.OK, cashiersResp.StatusCode);
        Assert.NotNull(cashiersRows);
        Assert.Contains(cashiersRows!, x => x.CashierUserId == seed.CashierA && x.Tickets == 2 && x.TotalSales == 180m && x.AvgTicket == 90m && x.VoidsCount == 0 && x.VoidsTotal == 0m);
        Assert.Contains(cashiersRows!, x => x.CashierUserId == seed.CashierB && x.Tickets == 1 && x.TotalSales == 60m && x.AvgTicket == 60m && x.VoidsCount == 1 && x.VoidsTotal == 50m);

        using var shiftsReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/shifts/summary?{baseQuery}", adminToken);
        using var shiftsResp = await _client.SendAsync(shiftsReq);
        var shiftsRows = await shiftsResp.Content.ReadFromJsonAsync<List<ShiftSummaryRowResponse>>();

        Assert.Equal(HttpStatusCode.OK, shiftsResp.StatusCode);
        Assert.NotNull(shiftsRows);
        Assert.Contains(shiftsRows!, x => x.ShiftId == seed.Shift1 && x.Tickets == 2 && x.TotalSales == 160m && x.CashDifference == 0m);
        Assert.Contains(shiftsRows!, x => x.ShiftId == seed.Shift2 && x.Tickets == 1 && x.TotalSales == 80m && x.CashDifference == -10m);

        using var voidsReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/voids/reasons?{baseQuery}", adminToken);
        using var voidsResp = await _client.SendAsync(voidsReq);
        var voidRows = await voidsResp.Content.ReadFromJsonAsync<List<VoidReasonRowResponse>>();

        Assert.Equal(HttpStatusCode.OK, voidsResp.StatusCode);
        Assert.NotNull(voidRows);
        Assert.Contains(voidRows!, x => x.ReasonCode == "CashierError" && x.Count == 1 && x.Amount == 50m);

        using var topFilteredReq = CreateAuthorizedRequest(HttpMethod.Get,
            $"/api/v1/pos/reports/top-products?dateFrom=2026-03-01&dateTo=2026-03-02&storeId={seed.StoreId:D}&cashierUserId={seed.CashierA:D}&top=10",
            adminToken);
        using var topFilteredResp = await _client.SendAsync(topFilteredReq);
        var topProducts = await topFilteredResp.Content.ReadFromJsonAsync<List<TopProductResponse>>();

        Assert.Equal(HttpStatusCode.OK, topFilteredResp.StatusCode);
        Assert.NotNull(topProducts);
        Assert.Single(topProducts!);
        Assert.Equal(seed.ProductA, topProducts[0].ProductId);
        Assert.Equal(2, topProducts[0].Qty);
        Assert.Equal(180m, topProducts[0].Amount);
    }

    [Fact]
    public async Task ReportsOperationalV1_Returns403_ForCashierRole()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var cashierEmail = $"cashier+{Prefix}-{Guid.NewGuid():N}@test.local";
        _ = await RegisterAndGetAccessTokenAsync(cashierEmail, "User1234!");
        await SetUserRolesAsync(adminToken, cashierEmail, ["Cashier"]);

        var cashierToken = await LoginAndGetAccessTokenAsync(cashierEmail, "User1234!");

        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/reports/sales/daily?dateFrom=2026-03-01&dateTo=2026-03-02", cashierToken);
        using var resp = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    private async Task<SeedResult> SeedReportDatasetAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var storeId = await db.PosSettings.AsNoTracking().Select(x => x.DefaultStoreId).SingleAsync();
        var storeSeed = await db.Stores.AsNoTracking().Where(x => x.Id == storeId).Select(x => new { x.TimeZoneId, x.TenantId }).SingleAsync();
        var tzId = storeSeed.TimeZoneId;
        var tenantId = storeSeed.TenantId;
        var timeZone = TZConvert.GetTimeZoneInfo(tzId);

        var cashierA = Guid.NewGuid();
        var cashierB = Guid.NewGuid();
        var shift1 = Guid.NewGuid();
        var shift2 = Guid.NewGuid();
        var productA = Guid.NewGuid();
        var productB = Guid.NewGuid();

        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = $"{Prefix}-reporting-category-{storeId:N}",
            SortOrder = 1,
            IsActive = true
        };

        var products = new[]
        {
            CreateProduct(category.Id, productA, "Producto A", "P-A", 100m),
            CreateProduct(category.Id, productB, "Producto B", "P-B", 60m)
        };

        db.Categories.Add(category);
        db.Products.AddRange(products);
        await db.SaveChangesAsync();

        var persistedProducts = await db.Products
            .AsNoTracking()
            .Where(x => x.Id == productA || x.Id == productB)
            .Select(x => new { x.Id, x.ExternalCode, x.Name })
            .ToDictionaryAsync(x => x.Id);

        if (!persistedProducts.TryGetValue(productA, out var productASeed)
            || !persistedProducts.TryGetValue(productB, out var productBSeed))
        {
            throw new InvalidOperationException("SeedReportDatasetAsync failed to persist expected products before creating SaleItems.");
        }

        db.PosShifts.AddRange(
            new PosShift
            {
                Id = shift1,
                StoreId = storeId,
                TenantId = tenantId,
                OpenedByUserId = cashierA,
                OpenedAtUtc = ToUtc(timeZone, new DateTime(2026, 3, 1, 8, 0, 0)),
                ClosedAtUtc = ToUtc(timeZone, new DateTime(2026, 3, 1, 20, 0, 0)),
                ExpectedCashAmount = 100m,
                ClosingCashAmount = 100m,
                CashDifference = 0m,
                CloseReason = null
            },
            new PosShift
            {
                Id = shift2,
                StoreId = storeId,
                TenantId = tenantId,
                OpenedByUserId = cashierB,
                OpenedAtUtc = ToUtc(timeZone, new DateTime(2026, 3, 2, 8, 0, 0)),
                ClosedAtUtc = ToUtc(timeZone, new DateTime(2026, 3, 2, 20, 0, 0)),
                ExpectedCashAmount = 80m,
                ClosingCashAmount = 70m,
                CashDifference = -10m,
                CloseReason = "ManualClose"
            });

        await db.SaveChangesAsync();

        var sale1 = CreateSale(storeId, tenantId, shift1, cashierA, ToUtc(timeZone, new DateTime(2026, 3, 1, 9, 15, 0)), 100m, SaleStatus.Completed);
        var sale2 = CreateSale(storeId, tenantId, shift1, cashierB, ToUtc(timeZone, new DateTime(2026, 3, 1, 10, 10, 0)), 60m, SaleStatus.Completed);
        var sale3 = CreateSale(storeId, tenantId, shift2, cashierA, ToUtc(timeZone, new DateTime(2026, 3, 2, 15, 35, 0)), 80m, SaleStatus.Completed);
        var saleVoid = CreateSale(storeId, tenantId, shift2, cashierB, ToUtc(timeZone, new DateTime(2026, 3, 2, 16, 5, 0)), 50m, SaleStatus.Void);
        saleVoid.VoidedAtUtc = ToUtc(timeZone, new DateTime(2026, 3, 2, 16, 20, 0));
        saleVoid.VoidReasonCode = "CashierError";
        saleVoid.VoidReasonText = "captura";

        db.Sales.AddRange(sale1, sale2, sale3, saleVoid);
        await db.SaveChangesAsync();

        db.Payments.AddRange(
            new Payment { Id = Guid.NewGuid(), SaleId = sale1.Id, Method = PaymentMethod.Cash, Amount = 100m, CreatedAtUtc = sale1.OccurredAtUtc },
            new Payment { Id = Guid.NewGuid(), SaleId = sale2.Id, Method = PaymentMethod.Card, Amount = 60m, CreatedAtUtc = sale2.OccurredAtUtc, Reference = "AUTH-60" },
            new Payment { Id = Guid.NewGuid(), SaleId = sale3.Id, Method = PaymentMethod.Transfer, Amount = 80m, CreatedAtUtc = sale3.OccurredAtUtc, Reference = "TRX-80" },
            new Payment { Id = Guid.NewGuid(), SaleId = saleVoid.Id, Method = PaymentMethod.Cash, Amount = 50m, CreatedAtUtc = saleVoid.OccurredAtUtc });
        await db.SaveChangesAsync();

        var saleItems = new[]
        {
            CreateSaleItem(sale1.Id, productASeed.Id, productASeed.ExternalCode, productASeed.Name, 1, 100m),
            CreateSaleItem(sale2.Id, productBSeed.Id, productBSeed.ExternalCode, productBSeed.Name, 1, 60m),
            CreateSaleItem(sale3.Id, productASeed.Id, productASeed.ExternalCode, productASeed.Name, 1, 80m),
            CreateSaleItem(saleVoid.Id, productBSeed.Id, productBSeed.ExternalCode, productBSeed.Name, 1, 50m)
        };

        ValidateSaleItemProductReferences(saleItems, [productASeed.Id, productBSeed.Id]);

        db.SaleItems.AddRange(saleItems);

        await db.SaveChangesAsync();

        return new SeedResult(storeId, cashierA, cashierB, shift1, shift2, productA);
    }

    private static Product CreateProduct(Guid categoryId, Guid id, string name, string externalCode, decimal basePrice)
    {
        return new Product
        {
            Id = id,
            CategoryId = categoryId,
            Name = name,
            ExternalCode = $"{Prefix}-{externalCode}",
            BasePrice = basePrice,
            IsActive = true
        };
    }

    private static Sale CreateSale(Guid storeId, Guid tenantId, Guid shiftId, Guid cashierId, DateTimeOffset occurredAtUtc, decimal total, SaleStatus status)
    {
        var id = Guid.NewGuid();
        return new Sale
        {
            Id = id,
            Folio = $"{Prefix}-{id:N}",
            StoreId = storeId,
            TenantId = tenantId,
            ShiftId = shiftId,
            CreatedByUserId = cashierId,
            OccurredAtUtc = occurredAtUtc,
            Subtotal = total,
            Total = total,
            Status = status
        };
    }

    private static SaleItem CreateSaleItem(Guid saleId, Guid productId, string? productExternalCode, string productName, int quantity, decimal unitPrice)
    {
        return new SaleItem
        {
            Id = Guid.NewGuid(),
            SaleId = saleId,
            ProductId = productId,
            ProductExternalCode = productExternalCode,
            ProductNameSnapshot = productName,
            UnitPriceSnapshot = unitPrice,
            Quantity = quantity,
            LineTotal = quantity * unitPrice
        };
    }

    private static void ValidateSaleItemProductReferences(IEnumerable<SaleItem> saleItems, IEnumerable<Guid> productIdsSource)
    {
        var productIds = productIdsSource.ToHashSet();
        var missingProductIds = saleItems
            .Select(x => x.ProductId)
            .Distinct()
            .Where(productId => !productIds.Contains(productId))
            .ToArray();

        if (missingProductIds.Length == 0)
        {
            return;
        }

        throw new InvalidOperationException($"SeedReportDatasetAsync has SaleItems with missing Products. Missing ProductIds: {string.Join(", ", missingProductIds)}");
    }

    private async Task<string> RegisterAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private async Task SetUserRolesAsync(string adminToken, string email, string[] roles)
    {
        var userId = await GetUserIdByEmailAsync(adminToken, email);

        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles", adminToken);
        request.Content = JsonContent.Create(new { roles });
        using var response = await _client.SendAsync(request);

        Assert.True(response.StatusCode is HttpStatusCode.NoContent or HttpStatusCode.OK);
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/admin/users?search={Uri.EscapeDataString(email)}", adminToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);

        return payload.Items[0].Id;
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private static DateTimeOffset ToUtc(TimeZoneInfo timeZone, DateTime local)
    {
        var utc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), timeZone);
        return new DateTimeOffset(utc);
    }

    private sealed record SeedResult(Guid StoreId, Guid CashierA, Guid CashierB, Guid Shift1, Guid Shift2, Guid ProductA);
    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem(string Id);
    private sealed record PaymentsBreakdownResponse(decimal Cash, decimal Card, decimal Transfer);
    private sealed record DailySalesRowResponse(DateOnly BusinessDate, int Tickets, decimal TotalSales, decimal AvgTicket, int VoidsCount, decimal VoidsTotal, PaymentsBreakdownResponse Payments);
    private sealed record PaymentsMethodsResponse(DateOnly DateFrom, DateOnly DateTo, List<PaymentMethodTotalResponse> Totals);
    private sealed record PaymentMethodTotalResponse(string Method, int Count, decimal Amount);
    private sealed record HourlySalesRowResponse(int Hour, int Tickets, decimal TotalSales);
    private sealed record CashierSalesRowResponse(Guid CashierUserId, int Tickets, decimal TotalSales, decimal AvgTicket, int VoidsCount, decimal VoidsTotal, PaymentsBreakdownResponse Payments);
    private sealed record ShiftSummaryRowResponse(Guid ShiftId, Guid CashierUserId, int Tickets, decimal TotalSales, decimal CashDifference, PaymentsBreakdownResponse Payments);
    private sealed record VoidReasonRowResponse(string? ReasonCode, string? ReasonText, int Count, decimal Amount);
    private sealed record TopProductResponse(Guid ProductId, string ProductNameSnapshot, int Qty, decimal Amount);
}
