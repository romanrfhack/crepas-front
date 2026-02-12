using CobranzaDigital.Domain.Entities;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CobranzaDigital.Infrastructure.Persistence.Configurations;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => x.Name).IsUnique();
        builder.HasIndex(x => x.SortOrder);
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
        builder.HasIndex(x => x.ExternalCode).IsUnique();
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
    }
}

public sealed class OptionItemConfiguration : IEntityTypeConfiguration<OptionItem>
{
    public void Configure(EntityTypeBuilder<OptionItem> builder)
    {
        builder.ToTable("OptionItems");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
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
