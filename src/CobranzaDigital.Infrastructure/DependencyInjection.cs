using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddTransient<IDateTime, SystemDateTime>();

        return services;
    }
}
