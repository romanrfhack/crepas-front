using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CobranzaDigital.Infrastructure.Identity;

public static partial class IdentitySeeder
{
    private static readonly string[] DefaultRoles = ["Admin", "User", "Manager", "Collector"];

    public static async Task SeedAsync(IServiceProvider serviceProvider, IConfiguration configuration)
    {
        using var scope = serviceProvider.CreateScope();
        var scopedProvider = scope.ServiceProvider;
        var logger = scopedProvider.GetRequiredService<ILoggerFactory>().CreateLogger("IdentitySeeder");
        var roleManager = scopedProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var userManager = scopedProvider.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var roleName in DefaultRoles)
        {
            if (!await roleManager.RoleExistsAsync(roleName).ConfigureAwait(false))
            {
                var roleResult = await roleManager.CreateAsync(new ApplicationRole { Name = roleName }).ConfigureAwait(false);
                if (!roleResult.Succeeded)
                {
                    LogMessages.FailedToCreateRole(logger, roleName, roleResult.Errors);
                }
            }
        }

        var adminEmail = configuration["IdentitySeed:AdminEmail"];
        var adminPassword = configuration["IdentitySeed:AdminPassword"];

        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
        {
            LogMessages.SkippingAdminSeed(logger);
            return;
        }

        var adminUser = await userManager.FindByEmailAsync(adminEmail).ConfigureAwait(false);
        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                Email = adminEmail,
                UserName = adminEmail,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(adminUser, adminPassword).ConfigureAwait(false);
            if (!createResult.Succeeded)
            {
                LogMessages.FailedToCreateAdminUser(logger, createResult.Errors);
                return;
            }
        }

        if (!await userManager.IsInRoleAsync(adminUser, "Admin").ConfigureAwait(false))
        {
            var addRoleResult = await userManager.AddToRoleAsync(adminUser, "Admin").ConfigureAwait(false);
            if (!addRoleResult.Succeeded)
            {
                LogMessages.FailedToAddAdminRole(logger, addRoleResult.Errors);
            }
        }
    }

    private static partial class LogMessages
    {
        [LoggerMessage(Level = LogLevel.Warning, Message = "Failed to create role {RoleName}: {Errors}")]
        public static partial void FailedToCreateRole(ILogger logger, string roleName, IEnumerable<IdentityError> errors);

        [LoggerMessage(Level = LogLevel.Information, Message = "Skipping admin user seeding because IdentitySeed:AdminEmail or IdentitySeed:AdminPassword is missing.")]
        public static partial void SkippingAdminSeed(ILogger logger);

        [LoggerMessage(Level = LogLevel.Warning, Message = "Failed to create admin user: {Errors}")]
        public static partial void FailedToCreateAdminUser(ILogger logger, IEnumerable<IdentityError> errors);

        [LoggerMessage(Level = LogLevel.Warning, Message = "Failed to add admin user to Admin role: {Errors}")]
        public static partial void FailedToAddAdminRole(ILogger logger, IEnumerable<IdentityError> errors);
    }
}
