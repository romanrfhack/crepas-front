using CobranzaDigital.Domain.Entities;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Infrastructure.Persistence;

public static class PosBootstrapper
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var defaultStore = await db.Stores.OrderBy(x => x.CreatedAtUtc).ThenBy(x => x.Id).FirstOrDefaultAsync().ConfigureAwait(false);
        if (defaultStore is null)
        {
            defaultStore = new Store
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                IsActive = true,
                TimeZoneId = "America/Mexico_City",
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };

            db.Stores.Add(defaultStore);
            await db.SaveChangesAsync().ConfigureAwait(false);
        }

        var settings = await db.PosSettings.OrderBy(x => x.Id).FirstOrDefaultAsync().ConfigureAwait(false);
        if (settings is null)
        {
            db.PosSettings.Add(new PosSettings
            {
                Id = Guid.NewGuid(),
                MultiStoreEnabled = false,
                MaxStoresAllowed = 1,
                CashDifferenceThreshold = 50m,
                DefaultStoreId = defaultStore.Id
            });
            await db.SaveChangesAsync().ConfigureAwait(false);
        }
    }
}
