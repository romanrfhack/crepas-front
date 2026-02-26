using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PlatformTenantCreationIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public PlatformTenantCreationIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateTenant_CreatesTenantAndHeadquartersStore_AndAssignsDefaultStore()
    {
        var password = "Platform1234!";
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var platformEmail = $"platform+{Guid.NewGuid():N}@test.local";

        _ = await RegisterAndGetAccessTokenAsync(platformEmail, password);
        await SetUserRolesAsync(adminToken, platformEmail, ["SuperAdmin"]);
        var platformToken = await LoginAndGetAccessTokenAsync(platformEmail, password);

        var verticalId = await SeedVerticalAsync();
        var tenantName = $"Tenant-{Guid.NewGuid():N}";
        var tenantSlug = $"tenant-{Guid.NewGuid():N}";

        using var createRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/v1/platform/tenants",
            platformToken,
            new
            {
                verticalId,
                name = tenantName,
                slug = tenantSlug,
                timeZoneId = "America/Mexico_City"
            });

        using var createResponse = await _client.SendAsync(createRequest);
        var createdTenant = await createResponse.Content.ReadFromJsonAsync<Tenant>();

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        Assert.NotNull(createdTenant);
        Assert.Equal(tenantName, createdTenant!.Name);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var dbTenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == createdTenant.Id);
        var headquartersStore = await db.Stores.AsNoTracking().SingleAsync(x => x.TenantId == createdTenant.Id && x.Name == $"{tenantName} Matriz");

        Assert.Equal(headquartersStore.Id, dbTenant.DefaultStoreId);
    }

    private async Task<Guid> SeedVerticalAsync()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var vertical = new Vertical
        {
            Id = Guid.NewGuid(),
            Name = $"Vertical-{Guid.NewGuid():N}",
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

        db.Verticals.Add(vertical);
        await db.SaveChangesAsync();

        return vertical.Id;
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
        await EnsureUserScopeForRolesAsync(email, roles);
        var userId = await GetUserIdByEmailAsync(adminToken, email);

        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles", adminToken, new { roles });
        using var response = await _client.SendAsync(request);

        Assert.True(response.StatusCode is HttpStatusCode.NoContent or HttpStatusCode.OK);
    }


    private async Task EnsureUserScopeForRolesAsync(string email, IReadOnlyCollection<string> roles)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);

        var requiresTenant = roles.Any(role => string.Equals(role, "TenantAdmin", StringComparison.OrdinalIgnoreCase))
            || roles.Any(role => string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase)
                || string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
                || string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase)
                || string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase));
        var requiresStore = roles.Any(role => string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase));
        var isSuperAdmin = roles.Any(role => string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase));

        if (isSuperAdmin)
        {
            user!.TenantId = null;
            user.StoreId = null;
        }
        else
        {
            if (requiresTenant && !user!.TenantId.HasValue)
            {
                user.TenantId = await db.Tenants.AsNoTracking().OrderBy(x => x.Name).Select(x => (Guid?)x.Id).FirstOrDefaultAsync();
            }

            if (requiresStore && !user.StoreId.HasValue)
            {
                user.StoreId = await db.Stores.AsNoTracking()
                    .Where(x => user.TenantId.HasValue && x.TenantId == user.TenantId.Value)
                    .OrderBy(x => x.Name)
                    .Select(x => (Guid?)x.Id)
                    .FirstOrDefaultAsync();
            }
        }

        var update = await userManager.UpdateAsync(user!);
        Assert.True(update.Succeeded, string.Join("; ", update.Errors.Select(x => x.Description)));
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

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem(string Id);
}
