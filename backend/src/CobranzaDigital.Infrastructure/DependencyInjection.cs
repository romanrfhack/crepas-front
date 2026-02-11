using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Infrastructure.Auditing;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Options;
using CobranzaDigital.Infrastructure.Persistence;
using CobranzaDigital.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace CobranzaDigital.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment? environment = null)
    {
        services.AddOptions<DatabaseOptions>()
            .BindConfiguration(DatabaseOptions.SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddDbContext<CobranzaDigitalDbContext>((serviceProvider, options) =>
        {
            var databaseOptions = serviceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            var provider = ResolveProvider(databaseOptions, environment);
            var connectionString = configuration.GetConnectionString(databaseOptions.ConnectionStringName);

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"Connection string '{databaseOptions.ConnectionStringName}' was not found.");
            }

            if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
            {
                options.UseSqlite(connectionString, sqliteOptions =>
                {
                    sqliteOptions.MigrationsAssembly(typeof(CobranzaDigitalDbContext).Assembly.FullName);
                });
            }
            else
            {
                options.UseSqlServer(connectionString, sqlOptions =>
                {
                    sqlOptions.EnableRetryOnFailure();
                    sqlOptions.MigrationsAssembly(typeof(CobranzaDigitalDbContext).Assembly.FullName);
                });
            }

            if (databaseOptions.EnableSensitiveDataLogging)
            {
                options.EnableSensitiveDataLogging();
            }
        });

        services
            .AddIdentity<ApplicationUser, ApplicationRole>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;

                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
                options.Lockout.MaxFailedAccessAttempts = 5;

                options.User.RequireUniqueEmail = true;
            })
            .AddEntityFrameworkStores<CobranzaDigitalDbContext>()
            .AddDefaultTokenProviders();

        services.AddScoped<IIdentityService, IdentityService>();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<IUserAdminService, UserAdminService>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddTransient<IDateTime, SystemDateTime>();

        return services;
    }

    private static string ResolveProvider(DatabaseOptions databaseOptions, IHostEnvironment? environment)
    {
        if (environment is not null && environment.IsEnvironment("Testing"))
        {
            return "Sqlite";
        }

        return string.IsNullOrWhiteSpace(databaseOptions.Provider)
            ? "SqlServer"
            : databaseOptions.Provider;
    }
}
