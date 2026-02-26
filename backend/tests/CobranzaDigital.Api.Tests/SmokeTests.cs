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

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace CobranzaDigital.Api.Tests;

public sealed partial class CobranzaDigitalApiFactory : WebApplicationFactory<Program>, IAsyncLifetime, IDisposable
{
    private const string TestJwtIssuer = "CobranzaDigital.Tests";
    private const string TestJwtAudience = "CobranzaDigital.Tests.Api";
    private const string TestJwtSigningKey = "THIS_IS_A_SECURE_TEST_SIGNING_KEY_123456";
    private static readonly string ApiContentRoot = ResolveApiContentRoot();
    private readonly bool _verboseLogs;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger _diagnosticLogger;
    private readonly string _sqlServerConnectionString;
    private readonly string _initialCatalog;
    private readonly string _testCatalog;
    private readonly SemaphoreSlim _initializationLock = new(1, 1);
    private bool _isInitialized;

    public CobranzaDigitalApiFactory()
    {
        if (!IsTestHostProcess())
        {
            throw new InvalidOperationException("CobranzaDigitalApiFactory can only run under the .NET test host process.");
        }

        var useSqlServer = string.Equals(Environment.GetEnvironmentVariable("TESTS_USE_SQLSERVER"), "1", StringComparison.Ordinal);
        if (!useSqlServer)
        {
            throw new InvalidOperationException(
                "SQL Server integration tests require TESTS_USE_SQLSERVER=1 in the test process.");
        }

        _verboseLogs = string.Equals(Environment.GetEnvironmentVariable("TESTS_VERBOSE_LOGS"), "1", StringComparison.Ordinal);
        var baseConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__SqlServer");

        if (string.IsNullOrWhiteSpace(baseConnectionString))
        {
            throw new InvalidOperationException(
                "SQL Server integration tests require ConnectionStrings__DefaultConnection.");
        }

        var sqlBuilder = BuildNormalizedSqlConnectionString(baseConnectionString);
        _initialCatalog = string.IsNullOrWhiteSpace(sqlBuilder.InitialCatalog)
            ? "master"
            : sqlBuilder.InitialCatalog;
        _testCatalog = $"CrepasDB_Test_{Guid.NewGuid():N}";
        sqlBuilder.InitialCatalog = _testCatalog;
        _sqlServerConnectionString = sqlBuilder.ConnectionString;

        Console.WriteLine($"[CobranzaDigitalApiFactory] SQL provider forced to SQL Server");
        Console.WriteLine($"[CobranzaDigitalApiFactory] Initial catalog from base connection: {_initialCatalog}");
        Console.WriteLine($"[CobranzaDigitalApiFactory] Test catalog: {_testCatalog}");
        Console.WriteLine($"[CobranzaDigitalApiFactory] SQL Server test connection: {MaskSqlPassword(_sqlServerConnectionString)}");
        
        _loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(_verboseLogs ? LogLevel.Debug : LogLevel.Warning);
        });
        _diagnosticLogger = _loggerFactory.CreateLogger<CobranzaDigitalApiFactory>();
    }

    // LoggerMessage delegates for CobranzaDigitalApiFactory
    [LoggerMessage(Level = LogLevel.Debug, Message = "[jwt-auth-failed] Exception while validating bearer token")]
    private static partial void LogJwtAuthFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[jwt-auth-failed] {TokenValidation}")]
    private static partial void LogJwtAuthFailedValidation(ILogger logger, string tokenValidation);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[jwt-challenge] AuthenticateFailure detected")]
    private static partial void LogJwtChallengeFailure(ILogger logger, Exception authenticateFailure);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[jwt-challenge] Challenge emitted without AuthenticateFailure (likely missing/invalid token).")]
    private static partial void LogJwtChallengeWithoutFailure(ILogger logger);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[jwt-challenge] {TokenValidation}")]
    private static partial void LogJwtChallengeValidation(ILogger logger, string tokenValidation);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[jwt-post-configure] {TokenValidation}")]
    private static partial void LogJwtPostConfigure(ILogger logger, string tokenValidation);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[test-host] Jwt effective config: Issuer='{Issuer}', Audience='{Audience}', SigningKeyLength={SigningKeyLength}, AccessTokenMinutes={AccessTokenMinutes}, RefreshTokenDays={RefreshTokenDays}")]
    private static partial void LogJwtEffectiveConfig(ILogger logger, string? issuer, string? audience, int signingKeyLength, int accessTokenMinutes, int refreshTokenDays);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[test-host] Raw config keys: Jwt:Issuer='{JwtIssuer}', JwtSettings:Issuer='{JwtSettingsIssuer}', Authentication:Jwt:Issuer='{AuthJwtIssuer}', Jwt:Audience='{JwtAudience}', JwtSettings:Audience='{JwtSettingsAudience}', Authentication:Jwt:Audience='{AuthJwtAudience}', Jwt:SigningKey.Length={JwtSigningKeyLength}, JwtSettings:SigningKey.Length={JwtSettingsSigningKeyLength}, Authentication:Jwt:SigningKey.Length={AuthJwtSigningKeyLength}")]
    private static partial void LogRawConfigKeys(ILogger logger, string? jwtIssuer, string? jwtSettingsIssuer, string? authJwtIssuer, string? jwtAudience, string? jwtSettingsAudience, string? authJwtAudience, int jwtSigningKeyLength, int jwtSettingsSigningKeyLength, int authJwtSigningKeyLength);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[test-host] Auth schemes: DefaultAuthenticate='{DefaultAuthenticate}', DefaultChallenge='{DefaultChallenge}'")]
    private static partial void LogAuthSchemes(ILogger logger, string defaultAuthenticate, string defaultChallenge);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[test-host] Endpoint '{Route}' has [AllowAnonymous]: {HasAllowAnonymous}")]
    private static partial void LogEndpointAllowAnonymous(ILogger logger, string route, bool hasAllowAnonymous);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseContentRoot(ApiContentRoot);
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging =>
        {
            logging.ClearProviders();
            logging.AddConsole();
            logging.SetMinimumLevel(_verboseLogs ? LogLevel.Debug : LogLevel.Warning);
            logging.AddFilter("Microsoft", LogLevel.Warning);
            logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);
        });
        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.Sources.Clear();
            config.SetBasePath(ApiContentRoot);
            config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: false);
            config.AddJsonFile("appsettings.Testing.json", optional: true, reloadOnChange: false);

            var settings = new Dictionary<string, string?>
            {
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

            settings["ConnectionStrings:DefaultConnection"] = _sqlServerConnectionString;
            settings["DatabaseOptions:ConnectionStringName"] = "DefaultConnection";

            config.AddEnvironmentVariables();
            config.AddInMemoryCollection(settings);
        });

        builder.ConfigureServices(services =>
        {
            Console.WriteLine("[CobranzaDigitalApiFactory] Using SQL Server: true");

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
                options.TokenValidationParameters.IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSigningKey));

                var previousEvents = options.Events ?? new JwtBearerEvents();
                var previousOnAuthenticationFailed = previousEvents.OnAuthenticationFailed;
                var previousOnChallenge = previousEvents.OnChallenge;

                options.Events = new JwtBearerEvents                 
                {
                    OnAuthenticationFailed = async context =>
                    {
                        if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
                        {
                            LogJwtAuthFailed(_diagnosticLogger, context.Exception);
                        }
                        if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
                        {
                            var tokenValidation = DescribeTokenValidationParameters(context.Options.TokenValidationParameters);
                            LogJwtAuthFailedValidation(_diagnosticLogger, tokenValidation);
                        }

                        if (previousOnAuthenticationFailed is not null)
                        {
                            await previousOnAuthenticationFailed(context);
                        }
                    },
                    OnChallenge = async context =>
                    {
                        if (context.AuthenticateFailure is not null)
                        {
                            if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
                            {
                                LogJwtChallengeFailure(_diagnosticLogger, context.AuthenticateFailure);
                            }
                        }
                        else
                        {
                            if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
                            {
                                LogJwtChallengeWithoutFailure(_diagnosticLogger);
                            }
                        }

                        if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
                        {
                            var tokenValidation = DescribeTokenValidationParameters(context.Options.TokenValidationParameters);
                            LogJwtChallengeValidation(_diagnosticLogger, tokenValidation);
                        }

                        if (previousOnChallenge is not null)
                        {
                            await previousOnChallenge(context);
                        }
                    },
                    OnForbidden = previousEvents.OnForbidden,
                    OnMessageReceived = previousEvents.OnMessageReceived,
                    OnTokenValidated = previousEvents.OnTokenValidated
                };

                if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
                {
                    var tokenValidation = DescribeTokenValidationParameters(options.TokenValidationParameters);
                    LogJwtPostConfigure(_diagnosticLogger, tokenValidation);
                }
            });
        });
    }


    private static bool IsTestHostProcess()
    {
        var processName = Environment.ProcessPath is null
            ? string.Empty
            : Path.GetFileNameWithoutExtension(Environment.ProcessPath);

        return processName.Contains("testhost", StringComparison.OrdinalIgnoreCase)
            || AppDomain.CurrentDomain.GetAssemblies().Any(assembly =>
                assembly.GetName().Name?.Contains("xunit", StringComparison.OrdinalIgnoreCase) == true);
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



    private static SqlConnectionStringBuilder BuildNormalizedSqlConnectionString(string connectionString)
    {
        var builder = new SqlConnectionStringBuilder(connectionString);
        var hasSqlAuth = !string.IsNullOrWhiteSpace(builder.UserID)
            || !string.IsNullOrWhiteSpace(builder.Password);

        if (hasSqlAuth)
        {
            builder.IntegratedSecurity = false;
            return builder;
        }

        if (builder.IntegratedSecurity)
        {
            builder.UserID = string.Empty;
            builder.Password = string.Empty;
        }

        return builder;
    }

    private static string MaskSqlPassword(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return "<empty>";
        }

        var builder = new SqlConnectionStringBuilder(connectionString);
        if (!string.IsNullOrWhiteSpace(builder.Password))
        {
            builder.Password = "***";
        }

        return builder.ConnectionString;
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
        await _initializationLock.WaitAsync();
        try
        {
            if (_isInitialized)
            {
                return;
            }

            _ = Services;

            using var scope = Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
            Console.WriteLine($"[CobranzaDigitalApiFactory] InitializeAsync provider: {dbContext.Database.ProviderName}");
            Console.WriteLine($"[CobranzaDigitalApiFactory] InitializeAsync connection string: {MaskSqlPassword(dbContext.Database.GetConnectionString())}");
            Console.WriteLine($"[CobranzaDigitalApiFactory] InitializeAsync database name: {dbContext.Database.GetDbConnection().Database}");

            await dbContext.Database.EnsureCreatedAsync();


            var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
            await IdentitySeeder.SeedAsync(scope.ServiceProvider, config);
            await EnsureSeededAdminScopeAsync(scope.ServiceProvider);

            var jwtOptions = scope.ServiceProvider.GetRequiredService<IOptions<JwtOptions>>().Value;
            var schemeProvider = scope.ServiceProvider.GetRequiredService<IAuthenticationSchemeProvider>();
            var defaultAuthenticate = await schemeProvider.GetDefaultAuthenticateSchemeAsync();
            var defaultChallenge = await schemeProvider.GetDefaultChallengeSchemeAsync();

            if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
            {
                var signingKeyLength = jwtOptions.SigningKey.Length;
                LogJwtEffectiveConfig(_diagnosticLogger, jwtOptions.Issuer, jwtOptions.Audience, signingKeyLength, jwtOptions.AccessTokenMinutes, jwtOptions.RefreshTokenDays);
            }
            if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
            {
                var jwtSigningKeyLength = config["Jwt:SigningKey"]?.Length ?? 0;
                var jwtSettingsSigningKeyLength = config["JwtSettings:SigningKey"]?.Length ?? 0;
                var authJwtSigningKeyLength = config["Authentication:Jwt:SigningKey"]?.Length ?? 0;
                LogRawConfigKeys(_diagnosticLogger, config["Jwt:Issuer"], config["JwtSettings:Issuer"], config["Authentication:Jwt:Issuer"], config["Jwt:Audience"], config["JwtSettings:Audience"], config["Authentication:Jwt:Audience"], jwtSigningKeyLength, jwtSettingsSigningKeyLength, authJwtSigningKeyLength);
            }
            if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
            {
                LogAuthSchemes(_diagnosticLogger, defaultAuthenticate?.Name ?? "<null>", defaultChallenge?.Name ?? "<null>");
            }

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
                if (_verboseLogs && _diagnosticLogger.IsEnabled(LogLevel.Debug))
                {
                    LogEndpointAllowAnonymous(_diagnosticLogger, route, hasAllowAnonymous);
                }
            }

            _isInitialized = true;
        }
        finally
        {
            _initializationLock.Release();
        }
    }

    private static async Task EnsureSeededAdminScopeAsync(IServiceProvider serviceProvider)
    {
        var dbContext = serviceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var adminUser = await userManager.FindByEmailAsync("admin@test.local").ConfigureAwait(false);
        if (adminUser is null)
        {
            return;
        }

        var defaultTenantId = await dbContext.Tenants.AsNoTracking().OrderBy(x => x.Name).Select(x => (Guid?)x.Id).FirstOrDefaultAsync().ConfigureAwait(false);
        var defaultStoreId = defaultTenantId.HasValue
            ? await dbContext.Stores.AsNoTracking().Where(x => x.TenantId == defaultTenantId.Value).OrderBy(x => x.Name).Select(x => (Guid?)x.Id).FirstOrDefaultAsync().ConfigureAwait(false)
            : null;

        var requiresUpdate = false;
        if (!adminUser.TenantId.HasValue && defaultTenantId.HasValue)
        {
            adminUser.TenantId = defaultTenantId;
            requiresUpdate = true;
        }

        if (!adminUser.StoreId.HasValue && defaultStoreId.HasValue)
        {
            adminUser.StoreId = defaultStoreId;
            requiresUpdate = true;
        }

        if (requiresUpdate)
        {
            var updateResult = await userManager.UpdateAsync(adminUser).ConfigureAwait(false);
            if (!updateResult.Succeeded)
            {
                var errors = string.Join("; ", updateResult.Errors.Select(x => x.Description));
                throw new InvalidOperationException($"Failed to update seeded admin scope for tests: {errors}");
            }
        }

        if (!await userManager.IsInRoleAsync(adminUser, "AdminStore").ConfigureAwait(false))
        {
            var addAdminStoreResult = await userManager.AddToRoleAsync(adminUser, "AdminStore").ConfigureAwait(false);
            if (!addAdminStoreResult.Succeeded)
            {
                var errors = string.Join("; ", addAdminStoreResult.Errors.Select(x => x.Description));
                throw new InvalidOperationException($"Failed to grant AdminStore role to seeded admin for tests: {errors}");
            }
        }

        if (!await userManager.IsInRoleAsync(adminUser, "SuperAdmin").ConfigureAwait(false))
        {
            var addSuperAdminResult = await userManager.AddToRoleAsync(adminUser, "SuperAdmin").ConfigureAwait(false);
            if (!addSuperAdminResult.Succeeded)
            {
                var errors = string.Join("; ", addSuperAdminResult.Errors.Select(x => x.Description));
                throw new InvalidOperationException($"Failed to grant SuperAdmin role to seeded admin for tests: {errors}");
            }
        }
    }

    private async Task DropTestDatabaseAsync()
    {
        try
        {
            var masterBuilder = new SqlConnectionStringBuilder(_sqlServerConnectionString)
            {
                InitialCatalog = "master"
            };

            await using var connection = new SqlConnection(masterBuilder.ConnectionString);
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText =
                $"IF DB_ID('{_testCatalog}') IS NOT NULL " +
                $"BEGIN ALTER DATABASE [{_testCatalog}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{_testCatalog}]; END";
            await command.ExecuteNonQueryAsync();
            Console.WriteLine($"[CobranzaDigitalApiFactory] Dropped test catalog: {_testCatalog}");
        }
        catch (Exception exception)
        {
            Console.WriteLine($"[CobranzaDigitalApiFactory] Failed to drop test catalog '{_testCatalog}': {exception.Message}");
        }
    }

    public override async ValueTask DisposeAsync()
    {
        await DropTestDatabaseAsync();
        _loggerFactory?.Dispose();
        _initializationLock.Dispose();

        await base.DisposeAsync();
    }

    public new void Dispose()
    {
        DropTestDatabaseAsync().GetAwaiter().GetResult();
        _loggerFactory?.Dispose();
        _initializationLock.Dispose();
        base.Dispose();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync();
    }
}

