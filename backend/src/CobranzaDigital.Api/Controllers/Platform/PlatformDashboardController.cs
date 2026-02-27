using Asp.Versioning;

using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Application.Interfaces.Platform;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Platform;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/platform/dashboard")]
[Authorize(Policy = AuthorizationPolicies.PlatformOnly)]
public sealed class PlatformDashboardController : ControllerBase
{
    private readonly IPlatformDashboardService _service;

    public PlatformDashboardController(IPlatformDashboardService service) => _service = service;

    [HttpGet("summary")]
    public Task<PlatformDashboardSummaryDto> GetSummary([FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo, [FromQuery] decimal threshold = 5m, CancellationToken ct = default) =>
        _service.GetSummaryAsync(dateFrom, dateTo, threshold, ct);

    [HttpGet("top-tenants")]
    public Task<PlatformTopTenantsResponseDto> GetTopTenants([FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo, [FromQuery] int top = 10, [FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        _service.GetTopTenantsAsync(dateFrom, dateTo, top, includeInactive, ct);

    [HttpGet("alerts")]
    public Task<PlatformDashboardAlertsResponseDto> GetAlerts(CancellationToken ct = default) =>
        _service.GetAlertsAsync(ct);

    [HttpGet("alerts/drilldown")]
    public async Task<ActionResult<PlatformDashboardAlertDrilldownResponseDto>> GetAlertsDrilldown([FromQuery] string code, [FromQuery] int take = 100, [FromQuery] Guid? tenantId = null, [FromQuery] Guid? storeId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return BadRequest("Query param 'code' is required.");
        }

        try
        {
            return Ok(await _service.GetAlertsDrilldownAsync(code, take, tenantId, storeId, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("tenants/{tenantId:guid}/overview")]
    public Task<PlatformTenantOverviewDto> GetTenantOverview(Guid tenantId, [FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo, [FromQuery] decimal threshold = 5m, CancellationToken ct = default) =>
        _service.GetTenantOverviewAsync(tenantId, dateFrom, dateTo, threshold, ct);

    [HttpGet("stores/{storeId:guid}/stockout-details")]
    public Task<PlatformStoreStockoutDetailDto> GetStoreStockoutDetails(Guid storeId, [FromQuery] string? itemType = null, [FromQuery] string? search = null, [FromQuery] decimal threshold = 5m, [FromQuery] string? mode = null, [FromQuery] int take = 200, CancellationToken ct = default) =>
        _service.GetStoreStockoutDetailsAsync(storeId, itemType, search, threshold, mode, take, ct);

    [HttpGet("recent-inventory-adjustments")]
    public Task<PlatformRecentInventoryAdjustmentsResponseDto> GetRecentInventoryAdjustments([FromQuery] int take = 20, [FromQuery] string? reason = null, [FromQuery] Guid? tenantId = null, [FromQuery] Guid? storeId = null, CancellationToken ct = default) =>
        _service.GetRecentInventoryAdjustmentsAsync(take, reason, tenantId, storeId, ct);

    [HttpGet("out-of-stock")]
    public Task<PlatformOutOfStockResponseDto> GetOutOfStock([FromQuery] Guid? tenantId = null, [FromQuery] Guid? storeId = null, [FromQuery] string? itemType = null, [FromQuery] string? search = null, [FromQuery] bool onlyTracked = true, [FromQuery] int top = 50, CancellationToken ct = default) =>
        _service.GetOutOfStockAsync(tenantId, storeId, itemType, search, onlyTracked, top, ct);


    [HttpGet("sales-trend")]
    public Task<PlatformSalesTrendResponseDto> GetSalesTrend([FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo, [FromQuery] string? granularity = null, CancellationToken ct = default) =>
        _service.GetSalesTrendAsync(dateFrom, dateTo, granularity, ct);

    [HttpGet("top-void-tenants")]
    public Task<PlatformTopVoidTenantsResponseDto> GetTopVoidTenants([FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo, [FromQuery] int top = 10, CancellationToken ct = default) =>
        _service.GetTopVoidTenantsAsync(dateFrom, dateTo, top, ct);

    [HttpGet("stockout-hotspots")]
    public Task<PlatformStockoutHotspotsResponseDto> GetStockoutHotspots([FromQuery] decimal threshold = 5m, [FromQuery] int top = 10, [FromQuery] string? itemType = null, CancellationToken ct = default) =>
        _service.GetStockoutHotspotsAsync(threshold, top, itemType, ct);

    [HttpGet("activity-feed")]
    public Task<PlatformActivityFeedResponseDto> GetActivityFeed([FromQuery] int take = 20, [FromQuery] string? eventType = null, CancellationToken ct = default) =>
        _service.GetActivityFeedAsync(take, eventType, ct);

    [HttpGet("executive-signals")]
    public Task<PlatformExecutiveSignalsDto> GetExecutiveSignals([FromQuery] DateTimeOffset? dateFrom, [FromQuery] DateTimeOffset? dateTo, [FromQuery] bool previousPeriodCompare = true, CancellationToken ct = default) =>
        _service.GetExecutiveSignalsAsync(dateFrom, dateTo, previousPeriodCompare, ct);
}
