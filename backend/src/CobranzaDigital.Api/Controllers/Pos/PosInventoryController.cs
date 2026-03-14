using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosCatalog;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/inventory")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosInventoryController : ControllerBase
{
    private readonly IPosCatalogService _catalogService;
    private readonly ITenantContext _tenantContext;

    public PosInventoryController(IPosCatalogService catalogService, ITenantContext tenantContext)
    {
        _catalogService = catalogService;
        _tenantContext = tenantContext;
    }

    [HttpPost("validate-availability")]
    public async Task<ActionResult<ValidateInventoryAvailabilityResponseDto>> ValidateAvailability([FromBody] ValidateInventoryAvailabilityRequestDto request, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        var response = await _catalogService.ValidateInventoryAvailabilityAsync(request, ct);
        return Ok(response);
    }
}
