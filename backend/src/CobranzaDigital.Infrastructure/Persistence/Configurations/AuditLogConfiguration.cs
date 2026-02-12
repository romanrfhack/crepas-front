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

        builder.Property(auditLog => auditLog.OccurredAtUtc);

        builder.Property(auditLog => auditLog.UserId);

        builder.Property(auditLog => auditLog.EntityType)
            .HasMaxLength(100);

        builder.Property(auditLog => auditLog.EntityId)
            .HasMaxLength(200);

        builder.Property(auditLog => auditLog.BeforeJson)
            .HasMaxLength(4000);

        builder.Property(auditLog => auditLog.AfterJson)
            .HasMaxLength(4000);

        builder.Property(auditLog => auditLog.CorrelationId)
            .HasMaxLength(64);

        builder.Property(auditLog => auditLog.Source)
            .HasMaxLength(50);

        builder.Property(auditLog => auditLog.Notes)
            .HasMaxLength(500);

        builder.HasIndex(auditLog => auditLog.OccurredAtUtc);
        builder.HasIndex(auditLog => new { auditLog.EntityType, auditLog.EntityId });
        builder.HasIndex(auditLog => auditLog.UserId);
    }
}
