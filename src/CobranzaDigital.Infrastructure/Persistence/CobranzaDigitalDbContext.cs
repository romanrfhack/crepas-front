using CobranzaDigital.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Persistence;

public sealed class CobranzaDigitalDbContext : DbContext
{
    public CobranzaDigitalDbContext(DbContextOptions<CobranzaDigitalDbContext> options)
        : base(options)
    {
    }

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CobranzaDigitalDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
