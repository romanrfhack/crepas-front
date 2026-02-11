using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Validators.PosCatalog;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IValidator<UpsertSelectionGroupRequest>, UpsertSelectionGroupRequestValidator>();
        services.AddScoped<IValidator<UpsertProductRequest>, UpsertProductRequestValidator>();
        services.AddScoped<IValidator<UpsertExtraRequest>, UpsertExtraRequestValidator>();
        services.AddScoped<IValidator<ReplaceIncludedItemsRequest>, ReplaceIncludedItemsRequestValidator>();
        services.AddScoped<IValidator<OverrideUpsertRequest>, OverrideUpsertRequestValidator>();
        return services;
    }
}
