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

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(CobranzaDigitalDbContext).Assembly);
    }
}
