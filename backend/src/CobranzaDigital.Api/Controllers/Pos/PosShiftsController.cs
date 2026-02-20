using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/shifts")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosShiftsController : ControllerBase
{
    private readonly IPosShiftService _service;
    private readonly ITenantContext _tenantContext;

    public PosShiftsController(IPosShiftService service, ITenantContext tenantContext)
    {
        _service = service;
        _tenantContext = tenantContext;
    }

    [HttpGet("current")]
    public async Task<ActionResult<PosShiftDto>> GetCurrent([FromQuery] Guid? storeId, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        var shift = await _service.GetCurrentShiftAsync(storeId, ct);
        return shift is null ? NoContent() : Ok(shift);
    }

    [HttpPost("open")]
    public async Task<ActionResult<PosShiftDto>> Open([FromBody] OpenPosShiftRequestDto request, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        var shift = await _service.OpenShiftAsync(request, ct);
        return Ok(shift);
    }

    [HttpGet("close-preview")]
    public async Task<ActionResult<ShiftClosePreviewDto>> GetClosePreview([FromQuery] Guid? shiftId, [FromQuery] Guid? storeId, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        return await _service.GetClosePreviewAsync(new ShiftClosePreviewRequestDto(shiftId, null, storeId), ct);
    }

    [HttpPost("close-preview")]
    public async Task<ActionResult<ShiftClosePreviewDto>> GetClosePreviewV2([FromBody] ShiftClosePreviewRequestDto request, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        return await _service.GetClosePreviewAsync(request, ct);
    }

    [HttpPost("close")]
    public async Task<ActionResult<ClosePosShiftResultDto>> Close([FromBody] ClosePosShiftRequestDto request, CancellationToken ct)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        return await _service.CloseShiftAsync(request, ct);
    }
}
