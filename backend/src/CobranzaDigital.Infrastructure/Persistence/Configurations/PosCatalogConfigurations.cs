using CobranzaDigital.Domain.Entities;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CobranzaDigital.Infrastructure.Persistence.Configurations;

public sealed class CatalogTemplateConfiguration : IEntityTypeConfiguration<CatalogTemplate>
{
    public void Configure(EntityTypeBuilder<CatalogTemplate> builder)
    {
        builder.ToTable("CatalogTemplates");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Version).HasMaxLength(50);
        builder.Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(x => x.UpdatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasIndex(x => new { x.VerticalId, x.Name }).IsUnique();
        builder.HasOne<Vertical>().WithMany().HasForeignKey(x => x.VerticalId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class TenantCatalogTemplateConfiguration : IEntityTypeConfiguration<TenantCatalogTemplate>
{
    public void Configure(EntityTypeBuilder<TenantCatalogTemplate> builder)
    {
        builder.ToTable("TenantCatalogTemplates");
        builder.HasKey(x => x.TenantId);
        builder.Property(x => x.UpdatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class TenantCatalogOverrideConfiguration : IEntityTypeConfiguration<TenantCatalogOverride>
{
    public void Configure(EntityTypeBuilder<TenantCatalogOverride> builder)
    {
        builder.ToTable("TenantCatalogOverrides");
        builder.HasKey(x => new { x.TenantId, x.ItemType, x.ItemId });
        builder.Property(x => x.ItemType).HasConversion<int>();
        builder.Property(x => x.IsEnabled).HasDefaultValue(true);
        builder.Property(x => x.UpdatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StoreCatalogAvailabilityConfiguration : IEntityTypeConfiguration<StoreCatalogAvailability>
{
    public void Configure(EntityTypeBuilder<StoreCatalogAvailability> builder)
    {
        builder.ToTable("StoreCatalogAvailability");
        builder.HasKey(x => new { x.StoreId, x.ItemType, x.ItemId });
        builder.Property(x => x.ItemType).HasConversion<int>();
        builder.Property(x => x.IsAvailable).HasDefaultValue(true);
        builder.Property(x => x.UpdatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StoreCatalogOverrideConfiguration : IEntityTypeConfiguration<StoreCatalogOverride>
{
    public void Configure(EntityTypeBuilder<StoreCatalogOverride> builder)
    {
        builder.ToTable("StoreCatalogOverrides");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ItemType).HasConversion<int>();
        builder.Property(x => x.OverrideState).HasConversion<int>();
        builder.Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.Property(x => x.UpdatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasIndex(x => new { x.StoreId, x.ItemType, x.ItemId }).IsUnique();
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CatalogInventoryBalanceConfiguration : IEntityTypeConfiguration<CatalogInventoryBalance>
{
    public void Configure(EntityTypeBuilder<CatalogInventoryBalance> builder)
    {
        builder.ToTable("CatalogInventoryBalances");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ItemType).HasConversion<int>();
        builder.Property(x => x.OnHandQty).HasColumnType("decimal(18,3)");
        builder.Property(x => x.UpdatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasIndex(x => new { x.StoreId, x.ItemType, x.ItemId }).IsUnique();
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CatalogInventoryAdjustmentConfiguration : IEntityTypeConfiguration<CatalogInventoryAdjustment>
{
    public void Configure(EntityTypeBuilder<CatalogInventoryAdjustment> builder)
    {
        builder.ToTable("CatalogInventoryAdjustments");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ItemType).HasConversion<int>();
        builder.Property(x => x.QtyBefore).HasColumnType("decimal(18,3)");
        builder.Property(x => x.DeltaQty).HasColumnType("decimal(18,3)");
        builder.Property(x => x.ResultingOnHandQty).HasColumnType("decimal(18,3)");
        builder.Property(x => x.Reason).HasMaxLength(100).IsRequired();
        builder.Property(x => x.ReferenceType).HasMaxLength(50);
        builder.Property(x => x.ReferenceId).HasMaxLength(100);
        builder.Property(x => x.MovementKind).HasMaxLength(100);
        builder.Property(x => x.Reference).HasMaxLength(200);
        builder.Property(x => x.Note).HasMaxLength(400);
        builder.Property(x => x.ClientOperationId).HasMaxLength(100);
        builder.Property(x => x.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasIndex(x => new { x.StoreId, x.ItemType, x.ItemId });
        builder.HasIndex(x => new { x.StoreId, x.CreatedAtUtc });
        builder.HasIndex(x => new { x.StoreId, x.ReferenceType, x.ReferenceId });
        builder.HasIndex(x => new { x.TenantId, x.StoreId, x.ClientOperationId });
        builder.HasIndex(x => new { x.ReferenceType, x.ReferenceId, x.ItemType, x.ItemId, x.Reason }).IsUnique();
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => new { x.CatalogTemplateId, x.Name }).IsUnique();
        builder.HasIndex(x => x.SortOrder);
        builder.Property(x => x.UpdatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.ExternalCode).HasMaxLength(100);
        builder.Property(x => x.SubcategoryName).HasMaxLength(200);
        builder.Property(x => x.BasePrice).HasColumnType("decimal(18,2)");
        builder.Property(x => x.IsAvailable).HasDefaultValue(true);
        builder.Property(x => x.UpdatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasIndex(x => x.ExternalCode).IsUnique();
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Category>().WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CustomizationSchema>().WithMany().HasForeignKey(x => x.CustomizationSchemaId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OptionSetConfiguration : IEntityTypeConfiguration<OptionSet>
{
    public void Configure(EntityTypeBuilder<OptionSet> builder)
    {
        builder.ToTable("OptionSets");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.UpdatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OptionItemConfiguration : IEntityTypeConfiguration<OptionItem>
{
    public void Configure(EntityTypeBuilder<OptionItem> builder)
    {
        builder.ToTable("OptionItems");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.IsAvailable).HasDefaultValue(true);
        builder.Property(x => x.UpdatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<OptionSet>().WithMany().HasForeignKey(x => x.OptionSetId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CustomizationSchemaConfiguration : IEntityTypeConfiguration<CustomizationSchema>
{
    public void Configure(EntityTypeBuilder<CustomizationSchema> builder)
    {
        builder.ToTable("CustomizationSchemas");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class SelectionGroupConfiguration : IEntityTypeConfiguration<SelectionGroup>
{
    public void Configure(EntityTypeBuilder<SelectionGroup> builder)
    {
        builder.ToTable("SelectionGroups");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Key).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Label).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => new { x.SchemaId, x.Key }).IsUnique();
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CustomizationSchema>().WithMany().HasForeignKey(x => x.SchemaId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<OptionSet>().WithMany().HasForeignKey(x => x.OptionSetId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ExtraConfiguration : IEntityTypeConfiguration<Extra>
{
    public void Configure(EntityTypeBuilder<Extra> builder)
    {
        builder.ToTable("Extras");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Price).HasColumnType("decimal(18,2)");
        builder.Property(x => x.IsAvailable).HasDefaultValue(true);
        builder.Property(x => x.UpdatedAtUtc)
            .HasDefaultValueSql("SYSUTCDATETIME()");
        builder.HasOne<CatalogTemplate>().WithMany().HasForeignKey(x => x.CatalogTemplateId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class IncludedItemConfiguration : IEntityTypeConfiguration<IncludedItem>
{
    public void Configure(EntityTypeBuilder<IncludedItem> builder)
    {
        builder.ToTable("IncludedItems");
        builder.HasKey(x => x.Id);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Extra>().WithMany().HasForeignKey(x => x.ExtraId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProductGroupOverrideConfiguration : IEntityTypeConfiguration<ProductGroupOverride>
{
    public void Configure(EntityTypeBuilder<ProductGroupOverride> builder)
    {
        builder.ToTable("ProductGroupOverrides");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.GroupKey).HasMaxLength(100).IsRequired();
        builder.HasIndex(x => new { x.ProductId, x.GroupKey }).IsUnique();
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProductGroupOverrideAllowedItemConfiguration : IEntityTypeConfiguration<ProductGroupOverrideAllowedItem>
{
    public void Configure(EntityTypeBuilder<ProductGroupOverrideAllowedItem> builder)
    {
        builder.ToTable("ProductGroupOverrideAllowedItems");
        builder.HasKey(x => new { x.ProductGroupOverrideId, x.OptionItemId });
        builder.HasOne<ProductGroupOverride>().WithMany().HasForeignKey(x => x.ProductGroupOverrideId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<OptionItem>().WithMany().HasForeignKey(x => x.OptionItemId).OnDelete(DeleteBehavior.Restrict);
    }
}
