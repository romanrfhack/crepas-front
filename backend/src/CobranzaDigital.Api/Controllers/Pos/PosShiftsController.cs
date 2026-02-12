using Asp.Versioning;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces.PosSales;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/shifts")]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosShiftsController : ControllerBase
{
    private readonly IPosShiftService _service;

    public PosShiftsController(IPosShiftService service)
    {
        _service = service;
    }

    [HttpGet("current")]
    public Task<PosShiftDto?> GetCurrent(CancellationToken ct) => _service.GetCurrentShiftAsync(ct);

    [HttpPost("open")]
    public Task<PosShiftDto> Open([FromBody] OpenPosShiftRequestDto request, CancellationToken ct) =>
        _service.OpenShiftAsync(request, ct);

    [HttpPost("close")]
    public Task<PosShiftDto> Close([FromBody] ClosePosShiftRequestDto request, CancellationToken ct) =>
        _service.CloseShiftAsync(request, ct);
}
