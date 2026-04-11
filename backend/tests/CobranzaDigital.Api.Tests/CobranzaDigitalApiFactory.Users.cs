using CobranzaDigital.Application.Interfaces;

using CobranzaDigital.Infrastructure.Identity;

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed partial class CobranzaDigitalApiFactory
{
    public async Task<string> CreateDefaultUserAsync(string email, string password)
    {
        using var scope = Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var existing = await userManager.FindByEmailAsync(email).ConfigureAwait(false);
        if (existing is not null)
        {
            return existing.Id.ToString();
        }

        var identityService = scope.ServiceProvider.GetRequiredService<IIdentityService>();
        var result = await identityService.CreateUserAsync(email, password).ConfigureAwait(false);
        if (!result.Success)
        {
            throw new InvalidOperationException($"Failed to create test user '{email}': {string.Join("; ", result.Errors)}");
        }

        return result.UserId;
    }
}