public sealed partial class SmokeTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;
    private readonly bool _verboseLogs;
    private readonly ILogger<SmokeTests> _logger;

    public SmokeTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _verboseLogs = string.Equals(Environment.GetEnvironmentVariable("TESTS_VERBOSE_LOGS"), "1", StringComparison.Ordinal);
        _logger = factory.Services.GetRequiredService<ILogger<SmokeTests>>();
    }

    // LoggerMessage delegates for SmokeTests
    [LoggerMessage(Level = LogLevel.Debug, Message = "[jwt-decoded] Endpoint='{Endpoint}', alg='{Alg}', iss='{Issuer}', aud='{Audience}', exp='{Expiration}', nbf='{NotBefore}', claimTypes='{ClaimTypes}'")]
    private partial void LogJwtDecoded(string endpoint, string alg, string issuer, string audience, string expiration, string notBefore, string claimTypes);

    [LoggerMessage(Level = LogLevel.Debug, Message = "[401-diagnostic] Url='{Url}', Status={StatusCode} ({StatusText}), WWW-Authenticate='{WwwAuthenticate}', {AuthSummary}, Body='{Body}'")]
    private partial void LogUnauthorizedDiagnostic(string url, int statusCode, HttpStatusCode statusText, string wwwAuthenticate, string authSummary, string body);

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
            ;

        var authResponse = await tokenService.CreateTokensAsync(
            new IdentityUserInfo(adminUser.Id.ToString(), adminUser.Email!, Array.Empty<string>()))
            ;

        var response = await GetWithBearerTokenAsync("/api/v1/admin/users", authResponse.AccessToken);

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
        AssertTokenHasRole(accessToken, "AdminStore");

        var response = await GetWithBearerTokenAsync("/api/v1/admin/users", accessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RegisterAssignsUserRole()
    {
        var _ = await RegisterAndGetAccessTokenAsync("role.check@test.local", "User1234!");
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        AssertTokenHasRole(adminToken, "AdminStore");

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
        AssertTokenHasRole(adminToken, "AdminStore");
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
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        await LogUnauthorizedResponseAsync(response, "/api/v1/auth/register", authorizationHeader: null);
        var rawBody = await response.Content.ReadAsStringAsync();

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
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        await LogUnauthorizedResponseAsync(response, "/api/v1/auth/login", authorizationHeader: null);
        var rawBody = await response.Content.ReadAsStringAsync();

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
        var response = await GetWithBearerTokenAsync($"/api/v1/admin/users?search={Uri.EscapeDataString(email)}", adminToken);
        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>();

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
        var response = await _client.GetAsync(uri);
        await LogUnauthorizedResponseAsync(response, uri, authorizationHeader);
        _client.DefaultRequestHeaders.Authorization = null;

        return response;
    }

    private void LogJwtPayloadWithoutValidation(string accessToken, string endpoint)
    {
        if (!_verboseLogs || !_logger.IsEnabled(LogLevel.Debug))
        {
            return;
        }

        var token = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
        var exp = token.Payload.Expiration is long expValue
            ? DateTimeOffset.FromUnixTimeSeconds(expValue).ToString("O")
            : "<missing>";
        var nbf = token.Payload.NotBefore is long nbfValue
            ? DateTimeOffset.FromUnixTimeSeconds(nbfValue).ToString("O")
            : "<missing>";
        var audience = token.Audiences.Any() ? string.Join(",", token.Audiences) : "<missing>";
        var claimTypes = string.Join(",", token.Claims.Select(claim => claim.Type).Distinct().OrderBy(type => type));

        LogJwtDecoded(endpoint, token.Header.Alg ?? "<missing>", token.Issuer ?? "<missing>", audience, exp, nbf, claimTypes);
    }

    private void SetBearerAuthorization(string accessToken)
    {
        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        Assert.False(accessToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase));
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    }

    private async Task LogUnauthorizedResponseAsync(HttpResponseMessage response, string url, string? authorizationHeader)
    {
        if (response.StatusCode != HttpStatusCode.Unauthorized)
        {
            return;
        }

        if (!_verboseLogs || !_logger.IsEnabled(LogLevel.Debug))
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync();
        var wwwAuthenticate = string.Join(" | ", response.Headers.WwwAuthenticate.Select(value => value.ToString()));

        var authSummary = authorizationHeader is null
            ? "Authorization=<none>"
            : $"AuthorizationPrefix='{authorizationHeader.Split(' ', 2)[0]}', AuthorizationLength={authorizationHeader.Length}";

        LogUnauthorizedDiagnostic(url, (int)response.StatusCode, response.StatusCode, wwwAuthenticate, authSummary, body);
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
