using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CobranzaDigital.Api.Tests;

public sealed class CobranzaDigitalApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _sqliteConnectionString = $"Data Source={Path.Combine(Path.GetTempPath(), $"cobranza-tests-{Guid.NewGuid():N}.db")}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((context, config) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:SqlServer"] = _sqliteConnectionString,
                ["DatabaseOptions:ConnectionStringName"] = "SqlServer",
                ["Features:UserAdmin"] = "true",
                ["IdentitySeed:AdminEmail"] = "admin@test.local",
                ["IdentitySeed:AdminPassword"] = "Admin1234!",
                ["Jwt:SigningKey"] = "THIS_IS_A_SECURE_TEST_SIGNING_KEY_123456"
            };

            config.AddInMemoryCollection(settings);
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<CobranzaDigitalDbContext>>();
            services.RemoveAll<CobranzaDigitalDbContext>();

            services.AddDbContext<CobranzaDigitalDbContext>(options =>
            {
                options.UseSqlite(_sqliteConnectionString);
            });

            var serviceProvider = services.BuildServiceProvider();
            using var scope = serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
            dbContext.Database.EnsureDeleted();
            dbContext.Database.EnsureCreated();
        });
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync()
    {
        if (File.Exists(_sqliteConnectionString.Replace("Data Source=", string.Empty, StringComparison.Ordinal)))
        {
            File.Delete(_sqliteConnectionString.Replace("Data Source=", string.Empty, StringComparison.Ordinal));
        }

        return Task.CompletedTask;
    }
}

public sealed class SmokeTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public SmokeTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task LiveHealth_ReturnsOk()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsers_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/admin/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsers_WithNormalUserToken_ReturnsForbidden()
    {
        var token = await RegisterAndGetAccessTokenAsync("normal.user@test.local", "User1234!");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsers_WithAdminToken_ReturnsOk()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Register_AssignsUserRole()
    {
        var _ = await RegisterAndGetAccessTokenAsync("role.check@test.local", "User1234!");
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/users?search=role.check@test.local");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);

        var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);
        Assert.Contains("User", payload.Items[0].Roles);
    }

    [Fact]
    public async Task PutRoles_WithEmptyRoles_ReturnsBadRequest()
    {
        var userToken = await RegisterAndGetAccessTokenAsync("empty.roles@test.local", "User1234!");
        Assert.False(string.IsNullOrWhiteSpace(userToken));

        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var userId = await GetUserIdByEmailAsync(adminToken, "empty.roles@test.local");

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles")
        {
            Content = JsonContent.Create(new { roles = Array.Empty<string>() })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<string> RegisterAndGetAccessTokenAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        var body = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);

        return body!.AccessToken;
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var body = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);

        return body!.AccessToken;
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/admin/users?search={Uri.EscapeDataString(email)}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);

        var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);

        return payload!.Items.Single().Id;
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);

    private sealed record PagedResponse(int Total, List<UserItem> Items);

    private sealed record UserItem(string Id, string Email, string UserName, List<string> Roles, bool IsLockedOut, DateTimeOffset? LockoutEnd);
}
