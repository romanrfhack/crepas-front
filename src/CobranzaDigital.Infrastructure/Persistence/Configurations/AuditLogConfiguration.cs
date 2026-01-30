using CobranzaDigital.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CobranzaDigital.Infrastructure.Persistence.Configurations;

public sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");

        builder.HasKey(auditLog => auditLog.Id);
        builder.Property(auditLog => auditLog.Id)
            .ValueGeneratedNever();

        builder.Property(auditLog => auditLog.Action)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(auditLog => auditLog.Actor)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(auditLog => auditLog.OccurredAt)
            .IsRequired();

        builder.Property(auditLog => auditLog.Metadata)
            .HasMaxLength(4000);
    }
}
