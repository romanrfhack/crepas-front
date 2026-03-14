using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosPricing;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/pricing")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosPricingController : ControllerBase
{
    private readonly IPosPricingQuoteService _quoteService;
    private readonly ITenantContext _tenantContext;

    public PosPricingController(IPosPricingQuoteService quoteService, ITenantContext tenantContext)
    {
        _quoteService = quoteService;
        _tenantContext = tenantContext;
    }

    [HttpPost("quote")]
    public async Task<ActionResult<PosPricingQuoteResponseDto>> Quote([FromBody] PosPricingQuoteRequestDto request, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        var response = await _quoteService.QuoteAsync(request, ct);
        return Ok(response);
    }
}
