using Asp.Versioning.ApiExplorer;
using Asp.Versioning;
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

            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = []
            });

            // IMPORTANTE: Para que funcione con versionado de API
            //options.EnableAnnotations();
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
                    Version = description.ApiVersion.ToString(),
                    Description = description.IsDeprecated
                        ? "This API version has been deprecated."
                        : "CobranzaDigital API"
                };

                options.SwaggerDoc(description.GroupName, info);
            }

            // FIX: Corregir el DocInclusionPredicate para Asp.Versioning 8.x
            options.DocInclusionPredicate((docName, apiDescription) =>
            {
                // OPCIÓN 1: Usar el GroupName ya asignado por ApiExplorer (RECOMENDADO)
                if (!string.IsNullOrEmpty(apiDescription.GroupName))
                {
                    return apiDescription.GroupName.Equals(docName, StringComparison.OrdinalIgnoreCase);
                }

                // OPCIÓN 2: Obtener la versión de los metadatos del endpoint
                var endpointMetadata = apiDescription.ActionDescriptor.EndpointMetadata;

                // Buscar atributos ApiVersion y MapToApiVersion
                var apiVersions = new List<ApiVersion>();

                // Buscar [ApiVersion]
                var apiVersionAttributes = endpointMetadata
                    .OfType<ApiVersionAttribute>()
                    .SelectMany(attr => attr.Versions);

                // Buscar [MapToApiVersion]
                var mapToApiVersionAttributes = endpointMetadata
                    .OfType<MapToApiVersionAttribute>()
                    .SelectMany(attr => attr.Versions);

                apiVersions.AddRange(apiVersionAttributes);
                apiVersions.AddRange(mapToApiVersionAttributes);

                // Si no hay versiones específicas, intentar obtener de la ruta/controlador
                if (apiVersions.Count == 0)
                {
                    // Intentar parsear el docName para obtener la versión
                    if (docName.StartsWith("v", StringComparison.OrdinalIgnoreCase))
                    {
                        var versionString = docName[1..];                        
                            // Verificar si este endpoint acepta esta versión
                            // (esto es una simplificación - en producción necesitarías más lógica)
                            return true;                        
                    }
                }
                else
                {
                    // Verificar si alguna de las versiones coincide con el docName
                    return apiVersions.Any(v =>
                        $"v{v}" == docName || v.ToString() == docName);
                }

                return false;
            });

            // FIX: Asegurar que se respeten las rutas con versiones
            options.OrderActionsBy((apiDesc) =>
                $"{apiDesc.RelativePath}");
        }
    }
}
