using CobranzaDigital.Application.Contracts.Platform;

namespace CobranzaDigital.Application.Interfaces.Platform;

public interface IPlatformTenantService
{
    Task<PlatformTenantDetailsDto> GetTenantDetailsAsync(Guid tenantId, CancellationToken ct);
    Task<PlatformTenantDetailsDto> UpdateTenantAsync(Guid tenantId, UpdatePlatformTenantRequestDto request, CancellationToken ct);
}
