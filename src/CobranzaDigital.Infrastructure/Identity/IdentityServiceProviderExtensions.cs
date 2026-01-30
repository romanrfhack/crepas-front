using Microsoft.Extensions.Configuration;

namespace CobranzaDigital.Infrastructure.Identity;

public static class IdentityServiceProviderExtensions
{
    public static Task SeedIdentityAsync(this IServiceProvider serviceProvider, IConfiguration configuration)
    {
        return IdentitySeeder.SeedAsync(serviceProvider, configuration);
    }
}
