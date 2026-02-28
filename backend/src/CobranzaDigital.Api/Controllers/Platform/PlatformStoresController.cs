using Asp.Versioning;

using CobranzaDigital.Api.Observability;
using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Application.Interfaces.Platform;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Platform;

[ApiController]
[ApiVersion("1.0")]
[Authorize(Policy = AuthorizationPolicies.PlatformOnly)]
[Route("api/v{version:apiVersion}/platform")]
public sealed class PlatformStoresController : ControllerBase
{
    private readonly IPlatformStoreService _platformStoreService;
    private readonly IAuditLogger _auditLogger;
    private readonly IAuditRequestContextAccessor _auditRequestContextAccessor;

    public PlatformStoresController(
        IPlatformStoreService platformStoreService,
        IAuditLogger auditLogger,
        IAuditRequestContextAccessor auditRequestContextAccessor)
    {
        _platformStoreService = platformStoreService;
        _auditLogger = auditLogger;
        _auditRequestContextAccessor = auditRequestContextAccessor;
    }

    [HttpGet("tenants/{tenantId:guid}/stores")]
    [ProducesResponseType(typeof(IReadOnlyList<PlatformTenantStoreListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IReadOnlyList<PlatformTenantStoreListItemDto>> GetTenantStores(Guid tenantId, CancellationToken ct) =>
        _platformStoreService.GetStoresByTenantAsync(tenantId, ct);

    [HttpGet("stores/{storeId:guid}")]
    [ProducesResponseType(typeof(PlatformStoreDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<PlatformStoreDetailsDto> GetStoreDetails(Guid storeId, CancellationToken ct) =>
        _platformStoreService.GetStoreByIdAsync(storeId, ct);

    [HttpPut("stores/{storeId:guid}")]
    [ProducesResponseType(typeof(PlatformStoreDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<PlatformStoreDetailsDto> UpdateStore(Guid storeId, [FromBody] UpdatePlatformStoreRequestDto request, CancellationToken ct)
    {
        var before = await _platformStoreService.GetStoreByIdAsync(storeId, ct).ConfigureAwait(false);
        var updated = await _platformStoreService.UpdateStoreAsync(storeId, request, ct).ConfigureAwait(false);

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.UpdateStore,
                _auditRequestContextAccessor.GetUserId(),
                _auditRequestContextAccessor.GetCorrelationId(),
                EntityType: "Store",
                EntityId: storeId.ToString(),
                Before: new
                {
                    before.Name,
                    before.IsActive,
                    before.TimeZoneId
                },
                After: new
                {
                    updated.Name,
                    updated.IsActive,
                    updated.TimeZoneId
                },
                Source: "Api",
                Notes: null),
            ct).ConfigureAwait(false);

        return updated;
    }

    [HttpPut("tenants/{tenantId:guid}/default-store")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateDefaultStore(Guid tenantId, [FromBody] UpdateTenantDefaultStoreRequestDto request, CancellationToken ct)
    {
        var tenantStores = await _platformStoreService.GetStoresByTenantAsync(tenantId, ct).ConfigureAwait(false);
        var previousDefaultStoreId = tenantStores.FirstOrDefault(store => store.IsDefaultStore)?.Id;

        var newDefaultStoreId = await _platformStoreService.UpdateTenantDefaultStoreAsync(tenantId, request, ct).ConfigureAwait(false);

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.UpdateTenantDefaultStore,
                _auditRequestContextAccessor.GetUserId(),
                _auditRequestContextAccessor.GetCorrelationId(),
                EntityType: "Tenant",
                EntityId: tenantId.ToString(),
                Before: new { DefaultStoreId = previousDefaultStoreId },
                After: new { DefaultStoreId = newDefaultStoreId },
                Source: "Api",
                Notes: null),
            ct).ConfigureAwait(false);

        return NoContent();
    }
}

