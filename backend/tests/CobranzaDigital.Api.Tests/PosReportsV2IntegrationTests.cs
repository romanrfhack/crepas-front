using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using TimeZoneConverter;

namespace CobranzaDigital.Api.Tests;

public sealed class PosReportsV2IntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private const string Prefix = "posreportsv2";
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public PosReportsV2IntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ReportsOperationalV2_ReturnExpectedMixesAddonsKpisAndCashControl()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var seed = await SeedReportDatasetAsync();
        var baseQuery = $"dateFrom=2026-04-01&dateTo=2026-04-02&storeId={seed.StoreId:D}";

        using var categoriesReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/categories?{baseQuery}", adminToken);
        using var categoriesResp = await _client.SendAsync(categoriesReq);
        var categoriesPayload = await categoriesResp.Content.ReadFromJsonAsync<CategoriesResponse>();

        Assert.Equal(HttpStatusCode.OK, categoriesResp.StatusCode);
        Assert.NotNull(categoriesPayload);
        Assert.Equal(2, categoriesPayload!.Items.Count);
        Assert.Contains(categoriesPayload.Items, x => x.CategoryId == seed.CategoryA && x.Tickets == 1 && x.Quantity == 1 && x.GrossSales == 120m);
        Assert.Contains(categoriesPayload.Items, x => x.CategoryId == seed.CategoryB && x.Tickets == 1 && x.Quantity == 2 && x.GrossSales == 140m);

        using var productsReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/products?{baseQuery}&top=20", adminToken);
        using var productsResp = await _client.SendAsync(productsReq);
        var productsPayload = await productsResp.Content.ReadFromJsonAsync<ProductsResponse>();

        Assert.Equal(HttpStatusCode.OK, productsResp.StatusCode);
        Assert.NotNull(productsPayload);
        Assert.Contains(productsPayload!.Items, x => x.ProductId == seed.ProductA && x.Sku == $"{Prefix}-P-A" && x.Tickets == 1 && x.Quantity == 1 && x.GrossSales == 120m);
        Assert.Contains(productsPayload.Items, x => x.ProductId == seed.ProductB && x.Sku == $"{Prefix}-P-B" && x.Tickets == 1 && x.Quantity == 2 && x.GrossSales == 140m);

        using var extrasReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/addons/extras?{baseQuery}&top=20", adminToken);
        using var extrasResp = await _client.SendAsync(extrasReq);
        var extrasPayload = await extrasResp.Content.ReadFromJsonAsync<ExtrasResponse>();

        Assert.Equal(HttpStatusCode.OK, extrasResp.StatusCode);
        Assert.NotNull(extrasPayload);
        Assert.Single(extrasPayload!.Items);
        Assert.Equal(seed.ExtraA, extrasPayload.Items[0].ExtraId);
        Assert.Equal(2, extrasPayload.Items[0].Quantity);
        Assert.Equal(20m, extrasPayload.Items[0].GrossSales);

        using var optionsReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/addons/options?{baseQuery}&top=20", adminToken);
        using var optionsResp = await _client.SendAsync(optionsReq);
        var optionsPayload = await optionsResp.Content.ReadFromJsonAsync<OptionsResponse>();

        Assert.Equal(HttpStatusCode.OK, optionsResp.StatusCode);
        Assert.NotNull(optionsPayload);
        Assert.Single(optionsPayload!.Items);
        Assert.Equal(seed.OptionItemA, optionsPayload.Items[0].OptionItemId);
        Assert.Equal(2, optionsPayload.Items[0].UsageCount);
        Assert.Equal(20m, optionsPayload.Items[0].GrossImpact);

        using var kpisReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/kpis/summary?{baseQuery}", adminToken);
        using var kpisResp = await _client.SendAsync(kpisReq);
        var kpisPayload = await kpisResp.Content.ReadFromJsonAsync<KpisSummaryResponse>();

        Assert.Equal(HttpStatusCode.OK, kpisResp.StatusCode);
        Assert.NotNull(kpisPayload);
        Assert.Equal(2, kpisPayload!.Tickets);
        Assert.Equal(3, kpisPayload.TotalItems);
        Assert.Equal(260m, kpisPayload.GrossSales);
        Assert.Equal(130m, kpisPayload.AvgTicket);
        Assert.Equal(1.5m, kpisPayload.AvgItemsPerTicket);
        Assert.Equal(1, kpisPayload.VoidCount);
        Assert.Equal(0.3333m, kpisPayload.VoidRate);

        using var controlReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/control/cash-differences?{baseQuery}", adminToken);
        using var controlResp = await _client.SendAsync(controlReq);
        var controlPayload = await controlResp.Content.ReadFromJsonAsync<CashControlResponse>();

        Assert.Equal(HttpStatusCode.OK, controlResp.StatusCode);
        Assert.NotNull(controlPayload);
        Assert.Equal(2, controlPayload!.Daily.Count);
        Assert.Contains(controlPayload.Daily, x => x.Date == new DateOnly(2026, 4, 1) && x.CashierUserId == seed.CashierA && x.Shifts == 1 && x.ExpectedCash == 100m && x.CountedCash == 95m && x.Difference == -5m && x.ReasonCount == 1);
        Assert.Contains(controlPayload.Daily, x => x.Date == new DateOnly(2026, 4, 2) && x.CashierUserId == seed.CashierB && x.Shifts == 1 && x.ExpectedCash == 150m && x.CountedCash == 160m && x.Difference == 10m && x.ReasonCount == 0);
        Assert.Equal(2, controlPayload.Shifts.Count);
        Assert.Contains(controlPayload.Shifts, x => x.ShiftId == seed.Shift1 && x.CashierUserId == seed.CashierA && x.CashierUserName == seed.CashierAUserName && x.Difference == -5m);
        Assert.Contains(controlPayload.Shifts, x => x.ShiftId == seed.Shift2 && x.CashierUserId == seed.CashierB && x.CashierUserName == seed.CashierBUserName && x.Difference == 10m);
    }

    [Fact]
    public async Task ReportsOperationalV2_Returns403_ForCashierRole_OnSalesProducts()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var cashierEmail = $"cashier+{Prefix}-{Guid.NewGuid():N}@test.local";
        _ = await RegisterAndGetAccessTokenAsync(cashierEmail, "User1234!");
        await SetUserRolesAsync(adminToken, cashierEmail, ["Cashier"]);

        var cashierToken = await LoginAndGetAccessTokenAsync(cashierEmail, "User1234!");
        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/reports/sales/products?dateFrom=2026-04-01&dateTo=2026-04-02", cashierToken);
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
        var categoryA = Guid.NewGuid();
        var categoryB = Guid.NewGuid();
        var productA = Guid.NewGuid();
        var productB = Guid.NewGuid();
        var extraA = Guid.NewGuid();
        var optionSetA = Guid.NewGuid();
        var optionItemA = Guid.NewGuid();

        var cashierAUserName = $"{Prefix}-cashier-a";
        var cashierBUserName = $"{Prefix}-cashier-b";

        db.Users.AddRange(
            new ApplicationUser
            {
                Id = cashierA,
                UserName = cashierAUserName,
                NormalizedUserName = cashierAUserName.ToUpperInvariant(),
                Email = $"{cashierAUserName}@test.local",
                NormalizedEmail = $"{cashierAUserName}@test.local".ToUpperInvariant()
            },
            new ApplicationUser
            {
                Id = cashierB,
                UserName = cashierBUserName,
                NormalizedUserName = cashierBUserName.ToUpperInvariant(),
                Email = $"{cashierBUserName}@test.local",
                NormalizedEmail = $"{cashierBUserName}@test.local".ToUpperInvariant()
            });

        db.Categories.AddRange(
            new Category { Id = categoryA, Name = $"{Prefix}-cat-a", SortOrder = 1, IsActive = true },
            new Category { Id = categoryB, Name = $"{Prefix}-cat-b", SortOrder = 2, IsActive = true });

        db.Products.AddRange(
            new Product { Id = productA, CategoryId = categoryA, Name = "Producto A", ExternalCode = $"{Prefix}-P-A", BasePrice = 100m, IsActive = true },
            new Product { Id = productB, CategoryId = categoryB, Name = "Producto B", ExternalCode = $"{Prefix}-P-B", BasePrice = 60m, IsActive = true });

        db.Extras.Add(new Extra { Id = extraA, Name = "Queso extra", Price = 10m, IsActive = true });
        db.OptionSets.Add(new OptionSet { Id = optionSetA, Name = "Salsas", IsActive = true });
        db.OptionItems.Add(new OptionItem { Id = optionItemA, OptionSetId = optionSetA, Name = "Salsa especial", SortOrder = 1, IsActive = true });

        db.PosShifts.AddRange(
            new PosShift
            {
                Id = shift1,
                StoreId = storeId,
                TenantId = tenantId,
                OpenedByUserId = cashierA,
                OpenedAtUtc = ToUtc(timeZone, new DateTime(2026, 4, 1, 8, 0, 0)),
                ClosedAtUtc = ToUtc(timeZone, new DateTime(2026, 4, 1, 20, 0, 0)),
                ExpectedCashAmount = 100m,
                ClosingCashAmount = 95m,
                CashDifference = -5m,
                CloseReason = "Short"
            },
            new PosShift
            {
                Id = shift2,
                StoreId = storeId,
                TenantId = tenantId,
                OpenedByUserId = cashierB,
                OpenedAtUtc = ToUtc(timeZone, new DateTime(2026, 4, 2, 8, 0, 0)),
                ClosedAtUtc = ToUtc(timeZone, new DateTime(2026, 4, 2, 20, 0, 0)),
                ExpectedCashAmount = 150m,
                ClosingCashAmount = 160m,
                CashDifference = 10m,
                CloseReason = null
            });

        var saleWithExtras = CreateSale(storeId, tenantId, shift1, cashierA, ToUtc(timeZone, new DateTime(2026, 4, 1, 9, 30, 0)), 120m, SaleStatus.Completed);
        var saleWithSelection = CreateSale(storeId, tenantId, shift2, cashierB, ToUtc(timeZone, new DateTime(2026, 4, 2, 12, 15, 0)), 140m, SaleStatus.Completed);
        var voidSale = CreateSale(storeId, tenantId, shift2, cashierA, ToUtc(timeZone, new DateTime(2026, 4, 2, 14, 45, 0)), 50m, SaleStatus.Void);
        voidSale.VoidedAtUtc = ToUtc(timeZone, new DateTime(2026, 4, 2, 15, 00, 0));
        voidSale.VoidReasonCode = "CashierError";
        voidSale.VoidReasonText = "captura";

        db.Sales.AddRange(saleWithExtras, saleWithSelection, voidSale);

        var saleItemWithExtras = CreateSaleItem(saleWithExtras.Id, productA, $"{Prefix}-P-A", "Producto A", 1, 100m);
        saleItemWithExtras.LineTotal = 100m;

        var saleItemWithSelection = CreateSaleItem(saleWithSelection.Id, productB, $"{Prefix}-P-B", "Producto B", 2, 60m);
        saleItemWithSelection.LineTotal = 120m;

        db.SaleItems.AddRange(
            saleItemWithExtras,
            saleItemWithSelection,
            CreateSaleItem(voidSale.Id, productA, $"{Prefix}-P-A", "Producto A", 1, 50m));

        db.SaleItemExtras.Add(new SaleItemExtra
        {
            Id = Guid.NewGuid(),
            SaleItemId = saleItemWithExtras.Id,
            ExtraId = extraA,
            ExtraNameSnapshot = "Queso extra",
            UnitPriceSnapshot = 10m,
            Quantity = 2,
            LineTotal = 20m
        });

        db.SaleItemSelections.Add(new SaleItemSelection
        {
            Id = Guid.NewGuid(),
            SaleItemId = saleItemWithSelection.Id,
            GroupKey = "salsas",
            OptionItemId = optionItemA,
            OptionItemNameSnapshot = "Salsa especial",
            PriceDeltaSnapshot = 10m
        });

        db.Payments.AddRange(
            new Payment { Id = Guid.NewGuid(), SaleId = saleWithExtras.Id, Method = PaymentMethod.Cash, Amount = 70m, CreatedAtUtc = saleWithExtras.OccurredAtUtc },
            new Payment { Id = Guid.NewGuid(), SaleId = saleWithExtras.Id, Method = PaymentMethod.Card, Amount = 50m, CreatedAtUtc = saleWithExtras.OccurredAtUtc, Reference = "AUTH-50" },
            new Payment { Id = Guid.NewGuid(), SaleId = saleWithSelection.Id, Method = PaymentMethod.Cash, Amount = 50m, CreatedAtUtc = saleWithSelection.OccurredAtUtc },
            new Payment { Id = Guid.NewGuid(), SaleId = saleWithSelection.Id, Method = PaymentMethod.Transfer, Amount = 90m, CreatedAtUtc = saleWithSelection.OccurredAtUtc, Reference = "TRX-90" },
            new Payment { Id = Guid.NewGuid(), SaleId = voidSale.Id, Method = PaymentMethod.Cash, Amount = 50m, CreatedAtUtc = voidSale.OccurredAtUtc });

        await db.SaveChangesAsync();
        return new SeedResult(storeId, cashierA, cashierB, cashierAUserName, cashierBUserName, shift1, shift2, categoryA, categoryB, productA, productB, extraA, optionItemA);
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

    private sealed record SeedResult(
        Guid StoreId,
        Guid CashierA,
        Guid CashierB,
        string CashierAUserName,
        string CashierBUserName,
        Guid Shift1,
        Guid Shift2,
        Guid CategoryA,
        Guid CategoryB,
        Guid ProductA,
        Guid ProductB,
        Guid ExtraA,
        Guid OptionItemA);

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem(string Id);
    private sealed record CategoriesResponse(List<CategoryItemResponse> Items);
    private sealed record CategoryItemResponse(Guid CategoryId, string CategoryName, int Tickets, int Quantity, decimal GrossSales);
    private sealed record ProductsResponse(List<ProductItemResponse> Items);
    private sealed record ProductItemResponse(Guid ProductId, string? Sku, string ProductName, int Tickets, int Quantity, decimal GrossSales);
    private sealed record ExtrasResponse(List<ExtraItemResponse> Items);
    private sealed record ExtraItemResponse(Guid ExtraId, string? ExtraSku, string ExtraName, int Quantity, decimal GrossSales);
    private sealed record OptionsResponse(List<OptionItemResponse> Items);
    private sealed record OptionItemResponse(Guid OptionItemId, string? OptionItemSku, string OptionItemName, int UsageCount, decimal GrossImpact);
    private sealed record KpisSummaryResponse(int Tickets, int TotalItems, decimal GrossSales, decimal AvgTicket, decimal AvgItemsPerTicket, int VoidCount, decimal VoidRate);
    private sealed record CashControlResponse(List<CashDailyRowResponse> Daily, List<CashShiftRowResponse> Shifts);
    private sealed record CashDailyRowResponse(DateOnly Date, Guid CashierUserId, int Shifts, decimal ExpectedCash, decimal CountedCash, decimal Difference, int ReasonCount);
    private sealed record CashShiftRowResponse(Guid ShiftId, DateTimeOffset OpenedAt, DateTimeOffset? ClosedAt, Guid CashierUserId, string? CashierUserName, decimal ExpectedCash, decimal CountedCash, decimal Difference, string? CloseReason);
}
