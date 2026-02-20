using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/shifts")]
[Authorize(Policy = AuthorizationPolicies.TenantScoped)]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosShiftsController : ControllerBase
{
    private readonly IPosShiftService _service;

    public PosShiftsController(IPosShiftService service)
    {
        _service = service;
    }

    [HttpGet("current")]
    public async Task<ActionResult<PosShiftDto>> GetCurrent([FromQuery] Guid? storeId, CancellationToken ct)
    {
        var shift = await _service.GetCurrentShiftAsync(storeId, ct);
        return shift is null ? NoContent() : Ok(shift);
    }

    [HttpPost("open")]
    public async Task<ActionResult<PosShiftDto>> Open([FromBody] OpenPosShiftRequestDto request, CancellationToken ct)
    {
        var shift = await _service.OpenShiftAsync(request, ct);
        return Ok(shift);
    }

    [HttpGet("close-preview")]
    public Task<ShiftClosePreviewDto> GetClosePreview([FromQuery] Guid? shiftId, [FromQuery] Guid? storeId, CancellationToken ct) =>
        _service.GetClosePreviewAsync(new ShiftClosePreviewRequestDto(shiftId, null, storeId), ct);

    [HttpPost("close-preview")]
    public Task<ShiftClosePreviewDto> GetClosePreviewV2([FromBody] ShiftClosePreviewRequestDto request, CancellationToken ct) =>
        _service.GetClosePreviewAsync(request, ct);

    [HttpPost("close")]
    public Task<ClosePosShiftResultDto> Close([FromBody] ClosePosShiftRequestDto request, CancellationToken ct) =>
        _service.CloseShiftAsync(request, ct);
}
