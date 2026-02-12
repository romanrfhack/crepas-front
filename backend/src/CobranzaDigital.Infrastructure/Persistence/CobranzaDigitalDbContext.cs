using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

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

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(CobranzaDigitalDbContext).Assembly);
    }
}
