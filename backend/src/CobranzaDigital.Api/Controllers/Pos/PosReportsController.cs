using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/reports")]
[Authorize(Policy = AuthorizationPolicies.PosReportViewer)]
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
        [FromQuery] Guid? storeId = null,
        [FromQuery] Guid? cashierUserId = null,
        [FromQuery] Guid? shiftId = null,
        CancellationToken ct = default)
    {
        return _service.GetTopProductsAsync(dateFrom, dateTo, top, storeId, cashierUserId, shiftId, ct);
    }

    [HttpGet("sales/daily")]
    public Task<IReadOnlyList<PosDailySalesReportRowDto>> GetDailySales(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] Guid? storeId,
        CancellationToken ct)
    {
        return _service.GetDailySalesReportAsync(dateFrom, dateTo, storeId, ct);
    }

    [HttpGet("payments/methods")]
    public Task<PosPaymentsMethodsReportDto> GetPaymentMethods(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] Guid? storeId,
        CancellationToken ct)
    {
        return _service.GetPaymentsMethodsReportAsync(dateFrom, dateTo, storeId, ct);
    }

    [HttpGet("sales/hourly")]
    public Task<IReadOnlyList<PosHourlySalesReportRowDto>> GetSalesHourly(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] Guid? storeId,
        CancellationToken ct)
    {
        return _service.GetHourlySalesReportAsync(dateFrom, dateTo, storeId, ct);
    }

    [HttpGet("sales/cashiers")]
    public Task<IReadOnlyList<PosCashierSalesReportRowDto>> GetSalesByCashier(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] Guid? storeId,
        CancellationToken ct)
    {
        return _service.GetCashiersSalesReportAsync(dateFrom, dateTo, storeId, ct);
    }

    [HttpGet("shifts/summary")]
    public Task<IReadOnlyList<PosShiftSummaryReportRowDto>> GetShiftsSummary(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] Guid? storeId,
        [FromQuery] Guid? cashierUserId,
        CancellationToken ct)
    {
        return _service.GetShiftsSummaryReportAsync(dateFrom, dateTo, storeId, cashierUserId, ct);
    }

    [HttpGet("voids/reasons")]
    public Task<IReadOnlyList<PosVoidReasonReportRowDto>> GetVoidsReasons(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] Guid? storeId,
        CancellationToken ct)
    {
        return _service.GetVoidReasonsReportAsync(dateFrom, dateTo, storeId, ct);
    }
}
