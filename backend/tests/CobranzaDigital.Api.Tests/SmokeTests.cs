using System.Data.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using CobranzaDigital.Application.Contracts.Auth;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Options;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CobranzaDigital.Api.Tests;

public sealed class CobranzaDigitalApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string TestJwtIssuer = "CobranzaDigital.Tests";
    private const string TestJwtAudience = "CobranzaDigital.Tests.Api";
    private const string TestJwtSigningKey = "THIS_IS_A_SECURE_TEST_SIGNING_KEY_123456";
    private readonly string _sqliteConnectionString = $"Data Source=file:{Guid.NewGuid():N}?mode=memory&cache=shared";
    private readonly SemaphoreSlim _initializationLock = new(1, 1);
    private SqliteConnection? _sqliteConnection;
    private bool _isInitialized;
    private static readonly string ApiContentRoot = ResolveApiContentRoot();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseContentRoot(ApiContentRoot);
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.Sources.Clear();
            config.SetBasePath(ApiContentRoot);
            config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: false);
            config.AddJsonFile("appsettings.Testing.json", optional: true, reloadOnChange: false);

            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:Sqlite"] = _sqliteConnectionString,
                ["DatabaseOptions:Provider"] = "Sqlite",
                ["DatabaseOptions:ConnectionStringName"] = "Sqlite",
                ["Features:UserAdmin"] = "true",
                ["IdentitySeed:AdminEmail"] = "admin@test.local",
                ["IdentitySeed:AdminPassword"] = "Admin1234!",
                // NOTE: tests must force deterministic JWT values to avoid token validation drift.
                ["Jwt:Issuer"] = TestJwtIssuer,
                ["Jwt:Audience"] = TestJwtAudience,
                ["Jwt:SigningKey"] = TestJwtSigningKey,
                ["Jwt:Key"] = TestJwtSigningKey,
                ["Jwt:AccessTokenMinutes"] = "15",
                ["Jwt:RefreshTokenDays"] = "7",
                ["JwtSettings:Issuer"] = TestJwtIssuer,
                ["JwtSettings:Audience"] = TestJwtAudience,
                ["JwtSettings:SigningKey"] = TestJwtSigningKey,
                ["JwtSettings:Key"] = TestJwtSigningKey,
                ["Authentication:Jwt:Issuer"] = TestJwtIssuer,
                ["Authentication:Jwt:Audience"] = TestJwtAudience,
                ["Authentication:Jwt:SigningKey"] = TestJwtSigningKey,
                ["Authentication:Jwt:Key"] = TestJwtSigningKey
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

            _sqliteConnection = new SqliteConnection(_sqliteConnectionString);
            _sqliteConnection.Open();

            services.AddSingleton(_sqliteConnection);
            services.AddSingleton<DbConnection>(_sqliteConnection);

            services.AddDbContext<CobranzaDigitalDbContext>(options =>
            {
                options.UseSqlite(_sqliteConnection);
            });

            services.PostConfigureAll<JwtBearerOptions>(options =>
            {
                options.IncludeErrorDetails = true;
                options.TokenValidationParameters ??= new TokenValidationParameters();
                options.TokenValidationParameters.ValidateIssuer = true;
                options.TokenValidationParameters.ValidIssuer = TestJwtIssuer;
                options.TokenValidationParameters.ValidateAudience = true;
                options.TokenValidationParameters.ValidAudience = TestJwtAudience;
                options.TokenValidationParameters.ValidateIssuerSigningKey = true;
                options.TokenValidationParameters.IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSigningKey));

                var previousEvents = options.Events ?? new JwtBearerEvents();
                var previousOnAuthenticationFailed = previousEvents.OnAuthenticationFailed;
                var previousOnChallenge = previousEvents.OnChallenge;

                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = async context =>
                    {
                        Console.WriteLine($"[jwt-auth-failed] Exception while validating bearer token: {context.Exception}");
                        Console.WriteLine($"[jwt-auth-failed] {DescribeTokenValidationParameters(context.Options.TokenValidationParameters)}");

                        if (previousOnAuthenticationFailed is not null)
                        {
                            await previousOnAuthenticationFailed(context).ConfigureAwait(false);
                        }
                    },
                    OnChallenge = async context =>
                    {
                        if (context.AuthenticateFailure is not null)
                        {
                            Console.WriteLine($"[jwt-challenge] AuthenticateFailure detected: {context.AuthenticateFailure}");
                        }
                        else
                        {
                            Console.WriteLine("[jwt-challenge] Challenge emitted without AuthenticateFailure (likely missing/invalid token). ");
                        }

                        Console.WriteLine($"[jwt-challenge] {DescribeTokenValidationParameters(context.Options.TokenValidationParameters)}");

                        if (previousOnChallenge is not null)
                        {
                            await previousOnChallenge(context).ConfigureAwait(false);
                        }
                    },
                    OnForbidden = previousEvents.OnForbidden,
                    OnMessageReceived = previousEvents.OnMessageReceived,
                    OnTokenValidated = previousEvents.OnTokenValidated
                };

                Console.WriteLine($"[jwt-post-configure] {DescribeTokenValidationParameters(options.TokenValidationParameters)}");
            });
        });
    }

    private static string DescribeTokenValidationParameters(TokenValidationParameters? parameters)
    {
        if (parameters is null)
        {
            return "TokenValidationParameters=<null>";
        }

        static string JoinValues(IEnumerable<string>? values) => values is null ? "<null>" : string.Join(",", values);

        var signingKeyDescription = parameters.IssuerSigningKey switch
        {
            null => "<null>",
            SymmetricSecurityKey symmetricKey =>
                $"{nameof(SymmetricSecurityKey)}(KeySize={symmetricKey.KeySize}, Bytes={symmetricKey.Key?.Length ?? 0})",
            _ => $"{parameters.IssuerSigningKey.GetType().Name}(KeyId='" +
                 $"{parameters.IssuerSigningKey.KeyId ?? "<null>"}')"
        };

        return
            $"TVP ValidateIssuer={parameters.ValidateIssuer}, ValidIssuer='{parameters.ValidIssuer ?? "<null>"}', ValidIssuers='{JoinValues(parameters.ValidIssuers)}', " +
            $"ValidateAudience={parameters.ValidateAudience}, ValidAudience='{parameters.ValidAudience ?? "<null>"}', ValidAudiences='{JoinValues(parameters.ValidAudiences)}', " +
            $"ValidateLifetime={parameters.ValidateLifetime}, ClockSkew={parameters.ClockSkew}, " +
            $"ValidateIssuerSigningKey={parameters.ValidateIssuerSigningKey}, IssuerSigningKey={signingKeyDescription}, " +
            $"RoleClaimType='{parameters.RoleClaimType}', NameClaimType='{parameters.NameClaimType}'";
    }

    private static string ResolveApiContentRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);

        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "src", "CobranzaDigital.Api");
            var programPath = Path.Combine(candidate, "Program.cs");
            if (File.Exists(programPath))
            {
                return candidate;
            }

            var solutionPath = Path.Combine(current.FullName, "CobranzaDigital.sln");
            if (File.Exists(solutionPath))
            {
                break;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException(
            $"Unable to locate API content root from '{AppContext.BaseDirectory}'. Expected 'src/CobranzaDigital.Api/Program.cs' near CobranzaDigital.sln.");
    }

    private static string FormatRouteEndpoint(RouteEndpoint endpoint)
    {
        var routePattern = endpoint.RoutePattern.RawText ?? "<null>";
        var displayName = string.IsNullOrWhiteSpace(endpoint.DisplayName) ? "<null>" : endpoint.DisplayName;

        return $"- RoutePattern='{routePattern}', DisplayName='{displayName}'";
    }

    public async Task InitializeAsync()
    {
        await _initializationLock.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_isInitialized)
            {
                return;
            }

            _ = Services;

            using var scope = Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
            
            if (dbContext.Database.IsSqlite())
            {
                await dbContext.Database.EnsureCreatedAsync().ConfigureAwait(false);
            }
            else
            {
                await dbContext.Database.MigrateAsync().ConfigureAwait(false);
            }


            var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
            await IdentitySeeder.SeedAsync(scope.ServiceProvider, config).ConfigureAwait(false);

            var jwtOptions = scope.ServiceProvider.GetRequiredService<IOptions<JwtOptions>>().Value;
            var schemeProvider = scope.ServiceProvider.GetRequiredService<IAuthenticationSchemeProvider>();
            var defaultAuthenticate = await schemeProvider.GetDefaultAuthenticateSchemeAsync().ConfigureAwait(false);
            var defaultChallenge = await schemeProvider.GetDefaultChallengeSchemeAsync().ConfigureAwait(false);

            Console.WriteLine(
                $"[test-host] Jwt effective config: Issuer='{jwtOptions.Issuer}', Audience='{jwtOptions.Audience}', SigningKeyLength={jwtOptions.SigningKey.Length}, AccessTokenMinutes={jwtOptions.AccessTokenMinutes}, RefreshTokenDays={jwtOptions.RefreshTokenDays}");
            Console.WriteLine(
                $"[test-host] Raw config keys: Jwt:Issuer='{config["Jwt:Issuer"]}', JwtSettings:Issuer='{config["JwtSettings:Issuer"]}', Authentication:Jwt:Issuer='{config["Authentication:Jwt:Issuer"]}', Jwt:Audience='{config["Jwt:Audience"]}', JwtSettings:Audience='{config["JwtSettings:Audience"]}', Authentication:Jwt:Audience='{config["Authentication:Jwt:Audience"]}', Jwt:SigningKey.Length={config["Jwt:SigningKey"]?.Length ?? 0}, JwtSettings:SigningKey.Length={config["JwtSettings:SigningKey"]?.Length ?? 0}, Authentication:Jwt:SigningKey.Length={config["Authentication:Jwt:SigningKey"]?.Length ?? 0}");
            Console.WriteLine(
                $"[test-host] Auth schemes: DefaultAuthenticate='{defaultAuthenticate?.Name ?? "<null>"}', DefaultChallenge='{defaultChallenge?.Name ?? "<null>"}'");

            var endpointDataSource = scope.ServiceProvider.GetRequiredService<EndpointDataSource>();
            var authEndpoints = new[]
            {
                "api/v{version:apiVersion}/auth/login",
                "api/v{version:apiVersion}/auth/register",
                "api/v{version:apiVersion}/auth/refresh"
            };

            var routeEndpoints = endpointDataSource.Endpoints.OfType<RouteEndpoint>().ToArray();

            foreach (var route in authEndpoints)
            {
                var endpoint = routeEndpoints.FirstOrDefault(e =>
                    string.Equals(e.RoutePattern.RawText, route, StringComparison.Ordinal));

                if (endpoint is null)
                {
                    var availableEndpoints = routeEndpoints.Length == 0
                        ? "<none>"
                        : string.Join(Environment.NewLine, routeEndpoints.Select(FormatRouteEndpoint));

                    throw new InvalidOperationException(
                        $"Could not find auth route endpoint with RoutePattern.RawText '{route}' while initializing smoke tests.{Environment.NewLine}" +
                        $"Available route endpoints ({routeEndpoints.Length}):{Environment.NewLine}{availableEndpoints}");
                }

                var hasAllowAnonymous = endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null;
                Console.WriteLine($"[test-host] Endpoint '{route}' has [AllowAnonymous]: {hasAllowAnonymous}");
            }

            _isInitialized = true;
        }
        finally
        {
            _initializationLock.Release();
        }
    }

    public override async ValueTask DisposeAsync()
    {
        _sqliteConnection?.Dispose();

        await base.DisposeAsync().ConfigureAwait(false);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync().ConfigureAwait(false);
    }
}

