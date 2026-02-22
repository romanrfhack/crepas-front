using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class TenantIsolationIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public TenantIsolationIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SuperAdmin_CanReadGlobalAndTenantScopedKpisReports()
    {
        var setup = await SeedIsolationDataAsync();
        var superAdminToken = await LoginAndGetAccessTokenAsync(setup.SuperAdminEmail, setup.Password);

        using var globalRequest = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/reports/kpis/summary?dateFrom=2026-03-01&dateTo=2026-03-01", superAdminToken);
        using var globalResponse = await _client.SendAsync(globalRequest);
        var globalKpis = await globalResponse.Content.ReadFromJsonAsync<PosKpisSummaryDto>();

        Assert.Equal(HttpStatusCode.OK, globalResponse.StatusCode);
        Assert.NotNull(globalKpis);
        Assert.Equal(2, globalKpis.Tickets);
        Assert.Equal(30m, globalKpis.GrossSales);

        using var tenantARequest = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/reports/kpis/summary?dateFrom=2026-03-01&dateTo=2026-03-01", superAdminToken);
        tenantARequest.Headers.Add("X-Tenant-Id", setup.TenantAId.ToString("D"));
        using var tenantAResponse = await _client.SendAsync(tenantARequest);
        var tenantAKpis = await tenantAResponse.Content.ReadFromJsonAsync<PosKpisSummaryDto>();

        Assert.Equal(HttpStatusCode.OK, tenantAResponse.StatusCode);
        Assert.NotNull(tenantAKpis);
        Assert.Equal(1, tenantAKpis.Tickets);
        Assert.Equal(10m, tenantAKpis.GrossSales);

        using var tenantBRequest = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/reports/kpis/summary?dateFrom=2026-03-01&dateTo=2026-03-01", superAdminToken);
        tenantBRequest.Headers.Add("X-Tenant-Id", setup.TenantBId.ToString("D"));
        using var tenantBResponse = await _client.SendAsync(tenantBRequest);
        var tenantBKpis = await tenantBResponse.Content.ReadFromJsonAsync<PosKpisSummaryDto>();

        Assert.Equal(HttpStatusCode.OK, tenantBResponse.StatusCode);
        Assert.NotNull(tenantBKpis);
        Assert.Equal(1, tenantBKpis.Tickets);
        Assert.Equal(20m, tenantBKpis.GrossSales);
    }

    [Fact]
    public async Task Manager_CannotReadReports_FromAnotherTenantStore()
    {
        var setup = await SeedIsolationDataAsync();
        var managerAToken = await LoginAndGetAccessTokenAsync(setup.ManagerAEmail, setup.Password);

        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/sales/daily?dateFrom=2026-03-01&dateTo=2026-03-01&storeId={setup.StoreBId:D}", managerAToken);
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Manager_CannotOverrideTenantHeader()
    {
        var setup = await SeedIsolationDataAsync();
        var managerAToken = await LoginAndGetAccessTokenAsync(setup.ManagerAEmail, setup.Password);

        using var request = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/reports/kpis/summary?dateFrom=2026-03-01&dateTo=2026-03-01", managerAToken);
        request.Headers.Add("X-Tenant-Id", setup.TenantBId.ToString("D"));

        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SuperAdmin_OperationalEndpoints_RequireTenantSelectionInPlatformMode()
    {
        var setup = await SeedIsolationDataAsync();
        var superAdminToken = await LoginAndGetAccessTokenAsync(setup.SuperAdminEmail, setup.Password);

        using var snapshotWithoutTenant = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", superAdminToken);
        using var snapshotWithoutTenantResponse = await _client.SendAsync(snapshotWithoutTenant);
        var snapshotProblem = await snapshotWithoutTenantResponse.Content.ReadFromJsonAsync<ProblemDetails>();

        Assert.Equal(HttpStatusCode.BadRequest, snapshotWithoutTenantResponse.StatusCode);
        Assert.Equal("tenantId required for this endpoint in platform mode", snapshotProblem?.Title);

        using var adminWithoutTenant = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/admin/categories", superAdminToken);
        using var adminWithoutTenantResponse = await _client.SendAsync(adminWithoutTenant);
        var adminProblem = await adminWithoutTenantResponse.Content.ReadFromJsonAsync<ProblemDetails>();

        Assert.Equal(HttpStatusCode.BadRequest, adminWithoutTenantResponse.StatusCode);
        Assert.Equal("tenantId required for this endpoint in platform mode", adminProblem?.Title);

        using var adminWithTenant = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/admin/categories", superAdminToken);
        adminWithTenant.Headers.Add("X-Tenant-Id", setup.TenantAId.ToString("D"));
        using var adminWithTenantResponse = await _client.SendAsync(adminWithTenant);

        Assert.Equal(HttpStatusCode.OK, adminWithTenantResponse.StatusCode);
    }

    [Fact]
    public async Task Manager_CannotRead_CatalogAvailability_FromAnotherTenantStore()
    {
        var setup = await SeedIsolationDataAsync();
        var managerAToken = await LoginAndGetAccessTokenAsync(setup.ManagerAEmail, setup.Password);

        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/catalog/availability?storeId={setup.StoreBId:D}&type=Product", managerAToken);
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Inventory_Upsert_Enforces_TenantOwnership_And_Allows_SuperAdmin_With_TenantHeader()
    {
        var setup = await SeedIsolationDataAsync();
        var managerAToken = await LoginAndGetAccessTokenAsync(setup.ManagerAEmail, setup.Password);
        var superAdminToken = await LoginAndGetAccessTokenAsync(setup.SuperAdminEmail, setup.Password);

        Guid productId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
            productId = await db.Products.AsNoTracking().Select(x => x.Id).FirstAsync();
        }

        using (var forbiddenRequest = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/inventory", managerAToken))
        {
            forbiddenRequest.Content = JsonContent.Create(new { storeId = setup.StoreBId, productId, onHand = 5m });
            using var forbiddenResponse = await _client.SendAsync(forbiddenRequest);
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);
        }

        using var superRequest = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/inventory", superAdminToken);
        superRequest.Headers.Add("X-Tenant-Id", setup.TenantBId.ToString("D"));
        superRequest.Content = JsonContent.Create(new { storeId = setup.StoreBId, productId, onHand = 5m });
        using var superResponse = await _client.SendAsync(superRequest);
        Assert.Equal(HttpStatusCode.OK, superResponse.StatusCode);
    }

    [Fact]
    public async Task Inventory_Get_Enforces_TenantOwnership_And_Allows_SuperAdmin_With_TenantHeader()
    {
        var setup = await SeedIsolationDataAsync();
        var managerAToken = await LoginAndGetAccessTokenAsync(setup.ManagerAEmail, setup.Password);
        var superAdminToken = await LoginAndGetAccessTokenAsync(setup.SuperAdminEmail, setup.Password);

        using (var forbiddenRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/inventory?storeId={setup.StoreBId:D}", managerAToken))
        {
            using var forbiddenResponse = await _client.SendAsync(forbiddenRequest);
            Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);
        }

        using var superRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/inventory?storeId={setup.StoreBId:D}", superAdminToken);
        superRequest.Headers.Add("X-Tenant-Id", setup.TenantBId.ToString("D"));
        using var superResponse = await _client.SendAsync(superRequest);
        Assert.Equal(HttpStatusCode.OK, superResponse.StatusCode);
    }

    [Fact]
    public async Task PlatformEndpoints_AccessControl_WorksByRole()
    {
        var setup = await SeedIsolationDataAsync();
        var cashierToken = await LoginAndGetAccessTokenAsync(setup.CashierAEmail, setup.Password);
        var managerToken = await LoginAndGetAccessTokenAsync(setup.ManagerAEmail, setup.Password);
        var superAdminToken = await LoginAndGetAccessTokenAsync(setup.SuperAdminEmail, setup.Password);

        using var cashierReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/platform/tenants", cashierToken);
        using var cashierResp = await _client.SendAsync(cashierReq);
        Assert.Equal(HttpStatusCode.Forbidden, cashierResp.StatusCode);

        using var managerReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/platform/tenants", managerToken);
        using var managerResp = await _client.SendAsync(managerReq);
        Assert.Equal(HttpStatusCode.Forbidden, managerResp.StatusCode);

        using var superReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/platform/tenants", superAdminToken);
        using var superResp = await _client.SendAsync(superReq);
        Assert.Equal(HttpStatusCode.OK, superResp.StatusCode);
    }

    private async Task<SeedResult> SeedIsolationDataAsync()
    {
        var password = "User1234!";
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var vertical = new Vertical { Id = Guid.NewGuid(), Name = $"Vertical-{Guid.NewGuid():N}", IsActive = true, CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow };
        var tenantA = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant A", Slug = $"tenant-a-{Guid.NewGuid():N}", IsActive = true, CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow };
        var tenantB = new Tenant { Id = Guid.NewGuid(), VerticalId = vertical.Id, Name = "Tenant B", Slug = $"tenant-b-{Guid.NewGuid():N}", IsActive = true, CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow };
        var storeA = new Store { Id = Guid.NewGuid(), TenantId = tenantA.Id, Name = $"Store A-{Guid.NewGuid():N}", IsActive = true, TimeZoneId = "America/Mexico_City", CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow };
        var storeB = new Store { Id = Guid.NewGuid(), TenantId = tenantB.Id, Name = $"Store B-{Guid.NewGuid():N}", IsActive = true, TimeZoneId = "America/Mexico_City", CreatedAtUtc = DateTimeOffset.UtcNow, UpdatedAtUtc = DateTimeOffset.UtcNow };

        db.Verticals.Add(vertical);
        db.Tenants.AddRange(tenantA, tenantB);
        db.Stores.AddRange(storeA, storeB);
        await db.SaveChangesAsync();

        tenantA.DefaultStoreId = storeA.Id;
        tenantB.DefaultStoreId = storeB.Id;
        await db.SaveChangesAsync();

        var managerAEmail = $"manager.a+{Guid.NewGuid():N}@test.local";
        var managerBEmail = $"manager.b+{Guid.NewGuid():N}@test.local";
        var cashierAEmail = $"cashier.a+{Guid.NewGuid():N}@test.local";
        var superAdminEmail = $"super+{Guid.NewGuid():N}@test.local";

        _ = await RegisterAndGetAccessTokenAsync(managerAEmail, password);
        _ = await RegisterAndGetAccessTokenAsync(managerBEmail, password);
        _ = await RegisterAndGetAccessTokenAsync(cashierAEmail, password);
        _ = await RegisterAndGetAccessTokenAsync(superAdminEmail, password);

        await SetUserRolesAsync(adminToken, managerAEmail, ["Manager"]);
        await SetUserRolesAsync(adminToken, managerBEmail, ["Manager"]);
        await SetUserRolesAsync(adminToken, cashierAEmail, ["Cashier"]);
        await SetUserRolesAsync(adminToken, superAdminEmail, ["SuperAdmin"]);

        var users = await db.Users.Where(x => x.Email == managerAEmail || x.Email == managerBEmail || x.Email == cashierAEmail || x.Email == superAdminEmail).ToListAsync();
        foreach (var user in users)
        {
            if (user.Email == managerAEmail || user.Email == cashierAEmail)
            {
                user.TenantId = tenantA.Id;
            }
            else if (user.Email == managerBEmail)
            {
                user.TenantId = tenantB.Id;
            }
            else
            {
                user.TenantId = null;
            }
        }

        db.PosShifts.AddRange(
            new PosShift { Id = Guid.NewGuid(), StoreId = storeA.Id, TenantId = tenantA.Id, OpenedByUserId = Guid.NewGuid(), OpenedAtUtc = DateTimeOffset.UtcNow, ClosedAtUtc = DateTimeOffset.UtcNow },
            new PosShift { Id = Guid.NewGuid(), StoreId = storeB.Id, TenantId = tenantB.Id, OpenedByUserId = Guid.NewGuid(), OpenedAtUtc = DateTimeOffset.UtcNow, ClosedAtUtc = DateTimeOffset.UtcNow });

        var salesDay = new DateTimeOffset(2026, 3, 1, 12, 0, 0, TimeSpan.Zero);
        db.Sales.AddRange(
            new Sale { Id = Guid.NewGuid(), Folio = $"A-{Guid.NewGuid():N}", StoreId = storeA.Id, TenantId = tenantA.Id, CreatedByUserId = Guid.NewGuid(), OccurredAtUtc = salesDay, Subtotal = 10m, Total = 10m, Status = SaleStatus.Completed },
            new Sale { Id = Guid.NewGuid(), Folio = $"B-{Guid.NewGuid():N}", StoreId = storeB.Id, TenantId = tenantB.Id, CreatedByUserId = Guid.NewGuid(), OccurredAtUtc = salesDay, Subtotal = 20m, Total = 20m, Status = SaleStatus.Completed });

        await db.SaveChangesAsync();

        return new SeedResult(managerAEmail, managerBEmail, cashierAEmail, superAdminEmail, password, tenantA.Id, tenantB.Id, storeA.Id, storeB.Id);
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

        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles", adminToken, new { roles });
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

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string accessToken, object? payload = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (payload is not null)
        {
            request.Content = JsonContent.Create(payload);
        }

        return request;
    }

    private sealed record SeedResult(string ManagerAEmail, string ManagerBEmail, string CashierAEmail, string SuperAdminEmail, string Password, Guid TenantAId, Guid TenantBId, Guid StoreAId, Guid StoreBId);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem([property: JsonPropertyName("id")] string Id);

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
}
