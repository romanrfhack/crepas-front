namespace CobranzaDigital.Application.Interfaces;

public interface ITenantContext
{
    Guid? TenantId { get; }
    bool IsPlatformAdmin { get; }
    string? TenantSlug { get; }
}

