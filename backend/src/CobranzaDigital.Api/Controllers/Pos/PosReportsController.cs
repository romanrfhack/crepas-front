using Asp.Versioning;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces.PosSales;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/reports")]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosReportsController : ControllerBase
{
    private readonly IPosSalesService _service;

    public PosReportsController(IPosSalesService service)
    {
        _service = service;
    }

    [HttpGet("daily-summary")]
    public Task<DailySummaryDto> GetDailySummary([FromQuery] DateOnly date, CancellationToken ct)
    {
        return _service.GetDailySummaryAsync(date, ct);
    }

    [HttpGet("top-products")]
    public Task<IReadOnlyList<TopProductDto>> GetTopProducts(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] int top = 10,
        CancellationToken ct = default)
    {
        return _service.GetTopProductsAsync(dateFrom, dateTo, top, ct);
    }
}
