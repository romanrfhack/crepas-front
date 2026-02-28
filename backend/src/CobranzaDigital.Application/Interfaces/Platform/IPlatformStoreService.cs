using CobranzaDigital.Application.Contracts.Platform;

namespace CobranzaDigital.Application.Interfaces.Platform;

public interface IPlatformStoreService
{
    Task<IReadOnlyList<PlatformTenantStoreListItemDto>> GetStoresByTenantAsync(Guid tenantId, CancellationToken ct);
    Task<PlatformStoreDetailsDto> GetStoreByIdAsync(Guid storeId, CancellationToken ct);
    Task<PlatformStoreDetailsDto> UpdateStoreAsync(Guid storeId, UpdatePlatformStoreRequestDto request, CancellationToken ct);
    Task<Guid> UpdateTenantDefaultStoreAsync(Guid tenantId, UpdateTenantDefaultStoreRequestDto request, CancellationToken ct);
}

