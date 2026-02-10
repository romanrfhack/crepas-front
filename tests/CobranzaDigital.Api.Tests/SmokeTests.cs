using System.Data.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CobranzaDigital.Api.Tests;

public sealed class CobranzaDigitalApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string TestSqliteConnectionString = "Data Source=file:cobranzadigital_test?mode=memory&cache=shared";
    private SqliteConnection? _sqliteConnection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((context, config) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:Sqlite"] = TestSqliteConnectionString,
                ["DatabaseOptions:Provider"] = "Sqlite",
                ["DatabaseOptions:ConnectionStringName"] = "Sqlite",
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
            services.RemoveAll<IDbContextFactory<CobranzaDigitalDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<CobranzaDigitalDbContext>>();
            services.RemoveAll<DbConnection>();
            services.RemoveAll<SqliteConnection>();

            _sqliteConnection = new SqliteConnection(TestSqliteConnectionString);
            _sqliteConnection.Open();

            services.AddSingleton(_sqliteConnection);
            services.AddSingleton<DbConnection>(_sqliteConnection);

            services.AddDbContext<CobranzaDigitalDbContext>(options =>
            {
                options.UseSqlite(_sqliteConnection);
            });
        });
    }

    public async Task InitializeAsync()
    {
        _ = Services;

        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();

        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        await IdentitySeeder.SeedAsync(scope.ServiceProvider, config);
    }

    public Task DisposeAsync()
    {
        _sqliteConnection?.Dispose();

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
        var accessToken = await RegisterAndGetAccessTokenAsync("normal.user@test.local", "User1234!");
        var response = await GetWithBearerTokenAsync("/api/v1/admin/users", accessToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsers_WithAdminToken_ReturnsOk()
    {
        var accessToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        AssertTokenHasRole(accessToken, "Admin");

        var response = await GetWithBearerTokenAsync("/api/v1/admin/users", accessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Register_AssignsUserRole()
    {
        var _ = await RegisterAndGetAccessTokenAsync("role.check@test.local", "User1234!");
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        AssertTokenHasRole(adminToken, "Admin");

        var response = await GetWithBearerTokenAsync("/api/v1/admin/users?search=role.check@test.local", adminToken);
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
        AssertTokenHasRole(adminToken, "Admin");
        var userId = await GetUserIdByEmailAsync(adminToken, "empty.roles@test.local");

        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles")
        {
            Content = JsonContent.Create(new { roles = Array.Empty<string>() })
        };
        SetBearerAuthorization(adminToken);

        var response = await _client.SendAsync(request);
        _client.DefaultRequestHeaders.Authorization = null;

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<string> RegisterAndGetAccessTokenAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        var rawBody = await response.Content.ReadAsStringAsync();

        Assert.True(
            response.IsSuccessStatusCode,
            $"Expected register to return 200 for {email} but got {(int)response.StatusCode} ({response.StatusCode}). Body: {rawBody}");

        var body = JsonSerializer.Deserialize<AuthTokensResponse>(rawBody, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.False(body!.AccessToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));

        return body!.AccessToken;
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var rawBody = await response.Content.ReadAsStringAsync();

        Assert.True(
            response.IsSuccessStatusCode,
            $"Expected login to return 200 for {email} but got {(int)response.StatusCode} ({response.StatusCode}). Body: {rawBody}");

        var body = JsonSerializer.Deserialize<AuthTokensResponse>(rawBody, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.False(body!.AccessToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));

        return body!.AccessToken;
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        var response = await GetWithBearerTokenAsync($"/api/v1/admin/users?search={Uri.EscapeDataString(email)}", adminToken);
        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);

        return payload!.Items.Single().Id;
    }

    private async Task<HttpResponseMessage> GetWithBearerTokenAsync(string uri, string accessToken)
    {
        SetBearerAuthorization(accessToken);
        var response = await _client.GetAsync(uri);
        _client.DefaultRequestHeaders.Authorization = null;

        return response;
    }

    private void SetBearerAuthorization(string accessToken)
    {
        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        Assert.False(accessToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    }

    private static void AssertTokenHasRole(string accessToken, string role)
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
        var hasRole = jwt.Claims.Any(claim => claim.Type == ClaimTypes.Role && string.Equals(claim.Value, role, StringComparison.Ordinal));

        Assert.True(hasRole, $"Expected admin JWT to contain role claim '{ClaimTypes.Role}={role}'.");
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);

    private sealed record PagedResponse(int Total, List<UserItem> Items);

    private sealed record UserItem(string Id, string Email, string UserName, List<string> Roles, bool IsLockedOut, DateTimeOffset? LockoutEnd);
}
