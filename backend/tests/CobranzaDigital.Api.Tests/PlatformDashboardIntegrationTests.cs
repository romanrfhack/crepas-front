using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PlatformDashboardIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public PlatformDashboardIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task PlatformDashboard_Endpoints_AccessControl_WorksByRole()
    {
        var seed = await SeedDashboardDataAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        foreach (var email in new[] { seed.TenantAdminEmail, seed.AdminStoreEmail, seed.ManagerEmail, seed.CashierEmail })
        {
            var token = await LoginAsync(email, seed.Password);
            using var forbiddenRequest = CreateAuthGet("/api/v1/platform/dashboard/summary", token);
            using var forbiddenResponse = await _client.SendAsync(forbiddenRequest);
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);
        }

        foreach (var path in new[]
                 {
                     "/api/v1/platform/dashboard/summary",
                     "/api/v1/platform/dashboard/top-tenants",
                     "/api/v1/platform/dashboard/alerts",
                     "/api/v1/platform/dashboard/recent-inventory-adjustments",
                     "/api/v1/platform/dashboard/out-of-stock"
                 })
        {
            using var request = CreateAuthGet(path, superToken);
            using var response = await _client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task PlatformDashboard_Summary_ReturnsExpectedMetrics()
    {
        var seed = await SeedDashboardDataAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet($"/api/v1/platform/dashboard/summary?threshold=5", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformDashboardSummaryDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(1, payload!.UsersWithoutStoreAssignment);
        Assert.Equal(1, payload.TenantsWithoutCatalogTemplate);
        Assert.Equal(1, payload.StoresWithoutAdminStore);
        Assert.True(payload.SalesTodayAmount >= 300m);
        Assert.True(payload.SalesLast7DaysAmount >= payload.SalesTodayAmount);
        Assert.Equal(1, payload.OpenShiftsCount);
        Assert.Equal(1, payload.OutOfStockItemsCount);
        Assert.Equal(1, payload.LowStockItemsCount);
    }

    [Fact]
    public async Task PlatformDashboard_TopTenants_OrdersBySales()
    {
        var seed = await SeedDashboardDataAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet("/api/v1/platform/dashboard/top-tenants?top=2", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformTopTenantsResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Equal(2, payload!.Items.Count);
        Assert.True(payload.Items[0].SalesAmount >= payload.Items[1].SalesAmount);
        Assert.Equal(seed.Tenant1Id, payload.Items[0].TenantId);
    }

    [Fact]
    public async Task PlatformDashboard_Alerts_DetectsConfigurationIssues()
    {
        var seed = await SeedDashboardDataAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet("/api/v1/platform/dashboard/alerts", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformDashboardAlertsResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Contains(payload!.Alerts, x => x.Code == "TENANT_WITHOUT_TEMPLATE" && x.Count >= 1);
        Assert.Contains(payload.Alerts, x => x.Code == "STORE_WITHOUT_ADMINSTORE" && x.Count >= 1);
        Assert.Contains(payload.Alerts, x => x.Code == "STORE_SCOPED_USER_WITHOUT_STORE" && x.Count >= 1);
    }

    [Fact]
    public async Task PlatformDashboard_RecentInventoryAdjustments_ReturnsRecentAndFilters()
    {
        var seed = await SeedDashboardDataAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet($"/api/v1/platform/dashboard/recent-inventory-adjustments?take=1&tenantId={seed.Tenant1Id:D}", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformRecentInventoryAdjustmentsResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
        Assert.Equal(seed.Tenant1Id, payload.Items[0].TenantId);
    }

    [Fact]
    public async Task PlatformDashboard_OutOfStock_ReturnsTrackedAndFilters()
    {
        var seed = await SeedDashboardDataAsync();
        var superToken = await LoginAsync(seed.SuperAdminEmail, seed.Password);

        using var request = CreateAuthGet($"/api/v1/platform/dashboard/out-of-stock?tenantId={seed.Tenant1Id:D}&itemType=Product", superToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PlatformOutOfStockResponseDto>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
        Assert.Equal("Product", payload.Items[0].ItemType);
        Assert.True(payload.Items[0].StockOnHandQty <= 0m);
    }

    private async Task<SeedResult> SeedDashboardDataAsync()
    {
        var password = "Dash1234!";
        var now = DateTimeOffset.UtcNow;

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var vertical = new Vertical { Id = Guid.NewGuid(), Name = $"Vertical-{Guid.NewGuid():N}", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant1 = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant 1", Slug = $"tenant-1-{Guid.NewGuid():N}", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var tenant2 = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant 2", Slug = $"tenant-2-{Guid.NewGuid():N}", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        var store1 = new Store { Id = Guid.NewGuid(), TenantId = tenant1.Id, Name = "Store 1", IsActive = true, TimeZoneId = "America/Mexico_City", CreatedAtUtc = now, UpdatedAtUtc = now };
        var store2 = new Store { Id = Guid.NewGuid(), TenantId = tenant2.Id, Name = "Store 2", IsActive = true, TimeZoneId = "America/Mexico_City", CreatedAtUtc = now, UpdatedAtUtc = now };

        tenant1.DefaultStoreId = store1.Id;
        tenant2.DefaultStoreId = store2.Id;

        var template = new CatalogTemplate { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Template", Version = "1", IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        db.Verticals.Add(vertical);
        db.Tenants.AddRange(tenant1, tenant2);
        db.Stores.AddRange(store1, store2);
        db.CatalogTemplates.Add(template);
        db.TenantCatalogTemplates.Add(new TenantCatalogTemplate { TenantId = tenant1.Id, CatalogTemplateId = template.Id, UpdatedAtUtc = now });

        var category = new Category { Id = Guid.NewGuid(), CatalogTemplateId = template.Id, Name = "Bebidas", SortOrder = 1, IsActive = true, UpdatedAtUtc = now };
        var productOut = new Product { Id = Guid.NewGuid(), CatalogTemplateId = template.Id, CategoryId = category.Id, Name = "P1", ExternalCode = "P1", BasePrice = 10m, IsActive = true, IsAvailable = true, IsInventoryTracked = true };
        var productLow = new Product { Id = Guid.NewGuid(), CatalogTemplateId = template.Id, CategoryId = category.Id, Name = "P2", ExternalCode = "P2", BasePrice = 10m, IsActive = true, IsAvailable = true, IsInventoryTracked = true };
        db.Categories.Add(category);
        db.Products.AddRange(productOut, productLow);

        db.Sales.AddRange(
            new Sale { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, Folio = "S1", OccurredAtUtc = now, Currency = "MXN", Subtotal = 200m, Total = 200m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, Folio = "S2", OccurredAtUtc = now, Currency = "MXN", Subtotal = 100m, Total = 100m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed },
            new Sale { Id = Guid.NewGuid(), TenantId = tenant2.Id, StoreId = store2.Id, Folio = "S3", OccurredAtUtc = now, Currency = "MXN", Subtotal = 50m, Total = 50m, CreatedByUserId = Guid.NewGuid(), Status = SaleStatus.Completed });

        db.PosShifts.Add(new PosShift { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, OpenedAtUtc = now, OpenedByUserId = Guid.NewGuid(), OpeningCashAmount = 100m });

        db.CatalogInventoryBalances.AddRange(
            new CatalogInventoryBalance { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, ItemType = CatalogItemType.Product, ItemId = productOut.Id, OnHandQty = 0m, UpdatedAtUtc = now },
            new CatalogInventoryBalance { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, ItemType = CatalogItemType.Product, ItemId = productLow.Id, OnHandQty = 2m, UpdatedAtUtc = now });

        db.CatalogInventoryAdjustments.AddRange(
            new CatalogInventoryAdjustment { Id = Guid.NewGuid(), TenantId = tenant1.Id, StoreId = store1.Id, ItemType = CatalogItemType.Product, ItemId = productOut.Id, QtyBefore = 5m, DeltaQty = -5m, ResultingOnHandQty = 0m, Reason = "SaleConsumption", CreatedAtUtc = now.AddMinutes(-5), CreatedByUserId = Guid.NewGuid() },
            new CatalogInventoryAdjustment { Id = Guid.NewGuid(), TenantId = tenant2.Id, StoreId = store2.Id, ItemType = CatalogItemType.Product, ItemId = productOut.Id, QtyBefore = 4m, DeltaQty = -1m, ResultingOnHandQty = 3m, Reason = "Correction", CreatedAtUtc = now.AddMinutes(-10), CreatedByUserId = Guid.NewGuid() });

        await db.SaveChangesAsync();

        var superEmail = $"super-{Guid.NewGuid():N}@test.local";
        var tenantAdminEmail = $"ta-{Guid.NewGuid():N}@test.local";
        var adminStoreEmail = $"as-{Guid.NewGuid():N}@test.local";
        var managerEmail = $"mg-{Guid.NewGuid():N}@test.local";
        var cashierEmail = $"ca-{Guid.NewGuid():N}@test.local";
        var orphanManagerEmail = $"orphan-{Guid.NewGuid():N}@test.local";

        await CreateUserAsync(userManager, superEmail, password, ["SuperAdmin"], null, null);
        await CreateUserAsync(userManager, tenantAdminEmail, password, ["TenantAdmin"], tenant1.Id, null);
        await CreateUserAsync(userManager, adminStoreEmail, password, ["AdminStore"], tenant1.Id, store1.Id);
        await CreateUserAsync(userManager, managerEmail, password, ["Manager"], tenant1.Id, store1.Id);
        await CreateUserAsync(userManager, cashierEmail, password, ["Cashier"], tenant1.Id, store1.Id);
        await CreateUserAsync(userManager, orphanManagerEmail, password, ["Manager"], tenant1.Id, null);

        return new SeedResult(password, superEmail, tenantAdminEmail, adminStoreEmail, managerEmail, cashierEmail, tenant1.Id);
    }

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
    private sealed record SeedResult(string Password, string SuperAdminEmail, string TenantAdminEmail, string AdminStoreEmail, string ManagerEmail, string CashierEmail, Guid Tenant1Id);
}
