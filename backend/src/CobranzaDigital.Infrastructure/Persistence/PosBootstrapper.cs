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

        var now = DateTimeOffset.UtcNow;
        var defaultVertical = await db.Verticals.OrderBy(x => x.Name).FirstOrDefaultAsync().ConfigureAwait(false);
        if (defaultVertical is null)
        {
            defaultVertical = new Vertical
            {
                Id = Guid.NewGuid(),
                Name = "Restaurant",
                Description = "Default vertical",
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };
            db.Verticals.Add(defaultVertical);
            await db.SaveChangesAsync().ConfigureAwait(false);
        }

        var defaultTenant = await db.Tenants.OrderBy(x => x.Name).FirstOrDefaultAsync().ConfigureAwait(false);
        if (defaultTenant is null)
        {
            defaultTenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = "Default Tenant",
                Slug = "default-tenant",
                VerticalId = defaultVertical.Id,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };
            db.Tenants.Add(defaultTenant);
            await db.SaveChangesAsync().ConfigureAwait(false);
        }

        var defaultStore = await db.Stores.OrderBy(s => s.Id).FirstOrDefaultAsync().ConfigureAwait(false);
        if (defaultStore is null)
        {
            defaultStore = new Store
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                TenantId = defaultTenant.Id,
                IsActive = true,
                TimeZoneId = "America/Mexico_City",
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };

            db.Stores.Add(defaultStore);
            await db.SaveChangesAsync().ConfigureAwait(false);
        }
        else if (defaultStore.TenantId == Guid.Empty)
        {
            defaultStore.TenantId = defaultTenant.Id;
            await db.SaveChangesAsync().ConfigureAwait(false);
        }

        if (!defaultTenant.DefaultStoreId.HasValue)
        {
            defaultTenant.DefaultStoreId = defaultStore.Id;
            await db.SaveChangesAsync().ConfigureAwait(false);
        }


        var defaultTemplate = await db.CatalogTemplates.OrderBy(x => x.Name).FirstOrDefaultAsync().ConfigureAwait(false);
        if (defaultTemplate is null)
        {
            defaultTemplate = new CatalogTemplate
            {
                Id = Guid.NewGuid(),
                VerticalId = defaultVertical.Id,
                Name = "Default Template",
                Version = "1.0.0",
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };
            db.CatalogTemplates.Add(defaultTemplate);
            await db.SaveChangesAsync().ConfigureAwait(false);
        }

        var tenantMappings = await db.Tenants.AsNoTracking().ToListAsync().ConfigureAwait(false);
        foreach (var tenant in tenantMappings)
        {
            var mappedTemplate = await db.CatalogTemplates.AsNoTracking().Where(x => x.VerticalId == tenant.VerticalId).OrderBy(x => x.Name).FirstOrDefaultAsync().ConfigureAwait(false)
                ?? defaultTemplate;
            if (!await db.TenantCatalogTemplates.AnyAsync(x => x.TenantId == tenant.Id).ConfigureAwait(false))
            {
                db.TenantCatalogTemplates.Add(new TenantCatalogTemplate
                {
                    TenantId = tenant.Id,
                    CatalogTemplateId = mappedTemplate.Id,
                    UpdatedAtUtc = now
                });
            }
        }

        await db.SaveChangesAsync().ConfigureAwait(false);

        await db.Categories.Where(x => x.CatalogTemplateId == null).ExecuteUpdateAsync(x => x.SetProperty(y => y.CatalogTemplateId, defaultTemplate.Id)).ConfigureAwait(false);
        await db.Products.Where(x => x.CatalogTemplateId == null).ExecuteUpdateAsync(x => x.SetProperty(y => y.CatalogTemplateId, defaultTemplate.Id)).ConfigureAwait(false);
        await db.OptionSets.Where(x => x.CatalogTemplateId == null).ExecuteUpdateAsync(x => x.SetProperty(y => y.CatalogTemplateId, defaultTemplate.Id)).ConfigureAwait(false);
        await db.OptionItems.Where(x => x.CatalogTemplateId == null).ExecuteUpdateAsync(x => x.SetProperty(y => y.CatalogTemplateId, defaultTemplate.Id)).ConfigureAwait(false);
        await db.CustomizationSchemas.Where(x => x.CatalogTemplateId == null).ExecuteUpdateAsync(x => x.SetProperty(y => y.CatalogTemplateId, defaultTemplate.Id)).ConfigureAwait(false);
        await db.SelectionGroups.Where(x => x.CatalogTemplateId == null).ExecuteUpdateAsync(x => x.SetProperty(y => y.CatalogTemplateId, defaultTemplate.Id)).ConfigureAwait(false);
        await db.Extras.Where(x => x.CatalogTemplateId == null).ExecuteUpdateAsync(x => x.SetProperty(y => y.CatalogTemplateId, defaultTemplate.Id)).ConfigureAwait(false);

        var settings = await db.PosSettings.OrderBy(x => x.Id).FirstOrDefaultAsync().ConfigureAwait(false);
        if (settings is null)
        {
            db.PosSettings.Add(new PosSettings
            {
                Id = Guid.NewGuid(),
                MultiStoreEnabled = false,
                MaxStoresAllowed = 1,
                CashDifferenceThreshold = 50m,
                DefaultStoreId = defaultStore.Id,
                ShowOnlyInStock = false
            });
            await db.SaveChangesAsync().ConfigureAwait(false);
        }
    }
}
