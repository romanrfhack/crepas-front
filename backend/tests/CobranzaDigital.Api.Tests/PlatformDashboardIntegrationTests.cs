using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PlatformDashboardIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;
    private readonly Lazy<Task<SeedResult>> _seed;

    public PlatformDashboardIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _seed = new Lazy<Task<SeedResult>>(SeedDashboardDataAsync);
    }

    [Fact]
    public async Task PlatformDashboard_Endpoints_AccessControl_WorksByRole()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        foreach (var email in new[] { seed.TenantAdminEmail, seed.AdminStoreEmail, seed.ManagerEmail, seed.CashierEmail })
        {
            var token = await LoginAsync(email, seed.Password);
            foreach (var path in new[]
                     {
                         "/api/v1/platform/dashboard/summary",
                         "/api/v1/platform/dashboard/sales-trend",
                         "/api/v1/platform/dashboard/top-void-tenants",
                         "/api/v1/platform/dashboard/stockout-hotspots",
                         "/api/v1/platform/dashboard/activity-feed",
                         "/api/v1/platform/dashboard/executive-signals"
                     })
            {
                using var forbiddenRequest = CreateAuthGet(path, token);
                using var forbiddenResponse = await _client.SendAsync(forbiddenRequest);
                Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);
            }
        }

        foreach (var path in new[]
                 {
                     "/api/v1/platform/dashboard/summary",
                     "/api/v1/platform/dashboard/top-tenants",
                     "/api/v1/platform/dashboard/alerts",
                     "/api/v1/platform/dashboard/recent-inventory-adjustments",
                     "/api/v1/platform/dashboard/out-of-stock",
                     "/api/v1/platform/dashboard/sales-trend",
                     "/api/v1/platform/dashboard/top-void-tenants",
                     "/api/v1/platform/dashboard/stockout-hotspots",
                     "/api/v1/platform/dashboard/activity-feed",
                     "/api/v1/platform/dashboard/executive-signals"
                 })
        {
            using var request = CreateAuthGet(path, superToken);
            using var response = await _client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task PlatformDashboard_SalesTrend_ReturnsOrderedBuckets_AndGranularity()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);
        var from = seed.RangeFrom.ToString("O");
        var to = seed.RangeTo.ToString("O");

        using var request = CreateAuthGet($"/api/v1/platform/dashboard/sales-trend?dateFrom={Uri.EscapeDataString(from)}&dateTo={Uri.EscapeDataString(to)}&granularity=day", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformSalesTrendResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.True(payload!.Items.Count >= 3);
        Assert.True(payload.Items.Zip(payload.Items.Skip(1), (a, b) => a.BucketStartUtc <= b.BucketStartUtc).All(x => x));
        Assert.Equal(seed.ExpectedCompletedSalesInRange, payload.Items.Sum(x => x.SalesCount));
        Assert.Equal(seed.ExpectedVoidsInRange, payload.Items.Sum(x => x.VoidedSalesCount));

        using var weekRequest = CreateAuthGet($"/api/v1/platform/dashboard/sales-trend?dateFrom={Uri.EscapeDataString(from)}&dateTo={Uri.EscapeDataString(to)}&granularity=week", superToken);
        using var weekResponse = await _client.SendAsync(weekRequest);
        var weekPayload = await weekResponse.Content.ReadFromJsonAsync<PlatformSalesTrendResponseDto>();
        Assert.Equal(HttpStatusCode.OK, weekResponse.StatusCode);
        Assert.NotNull(weekPayload);
        Assert.True(weekPayload!.Items.Count <= payload.Items.Count);
    }

    [Fact]
    public async Task PlatformDashboard_TopVoidTenants_OrdersAndRespectsTop()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet($"/api/v1/platform/dashboard/top-void-tenants?dateFrom={Uri.EscapeDataString(seed.RangeFrom.ToString("O"))}&dateTo={Uri.EscapeDataString(seed.RangeTo.ToString("O"))}&top=1", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformTopVoidTenantsResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
        Assert.Equal(seed.Tenant1Id, payload.Items[0].TenantId);
        Assert.True(payload.Items[0].VoidedSalesCount >= 2);
    }

    [Fact]
    public async Task PlatformDashboard_StockoutHotspots_RespectsThresholdItemTypeAndTop()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet("/api/v1/platform/dashboard/stockout-hotspots?threshold=2&top=1&itemType=Product", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformStockoutHotspotsResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
        Assert.Equal(seed.Tenant1Id, payload.Items[0].TenantId);
        Assert.True(payload.Items[0].OutOfStockItemsCount >= 1);
    }

    [Fact]
    public async Task PlatformDashboard_ActivityFeed_MixesEventsAndFiltersByEventType()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet("/api/v1/platform/dashboard/activity-feed?take=5", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformActivityFeedResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.True(payload!.Items.Count <= 5);
        Assert.Contains(payload.Items, x => x.EventType == "SaleCreated");
        Assert.Contains(payload.Items, x => x.EventType == "InventoryAdjusted");

        using var filterRequest = CreateAuthGet("/api/v1/platform/dashboard/activity-feed?take=10&eventType=SaleVoided", superToken);
        using var filterResponse = await _client.SendAsync(filterRequest);
        var filtered = await filterResponse.Content.ReadFromJsonAsync<PlatformActivityFeedResponseDto>();

        Assert.Equal(HttpStatusCode.OK, filterResponse.StatusCode);
        Assert.NotNull(filtered);
        Assert.All(filtered!.Items, x => Assert.Equal("SaleVoided", x.EventType));
    }

    [Fact]
    public async Task PlatformDashboard_ExecutiveSignals_ReturnsCoherentSignals()
    {
        var seed = await GetSeedAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet($"/api/v1/platform/dashboard/executive-signals?dateFrom={Uri.EscapeDataString(seed.RangeFrom.ToString("O"))}&dateTo={Uri.EscapeDataString(seed.RangeTo.ToString("O"))}&previousPeriodCompare=true", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformExecutiveSignalsDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(seed.Tenant1Id, payload!.FastestGrowingTenantId);
        Assert.True(payload.VoidRatePercent > 0m);
        Assert.True(payload.TenantsWithNoSalesInRangeCount >= 1);
        Assert.True(payload.InventoryAdjustmentCountInRange >= 1);
    }

    private async Task<SeedResult> SeedDashboardDataAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();

        var now = DateTimeOffset.UtcNow;
        var baseDay = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, TimeSpan.Zero);

        var vertical = new Vertical { Id = Guid.NewGuid(), Name = "Food", Description = "Food", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        db.Verticals.Add(vertical);

        var tenant1 = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant Alpha", Slug = "tenant-alpha", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant2 = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant Beta", Slug = "tenant-beta", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant3 = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant Gamma", Slug = "tenant-gamma", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        db.Tenants.AddRange(tenant1, tenant2, tenant3);

        var store1 = new Store { Id = Guid.NewGuid(), TenantId = tenant1.Id, Name = "Store A1", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        var store2 = new Store { Id = Guid.NewGuid(), TenantId = tenant2.Id, Name = "Store B1", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        var store3 = new Store { Id = Guid.NewGuid(), TenantId = tenant3.Id, Name = "Store C1", IsActive = true, TimeZoneId = "UTC", CreatedAtUtc = now, UpdatedAtUtc = now };
        db.Stores.AddRange(store1, store2, store3);

        var template = new CatalogTemplate { Id = Guid.NewGuid(), Name = "Template A", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        db.CatalogTemplates.Add(template);
        db.TenantCatalogTemplates.Add(new TenantCatalogTemplate { TenantId = tenant1.Id, CatalogTemplateId = template.Id, UpdatedAtUtc = now });

        var category = new Category { Id = Guid.NewGuid(), CatalogTemplateId = template.Id, Name = "Bebidas", SortOrder = 1, IsActive = true, UpdatedAtUtc = now };
        var productOut = new Product { Id = Guid.NewGuid(), CatalogTemplateId = template.Id, CategoryId = category.Id, Name = "P1", ExternalCode = $"P1-{Guid.NewGuid():N}", BasePrice = 10m, IsActive = true, IsAvailable = true, IsInventoryTracked = true };
        var productLow = new Product { Id = Guid.NewGuid(), CatalogTemplateId = template.Id, CategoryId = category.Id, Name = "P2", ExternalCode = $"P2-{Guid.NewGuid():N}", BasePrice = 10m, IsActive = true, IsAvailable = true, IsInventoryTracked = true };
        var productB = new Product { Id = Guid.NewGuid(), CatalogTemplateId = template.Id, CategoryId = category.Id, Name = "P3", ExternalCode = $"P3-{Guid.NewGuid():N}", BasePrice = 10m, IsActive = true, IsAvailable = true, IsInventoryTracked = true };
        db.Categories.Add(category);
        db.Products.AddRange(productOut, productLow, productB);

        db.Sales.AddRange(
            new Sale { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, Folio = "S1", OccurredAtUtc = baseDay.AddHours(11), Currency = "MXN", Subtotal = 200m, Total = 200m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, Folio = "S2", OccurredAtUtc = baseDay.AddDays(-1).AddHours(10), Currency = "MXN", Subtotal = 100m, Total = 100m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, Folio = "S3", OccurredAtUtc = baseDay.AddDays(-1).AddHours(13), Currency = "MXN", Subtotal = 40m, Total = 40m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Void, VoidedAtUtc = baseDay.AddDays(-1).AddHours(14), VoidedByUserId = Guid.NewGuid() },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, Folio = "S4", OccurredAtUtc = baseDay.AddDays(-2).AddHours(9), Currency = "MXN", Subtotal = 30m, Total = 30m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Void, VoidedAtUtc = baseDay.AddDays(-2).AddHours(10), VoidedByUserId = Guid.NewGuid() },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant2.Id, StoreId = store2.Id, Folio = "S5", OccurredAtUtc = baseDay.AddDays(-2).AddHours(8), Currency = "MXN", Subtotal = 50m, Total = 50m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant2.Id, StoreId = store2.Id, Folio = "S6", OccurredAtUtc = baseDay.AddHours(12), Currency = "MXN", Subtotal = 20m, Total = 20m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Void, VoidedAtUtc = baseDay.AddHours(12).AddMinutes(10), VoidedByUserId = Guid.NewGuid() },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, Folio = "S-prev", OccurredAtUtc = baseDay.AddDays(-5).AddHours(11), Currency = "MXN", Subtotal = 60m, Total = 60m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant2.Id, StoreId = store2.Id, Folio = "S-prev2", OccurredAtUtc = baseDay.AddDays(-6).AddHours(11), Currency = "MXN", Subtotal = 200m, Total = 200m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed });

        db.PosShifts.Add(new PosShift { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, OpenedAtUtc = now, OpenedByUserId = Guid.NewGuid(), OpeningCashAmount = 100m });

        db.CatalogInventoryBalances.AddRange(
            new CatalogInventoryBalance { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, ItemType = CatalogItemType.Product, ItemId = productOut.Id, OnHandQty = 0m, UpdatedAtUtc = now },
            new CatalogInventoryBalance { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, ItemType = CatalogItemType.Product, ItemId = productLow.Id, OnHandQty = 2m, UpdatedAtUtc = now },
            new CatalogInventoryBalance { Id = Guid.NewGuid(), TenantId = tenant2.Id, StoreId = store2.Id, ItemType = CatalogItemType.Product, ItemId = productB.Id, OnHandQty = 0m, UpdatedAtUtc = now.AddMinutes(-30) });

        db.CatalogInventoryAdjustments.AddRange(
            new CatalogInventoryAdjustment { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, ItemType = CatalogItemType.Product, ItemId = productOut.Id, QtyBefore = 5m, DeltaQty = -5m, ResultingOnHandQty = 0m, Reason = "SaleConsumption", CreatedAtUtc = now.AddMinutes(-5), CreatedByUserId = Guid.NewGuid() },
            new CatalogInventoryAdjustment { Id = Guid.NewGuid(), TenantId = tenant2.Id, StoreId = store2.Id, ItemType = CatalogItemType.Product, ItemId = productB.Id, QtyBefore = 2m, DeltaQty = -2m, ResultingOnHandQty = 0m, Reason = "Correction", CreatedAtUtc = now.AddMinutes(-10), CreatedByUserId = Guid.NewGuid() });

        await db.SaveChangesAsync();

        var password = "PlatformDash!123";
        var superEmail = $"super-{Guid.NewGuid():N}@test.local";
        var tenantAdminEmail = $"ta-{Guid.NewGuid():N}@test.local";
        var adminStoreEmail = $"as-{Guid.NewGuid():N}@test.local";
        var managerEmail = $"mg-{Guid.NewGuid():N}@test.local";
        var cashierEmail = $"ca-{Guid.NewGuid():N}@test.local";

        await CreateUserAsync(userManager, superEmail, password, ["SuperAdmin"], null, null);
        await CreateUserAsync(userManager, tenantAdminEmail, password, ["TenantAdmin"], tenant1.Id, null);
        await CreateUserAsync(userManager, adminStoreEmail, password, ["AdminStore"], tenant1.Id, store1.Id);
        await CreateUserAsync(userManager, managerEmail, password, ["Manager"], tenant1.Id, store1.Id);
        await CreateUserAsync(userManager, cashierEmail, password, ["Cashier"], tenant1.Id, store1.Id);

        return new SeedResult(password, superEmail, tenantAdminEmail, adminStoreEmail, managerEmail, cashierEmail, tenant1.Id, baseDay.AddDays(-2), baseDay.AddDays(1), 3, 3);
    }

    private Task<SeedResult> GetSeedAsync() => _seed.Value;

    private static async Task CreateUserAsync(UserManager<ApplicationUser> userManager, string email, string password, string[] roles, Guid? tenantId, Guid? storeId)
    {
        var user = new ApplicationUser { Id = Guid.NewGuid(), Email = email, UserName = email, TenantId = tenantId, StoreId = storeId, EmailConfirmed = true };
        var create = await userManager.CreateAsync(user, password);
        Assert.True(create.Succeeded, string.Join(';', create.Errors.Select(x => x.Description)));
        var role = await userManager.AddToRolesAsync(user, roles);
        Assert.True(role.Succeeded, string.Join(';', role.Errors.Select(x => x.Description)));
    }

    private async Task<string> LoginAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private static HttpRequestMessage CreateAuthGet(string path, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record SeedResult(string Password, string SuperAdminEmail, string TenantAdminEmail, string AdminStoreEmail, string ManagerEmail, string CashierEmail, Guid Tenant1Id, DateTimeOffset RangeFrom, DateTimeOffset RangeTo, int ExpectedCompletedSalesInRange, int ExpectedVoidsInRange);
}
