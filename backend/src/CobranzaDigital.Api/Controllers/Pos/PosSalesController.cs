using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/sales")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosSalesController : ControllerBase
{
    private readonly IPosSalesService _service;
    private readonly ITenantContext _tenantContext;

    public PosSalesController(IPosSalesService service, ITenantContext tenantContext)
    {
        _service = service;
        _tenantContext = tenantContext;
    }

    [HttpPost]
    public async Task<ActionResult<CreateSaleResponseDto>> Create([FromBody] CreateSaleRequestDto request, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        return await _service.CreateSaleAsync(request, ct);
    }

    [HttpPost("{saleId:guid}/void")]
    public async Task<ActionResult<VoidSaleResponseDto>> VoidSale(Guid saleId, [FromBody] VoidSaleRequestDto request, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        return await _service.VoidSaleAsync(saleId, request, ct);
    }
}
