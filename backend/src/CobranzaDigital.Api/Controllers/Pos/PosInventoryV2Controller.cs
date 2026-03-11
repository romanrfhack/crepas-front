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
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        _service.GetInventoryBalancesV2Async(storeId, q, categoryId, tracked, page, pageSize, ct);

    [HttpPost("adjustments")]
    public Task<InventoryAdjustmentV2ResultDto> CreateAdjustment(
        [FromBody] CreateInventoryAdjustmentV2Request request,
        CancellationToken ct = default) =>
        _service.CreateInventoryAdjustmentV2Async(request, ct);
}
