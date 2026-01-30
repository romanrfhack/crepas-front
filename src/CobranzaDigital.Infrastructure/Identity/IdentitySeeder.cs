using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CobranzaDigital.Infrastructure.Identity;

public static class IdentitySeeder
{
    private static readonly string[] DefaultRoles = ["Admin", "Manager", "Collector"];

    public static async Task SeedAsync(IServiceProvider serviceProvider, IConfiguration configuration)
    {
        using var scope = serviceProvider.CreateScope();
        var scopedProvider = scope.ServiceProvider;
        var logger = scopedProvider.GetRequiredService<ILoggerFactory>().CreateLogger("IdentitySeeder");
        var roleManager = scopedProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var userManager = scopedProvider.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var roleName in DefaultRoles)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var roleResult = await roleManager.CreateAsync(new ApplicationRole { Name = roleName });
                if (!roleResult.Succeeded)
                {
                    logger.LogWarning("Failed to create role {RoleName}: {Errors}", roleName, roleResult.Errors);
                }
            }
        }

        var adminEmail = configuration["IdentitySeed:AdminEmail"];
        var adminPassword = configuration["IdentitySeed:AdminPassword"];

        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
        {
            logger.LogInformation(
                "Skipping admin user seeding because IdentitySeed:AdminEmail or IdentitySeed:AdminPassword is missing.");
            return;
        }

        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                Email = adminEmail,
                UserName = adminEmail,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(adminUser, adminPassword);
            if (!createResult.Succeeded)
            {
                logger.LogWarning("Failed to create admin user: {Errors}", createResult.Errors);
                return;
            }
        }

        if (!await userManager.IsInRoleAsync(adminUser, "Admin"))
        {
            var addRoleResult = await userManager.AddToRoleAsync(adminUser, "Admin");
            if (!addRoleResult.Succeeded)
            {
                logger.LogWarning("Failed to add admin user to Admin role: {Errors}", addRoleResult.Errors);
            }
        }
    }
}
