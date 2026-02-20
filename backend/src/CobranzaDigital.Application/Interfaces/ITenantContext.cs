namespace CobranzaDigital.Application.Interfaces;

public interface ITenantContext
{
    Guid? TenantId { get; }
    Guid? EffectiveTenantId { get; }
    bool IsPlatformAdmin { get; }
    string? TenantSlug { get; }
}
