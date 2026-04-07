using CobranzaDigital.Infrastructure.Options;

namespace CobranzaDigital.Api.Extensions;

public static class ReleaseConfigurationExtensions
{
    public static WebApplication ValidateReleaseConfiguration(this WebApplication app)
    {
        var connectionStringName = app.Configuration[$"{DatabaseOptions.SectionName}:ConnectionStringName"];
        if (string.IsNullOrWhiteSpace(connectionStringName))
        {
            connectionStringName = "DefaultConnection";
        }

        var connectionString = app.Configuration.GetConnectionString(connectionStringName);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string '{connectionStringName}' is required. Configure it via user-secrets (Development), CI variables, or the host EnvironmentFile.");
        }

        if (!app.Environment.IsProduction())
        {
            return app;
        }

        if (app.Configuration.GetValue<bool>("Swagger:Enabled"))
        {
            throw new InvalidOperationException("Swagger must remain disabled in Production.");
        }

        if (app.Configuration.GetValue<bool>($"{DatabaseOptions.SectionName}:EnableSensitiveDataLogging"))
        {
            throw new InvalidOperationException("DatabaseOptions:EnableSensitiveDataLogging must remain disabled in Production.");
        }

        if (string.Equals(app.Configuration["APPLY_MIGRATIONS_ON_STARTUP"], "1", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("APPLY_MIGRATIONS_ON_STARTUP must not be enabled in Production.");
        }

        if (string.Equals(app.Configuration["SEED_DEV_DATA"], "1", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("SEED_DEV_DATA must not be enabled in Production.");
        }

        return app;
    }
}
