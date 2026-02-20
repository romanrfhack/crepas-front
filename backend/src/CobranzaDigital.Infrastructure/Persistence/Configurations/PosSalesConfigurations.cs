using CobranzaDigital.Domain.Entities;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CobranzaDigital.Infrastructure.Persistence.Configurations;

public sealed class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToTable("Sales");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Folio).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        builder.Property(x => x.Subtotal).HasColumnType("decimal(18,2)");
        builder.Property(x => x.Total).HasColumnType("decimal(18,2)");
        builder.Property(x => x.CorrelationId).HasMaxLength(64);
        builder.Property(x => x.VoidReasonCode).HasMaxLength(50);
        builder.Property(x => x.VoidReasonText).HasMaxLength(200);
        builder.Property(x => x.VoidNote).HasMaxLength(500);
        builder.Property(x => x.Status).HasConversion<int>();
        builder.HasIndex(x => x.OccurredAtUtc);
        builder.HasIndex(x => x.ClientSaleId).IsUnique();
        builder.HasIndex(x => x.ClientVoidId).IsUnique();
        builder.HasIndex(x => x.StoreId);
        builder.HasIndex(x => x.TenantId);
        builder.HasIndex(x => x.ShiftId);
        builder.HasOne<PosShift>().WithMany().HasForeignKey(x => x.ShiftId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PosShiftConfiguration : IEntityTypeConfiguration<PosShift>
{
    public void Configure(EntityTypeBuilder<PosShift> builder)
    {
        builder.ToTable("PosShifts");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.OpenedByEmail).HasMaxLength(320);
        builder.Property(x => x.ClosedByEmail).HasMaxLength(320);
        builder.Property(x => x.OpenNotes).HasMaxLength(500);
        builder.Property(x => x.CloseNotes).HasMaxLength(500);
        builder.Property(x => x.OpeningCashAmount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.ClosingCashAmount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.ExpectedCashAmount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.CashDifference).HasColumnType("decimal(18,2)");
        builder.Property(x => x.DenominationsJson).HasMaxLength(4000);
        builder.Property(x => x.CloseReason).HasMaxLength(500);
        builder.HasIndex(x => x.StoreId);
        builder.HasIndex(x => x.TenantId);
        builder.HasIndex(x => x.OpenOperationId).IsUnique();
        builder.HasIndex(x => x.CloseOperationId).IsUnique();
        builder.HasIndex(x => new { x.OpenedByUserId, x.StoreId, x.ClosedAtUtc }).IsUnique();
        builder.HasIndex(x => x.ClosedAtUtc);
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class SaleItemConfiguration : IEntityTypeConfiguration<SaleItem>
{
    public void Configure(EntityTypeBuilder<SaleItem> builder)
    {
        builder.ToTable("SaleItems");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ProductExternalCode).HasMaxLength(100);
        builder.Property(x => x.ProductNameSnapshot).HasMaxLength(200).IsRequired();
        builder.Property(x => x.UnitPriceSnapshot).HasColumnType("decimal(18,2)");
        builder.Property(x => x.LineTotal).HasColumnType("decimal(18,2)");
        builder.Property(x => x.NotesSnapshot).HasMaxLength(500);
        builder.HasIndex(x => x.SaleId);
        builder.HasOne<Sale>().WithMany().HasForeignKey(x => x.SaleId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class SaleItemSelectionConfiguration : IEntityTypeConfiguration<SaleItemSelection>
{
    public void Configure(EntityTypeBuilder<SaleItemSelection> builder)
    {
        builder.ToTable("SaleItemSelections");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.GroupKey).HasMaxLength(100).IsRequired();
        builder.Property(x => x.OptionItemNameSnapshot).HasMaxLength(200).IsRequired();
        builder.Property(x => x.PriceDeltaSnapshot).HasColumnType("decimal(18,2)");
        builder.HasIndex(x => x.SaleItemId);
        builder.HasOne<SaleItem>().WithMany().HasForeignKey(x => x.SaleItemId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<OptionItem>().WithMany().HasForeignKey(x => x.OptionItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class SaleItemExtraConfiguration : IEntityTypeConfiguration<SaleItemExtra>
{
    public void Configure(EntityTypeBuilder<SaleItemExtra> builder)
    {
        builder.ToTable("SaleItemExtras");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ExtraNameSnapshot).HasMaxLength(200).IsRequired();
        builder.Property(x => x.UnitPriceSnapshot).HasColumnType("decimal(18,2)");
        builder.Property(x => x.LineTotal).HasColumnType("decimal(18,2)");
        builder.HasIndex(x => x.SaleItemId);
        builder.HasOne<SaleItem>().WithMany().HasForeignKey(x => x.SaleItemId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Extra>().WithMany().HasForeignKey(x => x.ExtraId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Method).HasConversion<int>();
        builder.Property(x => x.Amount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.Reference).HasMaxLength(200);
        builder.Property(x => x.CreatedAtUtc);
        builder.HasIndex(x => x.SaleId);
        builder.HasOne<Sale>().WithMany().HasForeignKey(x => x.SaleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class StoreConfiguration : IEntityTypeConfiguration<Store>
{
    public void Configure(EntityTypeBuilder<Store> builder)
    {
        builder.ToTable("Stores");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.TimeZoneId).HasMaxLength(100).IsRequired();
        builder.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
        builder.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class VerticalConfiguration : IEntityTypeConfiguration<Vertical>
{
    public void Configure(EntityTypeBuilder<Vertical> builder)
    {
        builder.ToTable("Verticals");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.HasIndex(x => x.Name).IsUnique();
    }
}

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("Tenants");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Slug).HasMaxLength(100).IsRequired();
        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasOne<Vertical>().WithMany().HasForeignKey(x => x.VerticalId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.DefaultStoreId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PosSettingsConfiguration : IEntityTypeConfiguration<PosSettings>
{
    public void Configure(EntityTypeBuilder<PosSettings> builder)
    {
        builder.ToTable("PosSettings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.CashDifferenceThreshold).HasColumnType("decimal(18,2)");
        builder.HasOne<Store>().WithMany().HasForeignKey(x => x.DefaultStoreId).OnDelete(DeleteBehavior.Restrict);
    }
}
