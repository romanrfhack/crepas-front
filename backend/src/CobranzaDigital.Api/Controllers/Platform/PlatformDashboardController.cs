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

    [HttpGet("recent-inventory-adjustments")]
    public Task<PlatformRecentInventoryAdjustmentsResponseDto> GetRecentInventoryAdjustments([FromQuery] int take = 20, [FromQuery] string? reason = null, [FromQuery] Guid? tenantId = null, [FromQuery] Guid? storeId = null, CancellationToken ct = default) =>
        _service.GetRecentInventoryAdjustmentsAsync(take, reason, tenantId, storeId, ct);

    [HttpGet("out-of-stock")]
    public Task<PlatformOutOfStockResponseDto> GetOutOfStock([FromQuery] Guid? tenantId = null, [FromQuery] Guid? storeId = null, [FromQuery] string? itemType = null, [FromQuery] string? search = null, [FromQuery] bool onlyTracked = true, [FromQuery] int top = 50, CancellationToken ct = default) =>
        _service.GetOutOfStockAsync(tenantId, storeId, itemType, search, onlyTracked, top, ct);
}