public sealed class SmokeTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public SmokeTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task LiveHealthReturnsOk()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsersWithoutTokenReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/v1/admin/users");
        await LogUnauthorizedResponseAsync(response, "/api/v1/admin/users", authorizationHeader: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TokenIssuedByJwtTokenServiceIsAcceptedByJwtBearer()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var adminUser = await dbContext.Users
            .AsNoTracking()
            .SingleAsync(user => user.Email == "admin@test.local")
            .ConfigureAwait(false);

        var authResponse = await tokenService.CreateTokensAsync(
            new IdentityUserInfo(adminUser.Id.ToString(), adminUser.Email!, Array.Empty<string>()))
            .ConfigureAwait(false);

        var response = await GetWithBearerTokenAsync("/api/v1/admin/users", authResponse.AccessToken).ConfigureAwait(false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }


    [Fact]
    public void AuthEndpointsAreAllowAnonymousAndNoFallbackPolicy()
    {
        using var scope = _factory.Services.CreateScope();
        var authOptions = scope.ServiceProvider.GetRequiredService<IOptions<AuthorizationOptions>>().Value;
        Assert.Null(authOptions.FallbackPolicy);

        var endpointDataSource = scope.ServiceProvider.GetRequiredService<EndpointDataSource>();
        var authRoutes = new[]
        {
            "api/v{version:apiVersion}/auth/login",
            "api/v{version:apiVersion}/auth/register",
            "api/v{version:apiVersion}/auth/refresh"
        };

        foreach (var route in authRoutes)
        {
            var endpoint = endpointDataSource.Endpoints
                .OfType<RouteEndpoint>()
                .FirstOrDefault(e => string.Equals(e.RoutePattern.RawText, route, StringComparison.Ordinal));

            Assert.NotNull(endpoint);

            Assert.True(
                endpoint!.Metadata.GetMetadata<IAllowAnonymous>() is not null,
                $"Endpoint '{route}' must be [AllowAnonymous] in tests to keep login/register/refresh public.");
        }
    }


    [Fact]
    public void ProgramUsesAuthenticationMiddlewareInCorrectOrder()
    {
        using var scope = _factory.Services.CreateScope();
        var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
        var programPath = Path.Combine(env.ContentRootPath, "Program.cs");
        var programSource = File.ReadAllText(programPath);

        var useRoutingIndex = programSource.IndexOf("app.UseRouting();", StringComparison.Ordinal);
        var useAuthenticationIndex = programSource.IndexOf("app.UseAuthentication();", StringComparison.Ordinal);
        var useAuthorizationIndex = programSource.IndexOf("app.UseAuthorization();", StringComparison.Ordinal);
        var mapControllersIndex = programSource.IndexOf("app.MapControllers();", StringComparison.Ordinal);

        Assert.True(useRoutingIndex >= 0, "Program.cs must call app.UseRouting().");
        Assert.True(useAuthenticationIndex > useRoutingIndex, "app.UseAuthentication() must be after app.UseRouting().");
        Assert.True(useAuthorizationIndex > useAuthenticationIndex, "app.UseAuthorization() must be after app.UseAuthentication().");
        Assert.True(mapControllersIndex > useAuthorizationIndex, "app.MapControllers() must be after app.UseAuthorization().");
    }

    [Fact]
    public async Task AdminUsersWithNormalUserTokenReturnsForbidden()
    {
        var accessToken = await RegisterAndGetAccessTokenAsync("normal.user@test.local", "User1234!");
        var response = await GetWithBearerTokenAsync("/api/v1/admin/users", accessToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsersWithAdminTokenReturnsOk()
    {
        var accessToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        AssertTokenHasRole(accessToken, "Admin");

        var response = await GetWithBearerTokenAsync("/api/v1/admin/users", accessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RegisterAssignsUserRole()
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
    public async Task PutRolesWithEmptyRolesReturnsBadRequest()
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
        var authorizationHeader = _client.DefaultRequestHeaders.Authorization?.ToString();

        var response = await _client.SendAsync(request);
        await LogUnauthorizedResponseAsync(response, $"/api/v1/admin/users/{userId}/roles", authorizationHeader);
        _client.DefaultRequestHeaders.Authorization = null;

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<string> RegisterAndGetAccessTokenAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password }).ConfigureAwait(false);
        await LogUnauthorizedResponseAsync(response, "/api/v1/auth/register", authorizationHeader: null).ConfigureAwait(false);
        var rawBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

        Assert.True(
            response.IsSuccessStatusCode,
            $"Expected register to return 200 for {email} but got {(int)response.StatusCode} ({response.StatusCode}). Body: {rawBody}");

        var body = JsonSerializer.Deserialize<AuthTokensResponse>(rawBody, JsonOptions);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.False(body!.AccessToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));

        return body!.AccessToken;
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password }).ConfigureAwait(false);
        await LogUnauthorizedResponseAsync(response, "/api/v1/auth/login", authorizationHeader: null).ConfigureAwait(false);
        var rawBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

        Assert.True(
            response.IsSuccessStatusCode,
            $"Expected login to return 200 for {email} but got {(int)response.StatusCode} ({response.StatusCode}). Body: {rawBody}");

        var body = JsonSerializer.Deserialize<AuthTokensResponse>(rawBody, JsonOptions);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.False(body!.AccessToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));

        return body!.AccessToken;
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        var response = await GetWithBearerTokenAsync($"/api/v1/admin/users?search={Uri.EscapeDataString(email)}", adminToken).ConfigureAwait(false);
        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>().ConfigureAwait(false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);

        return payload!.Items.Single().Id;
    }

    private async Task<HttpResponseMessage> GetWithBearerTokenAsync(string uri, string accessToken)
    {
        if (uri.Contains("/api/v1/admin/users", StringComparison.OrdinalIgnoreCase))
        {
            LogJwtPayloadWithoutValidation(accessToken, uri);
        }

        SetBearerAuthorization(accessToken);
        var authorizationHeader = _client.DefaultRequestHeaders.Authorization?.ToString();
        var response = await _client.GetAsync(uri).ConfigureAwait(false);
        await LogUnauthorizedResponseAsync(response, uri, authorizationHeader).ConfigureAwait(false);
        _client.DefaultRequestHeaders.Authorization = null;

        return response;
    }

    private static void LogJwtPayloadWithoutValidation(string accessToken, string endpoint)
    {
        var token = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
        var exp = token.Payload.Expiration is long expValue
            ? DateTimeOffset.FromUnixTimeSeconds(expValue).ToString("O")
            : "<missing>";
        var nbf = token.Payload.NotBefore is long nbfValue
            ? DateTimeOffset.FromUnixTimeSeconds(nbfValue).ToString("O")
            : "<missing>";
        var audience = token.Audiences.Any() ? string.Join(",", token.Audiences) : "<missing>";
        var claimTypes = string.Join(",", token.Claims.Select(claim => claim.Type).Distinct().OrderBy(type => type));

        Console.WriteLine(
            $"[jwt-decoded] Endpoint='{endpoint}', alg='{token.Header.Alg ?? "<missing>"}', iss='{token.Issuer ?? "<missing>"}', aud='{audience}', exp='{exp}', nbf='{nbf}', claimTypes='{claimTypes}'");
    }

    private void SetBearerAuthorization(string accessToken)
    {
        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        Assert.False(accessToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    }

    private static async Task LogUnauthorizedResponseAsync(HttpResponseMessage response, string url, string? authorizationHeader)
    {
        if (response.StatusCode != HttpStatusCode.Unauthorized)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
        var wwwAuthenticate = string.Join(" | ", response.Headers.WwwAuthenticate.Select(value => value.ToString()));

        var authSummary = authorizationHeader is null
            ? "Authorization=<none>"
            : $"AuthorizationPrefix='{authorizationHeader.Split(' ', 2)[0]}', AuthorizationLength={authorizationHeader.Length}";

        Console.WriteLine(
            $"[401-diagnostic] Url='{url}', Status={(int)response.StatusCode} ({response.StatusCode}), WWW-Authenticate='{wwwAuthenticate}', {authSummary}, Body='{body}'");
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
