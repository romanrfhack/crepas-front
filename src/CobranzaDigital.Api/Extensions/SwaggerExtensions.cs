using Asp.Versioning.ApiExplorer;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace CobranzaDigital.Api.Extensions;

public static class SwaggerExtensions
{
    public static IServiceCollection AddSwaggerWithJwt(this IServiceCollection services)
    {
        services.AddTransient<IConfigureOptions<SwaggerGenOptions>, ConfigureSwaggerOptions>();
        services.AddSwaggerGen(options =>
        {
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                In = ParameterLocation.Header,
                Description = "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"",
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT"
            });

            // .NET 10 / OpenAPI.NET 2.3+: requirement via delegate + reference helper
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = []
            });
        });

        return services;
    }

    public static WebApplication UseSwaggerWithApiVersioning(this WebApplication app)
    {
        var provider = app.Services.GetRequiredService<IApiVersionDescriptionProvider>();

        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            foreach (var description in provider.ApiVersionDescriptions)
            {
                var displayName = description.IsDeprecated
                    ? $"{description.GroupName.ToUpperInvariant()} (DEPRECATED)"
                    : description.GroupName.ToUpperInvariant();
                options.SwaggerEndpoint(
                    $"/swagger/{description.GroupName}/swagger.json",
                    displayName);
            }
        });

        return app;
    }

    private sealed class ConfigureSwaggerOptions : IConfigureOptions<SwaggerGenOptions>
    {
        private readonly IApiVersionDescriptionProvider _provider;

        public ConfigureSwaggerOptions(IApiVersionDescriptionProvider provider)
        {
            _provider = provider;
        }

        public void Configure(SwaggerGenOptions options)
        {
            foreach (var description in _provider.ApiVersionDescriptions)
            {
                var info = new OpenApiInfo
                {
                    Title = "CobranzaDigital API",
                    Version = description.ApiVersion.ToString()
                };

                if (description.IsDeprecated)
                {
                    info.Description = "This API version has been deprecated.";
                }

                options.SwaggerDoc(description.GroupName, info);
            }

            options.DocInclusionPredicate((docName, apiDescription) =>
            {
                var apiVersionModel = apiDescription.GetApiVersionModel();
                if (apiVersionModel is null)
                {
                    return false;
                }

                if (apiVersionModel.DeclaredApiVersions.Count > 0)
                {
                    return apiVersionModel.DeclaredApiVersions.Any(version => $"v{version}" == docName);
                }

                return apiVersionModel.ImplementedApiVersions.Any(version => $"v{version}" == docName);
            });
        }
    }
}
