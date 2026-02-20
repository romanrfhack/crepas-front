using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

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
        using var request = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/admin/users/roles", adminToken, new { email, roles });
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
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
}
