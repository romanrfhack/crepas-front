using Asp.Versioning;

using CobranzaDigital.Api.FeatureManagement;
using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces.PosCatalog;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/pos/inventory")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[RequireTenantSelectionForOperation]
[Authorize(Policy = AuthorizationPolicies.PosAdmin)]
[FeatureFlag("inventory.v2.enabled")]
public sealed class PosInventoryV2Controller : ControllerBase
{
    private readonly IPosCatalogService _service;

    public PosInventoryV2Controller(IPosCatalogService service)
    {
        _service = service;
    }

    [HttpGet("balances")]
    public Task<PagedInventoryBalancesDto> GetBalances(
        [FromQuery] Guid storeId,
        [FromQuery] string? q,
        [FromQuery] Guid? categoryId,
        [FromQuery] bool? tracked,
        [FromQuery] decimal? onHandMin,
        [FromQuery] decimal? onHandMax,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        _service.GetInventoryBalancesV2Async(storeId, q, categoryId, tracked, onHandMin, onHandMax, page, pageSize, ct);


    [HttpGet("movements")]
    public Task<PagedInventoryMovementsDto> GetMovements(
        [FromQuery] Guid storeId,
        [FromQuery] string itemType,
        [FromQuery] Guid itemId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? reason,
        [FromQuery] string? referenceType,
        [FromQuery] string? referenceId,
        [FromQuery] Guid? createdByUserId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        _service.GetInventoryMovementsV2Async(storeId, itemType, itemId, from, to, reason, referenceType, referenceId, createdByUserId, page, pageSize, ct);

    [HttpPost("adjustments")]
    public Task<InventoryAdjustmentV2ResultDto> CreateAdjustment(
        [FromBody] CreateInventoryAdjustmentV2Request request,
        CancellationToken ct = default) =>
        _service.CreateInventoryAdjustmentV2Async(request, ct);
}
