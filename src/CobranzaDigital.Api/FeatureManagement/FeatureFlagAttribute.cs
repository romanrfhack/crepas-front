using System.Reflection;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace CobranzaDigital.Api.FeatureManagement;

[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class FeatureFlagAttribute : Attribute
{
    public FeatureFlagAttribute(string configurationKey)
    {
        ConfigurationKey = configurationKey;
    }

    public string ConfigurationKey { get; }
}

public sealed class FeatureFlagControllerFeatureProvider : IApplicationFeatureProvider<ControllerFeature>
{
    private readonly IConfiguration _configuration;

    public FeatureFlagControllerFeatureProvider(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public void PopulateFeature(IEnumerable<ApplicationPart> parts, ControllerFeature feature)
    {
        _ = parts;

        var flaggedControllers = feature.Controllers
            .Where(typeInfo => typeInfo.GetCustomAttribute<FeatureFlagAttribute>() is not null)
            .ToList();

        foreach (var controller in flaggedControllers)
        {
            var attribute = controller.GetCustomAttribute<FeatureFlagAttribute>()!;
            var isEnabled = _configuration.GetValue<bool>(attribute.ConfigurationKey);

            if (!isEnabled)
            {
                feature.Controllers.Remove(controller);
            }
        }
    }
}
