using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace CobranzaDigital.Infrastructure.Persistence;

public sealed class CobranzaDigitalDbContext
    : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
{
    public CobranzaDigitalDbContext(DbContextOptions<CobranzaDigitalDbContext> options)
        : base(options)
    {
    }

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CatalogTemplate> CatalogTemplates => Set<CatalogTemplate>();
    public DbSet<TenantCatalogTemplate> TenantCatalogTemplates => Set<TenantCatalogTemplate>();
    public DbSet<TenantCatalogOverride> TenantCatalogOverrides => Set<TenantCatalogOverride>();
    public DbSet<StoreCatalogAvailability> StoreCatalogAvailabilities => Set<StoreCatalogAvailability>();
    public DbSet<StoreCatalogOverride> StoreCatalogOverrides => Set<StoreCatalogOverride>();
    public DbSet<CatalogInventoryBalance> CatalogInventoryBalances => Set<CatalogInventoryBalance>();
    public DbSet<CatalogInventoryAdjustment> CatalogInventoryAdjustments => Set<CatalogInventoryAdjustment>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<OptionSet> OptionSets => Set<OptionSet>();
    public DbSet<OptionItem> OptionItems => Set<OptionItem>();
    public DbSet<CustomizationSchema> CustomizationSchemas => Set<CustomizationSchema>();
    public DbSet<SelectionGroup> SelectionGroups => Set<SelectionGroup>();
    public DbSet<Extra> Extras => Set<Extra>();
    public DbSet<IncludedItem> IncludedItems => Set<IncludedItem>();
    public DbSet<ProductGroupOverride> ProductGroupOverrides => Set<ProductGroupOverride>();
    public DbSet<ProductGroupOverrideAllowedItem> ProductGroupOverrideAllowedItems => Set<ProductGroupOverrideAllowedItem>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<SaleItemSelection> SaleItemSelections => Set<SaleItemSelection>();
    public DbSet<SaleItemExtra> SaleItemExtras => Set<SaleItemExtra>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PosShift> PosShifts => Set<PosShift>();
    public DbSet<Store> Stores => Set<Store>();
    public DbSet<PosSettings> PosSettings => Set<PosSettings>();
    public DbSet<StoreInventory> StoreInventories => Set<StoreInventory>();
    public DbSet<Vertical> Verticals => Set<Vertical>();
    public DbSet<Tenant> Tenants => Set<Tenant>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Sale>(entity =>
        {
            entity.Property(e => e.Status)
                .HasConversion<int>();
        });

        builder.ApplyConfigurationsFromAssembly(typeof(CobranzaDigitalDbContext).Assembly);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        TouchCatalogRows();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        TouchCatalogRows();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void TouchCatalogRows()
    {
        var utcNow = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State is EntityState.Added or EntityState.Modified)
            {
                switch (entry.Entity)
                {
                    case Category category:
                        category.UpdatedAtUtc = utcNow;
                        break;
                    case Product product:
                        product.UpdatedAtUtc = utcNow;
                        break;
                    case OptionSet optionSet:
                        optionSet.UpdatedAtUtc = utcNow;
                        break;
                    case OptionItem optionItem:
                        optionItem.UpdatedAtUtc = utcNow;
                        break;
                    case Extra extra:
                        extra.UpdatedAtUtc = utcNow;
                        break;
                    case CatalogTemplate template:
                        template.UpdatedAtUtc = utcNow;
                        break;
                    case TenantCatalogTemplate tenantTemplate:
                        tenantTemplate.UpdatedAtUtc = utcNow;
                        break;
                    case TenantCatalogOverride tenantOverride:
                        tenantOverride.UpdatedAtUtc = utcNow;
                        break;
                    case StoreCatalogAvailability storeAvailability:
                        storeAvailability.UpdatedAtUtc = utcNow;
                        break;
                    case StoreCatalogOverride storeOverride:
                        storeOverride.UpdatedAtUtc = utcNow;
                        break;
                    case CatalogInventoryBalance balance:
                        balance.UpdatedAtUtc = utcNow;
                        break;
                }
            }
        }
    }
}
