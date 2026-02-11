using CobranzaDigital.Application.Options;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace CobranzaDigital.Api.Extensions;

public static class JwtConfigurationExtensions
{
    public static IServiceCollection AddJwtConfiguration(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        // Keep a single canonical options object (Jwt) and normalize legacy keys into it.
        // This avoids regressions where token emission and validation drift and fail with IDX10517.
        services.AddSingleton<IValidateOptions<JwtOptions>, JwtOptionsValidator>();
        services.AddOptions<JwtOptions>()
            .Configure(options => BindJwtOptions(configuration, options))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer();

        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((options, jwtOptionsAccessor) =>
            {
                var jwt = jwtOptionsAccessor.Value;
                var isTestingEnvironment = environment.IsEnvironment("Testing");

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = !isTestingEnvironment,
                    ValidateAudience = !isTestingEnvironment,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwt.Issuer,
                    ValidAudience = jwt.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                    RoleClaimType = ClaimTypes.Role,
                    NameClaimType = ClaimTypes.NameIdentifier,
                    ClockSkew = TimeSpan.FromMinutes(1)
                };

                options.Events = new JwtBearerEvents
                {
                    OnChallenge = async context =>
                    {
                        context.HandleResponse();
                        var httpContext = context.HttpContext;
                        var problemDetails = new ProblemDetails
                        {
                            Title = "Unauthorized",
                            Status = StatusCodes.Status401Unauthorized,
                            Detail = "Authentication required.",
                            Type = "https://httpstatuses.com/401"
                        };

                        httpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        httpContext.Response.ContentType = "application/problem+json";
                        await JsonSerializer.SerializeAsync(httpContext.Response.Body, problemDetails).ConfigureAwait(false);
                    },
                    OnForbidden = async context =>
                    {
                        var httpContext = context.HttpContext;
                        var problemDetails = new ProblemDetails
                        {
                            Title = "Forbidden",
                            Status = StatusCodes.Status403Forbidden,
                            Detail = "Access is forbidden.",
                            Type = "https://httpstatuses.com/403"
                        };

                        httpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
                        httpContext.Response.ContentType = "application/problem+json";
                        await JsonSerializer.SerializeAsync(httpContext.Response.Body, problemDetails).ConfigureAwait(false);
                    }
                };
            });

        services.PostConfigure<AuthenticationOptions>(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        });

        return services;
    }

    private static void BindJwtOptions(IConfiguration configuration, JwtOptions options)
    {
        var canonical = configuration.GetSection(JwtOptions.SectionName);
        var legacyJwtSettings = configuration.GetSection("JwtSettings");
        var legacyAuthenticationJwt = configuration.GetSection("Authentication:Jwt");

        var issuer = FirstNonEmpty(
            canonical["Issuer"],
            legacyJwtSettings["Issuer"],
            legacyAuthenticationJwt["Issuer"]);
        var audience = FirstNonEmpty(
            canonical["Audience"],
            legacyJwtSettings["Audience"],
            legacyAuthenticationJwt["Audience"]);
        var signingKey = FirstNonEmpty(
            canonical["SigningKey"],
            canonical["Key"],
            legacyJwtSettings["SigningKey"],
            legacyJwtSettings["Key"],
            legacyAuthenticationJwt["SigningKey"],
            legacyAuthenticationJwt["Key"]);

        options.Issuer = issuer ?? string.Empty;
        options.Audience = audience ?? string.Empty;
        options.SigningKey = signingKey ?? string.Empty;
        options.AccessTokenMinutes = ResolveInt(
            canonical["AccessTokenMinutes"],
            legacyJwtSettings["AccessTokenMinutes"],
            legacyAuthenticationJwt["AccessTokenMinutes"]);
        options.RefreshTokenDays = ResolveInt(
            canonical["RefreshTokenDays"],
            legacyJwtSettings["RefreshTokenDays"],
            legacyAuthenticationJwt["RefreshTokenDays"]);
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static int ResolveInt(params string?[] values)
    {
        foreach (var value in values)
        {
            if (int.TryParse(value, out var parsed))
            {
                return parsed;
            }
        }

        return 0;
    }
}

internal sealed class JwtOptionsValidator : IValidateOptions<JwtOptions>
{
    public ValidateOptionsResult Validate(string? name, JwtOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.SigningKey))
        {
            return ValidateOptionsResult.Fail("Jwt:SigningKey is required.");
        }

        if (options.SigningKey.Length < 32)
        {
            return ValidateOptionsResult.Fail("Jwt:SigningKey must be at least 32 characters.");
        }

        return ValidateOptionsResult.Success;
    }
}
