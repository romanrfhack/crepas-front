using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosCatalog;
using CobranzaDigital.Application.Interfaces.PosSales;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/reports")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[Authorize(Policy = AuthorizationPolicies.PosReportViewer)]
public sealed class PosReportsController : ControllerBase
{
    private readonly IPosSalesService _service;
    private readonly IPosCatalogService _catalogService;
    private readonly ITenantContext _tenantContext;

    public PosReportsController(IPosSalesService service, IPosCatalogService catalogService, ITenantContext tenantContext)
    {
        _service = service;
        _catalogService = catalogService;
        _tenantContext = tenantContext;
    }

    [HttpGet("daily-summary")]
    public Task<ActionResult<DailySummaryDto>> GetDailySummary([FromQuery] DateOnly date, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _service.GetDailySummaryAsync(date, ct));

    [HttpGet("top-products")]
    public Task<ActionResult<IReadOnlyList<TopProductDto>>> GetTopProducts(
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        [FromQuery] int top = 10,
        [FromQuery] Guid? storeId = null,
        [FromQuery] Guid? cashierUserId = null,
        [FromQuery] Guid? shiftId = null,
        CancellationToken ct = default) =>
        ExecuteTenantScopedAsync(() => _service.GetTopProductsAsync(dateFrom, dateTo, top, storeId, cashierUserId, shiftId, ct));

    [HttpGet("sales/daily")]
    public Task<IReadOnlyList<PosDailySalesReportRowDto>> GetDailySales([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, CancellationToken ct) =>
        _service.GetDailySalesReportAsync(dateFrom, dateTo, storeId, ct);

    [HttpGet("payments/methods")]
    public Task<PosPaymentsMethodsReportDto> GetPaymentMethods([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, CancellationToken ct) =>
        _service.GetPaymentsMethodsReportAsync(dateFrom, dateTo, storeId, ct);

    [HttpGet("sales/hourly")]
    public Task<ActionResult<IReadOnlyList<PosHourlySalesReportRowDto>>> GetSalesHourly([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _service.GetHourlySalesReportAsync(dateFrom, dateTo, storeId, ct));

    [HttpGet("sales/cashiers")]
    public Task<ActionResult<IReadOnlyList<PosCashierSalesReportRowDto>>> GetSalesByCashier([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _service.GetCashiersSalesReportAsync(dateFrom, dateTo, storeId, ct));

    [HttpGet("shifts/summary")]
    public Task<ActionResult<IReadOnlyList<PosShiftSummaryReportRowDto>>> GetShiftsSummary([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, [FromQuery] Guid? cashierUserId, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _service.GetShiftsSummaryReportAsync(dateFrom, dateTo, storeId, cashierUserId, ct));

    [HttpGet("voids/reasons")]
    public Task<ActionResult<IReadOnlyList<PosVoidReasonReportRowDto>>> GetVoidsReasons([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _service.GetVoidReasonsReportAsync(dateFrom, dateTo, storeId, ct));

    [HttpGet("sales/categories")]
    public Task<ActionResult<PosCategorySalesMixResponseDto>> GetSalesByCategories([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, [FromQuery] Guid? cashierUserId, [FromQuery] Guid? shiftId, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _service.GetSalesByCategoriesAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct));

    [HttpGet("sales/products")]
    public Task<ActionResult<PosProductSalesMixResponseDto>> GetSalesByProducts([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, [FromQuery] Guid? cashierUserId, [FromQuery] Guid? shiftId, [FromQuery] int top = 20, CancellationToken ct = default) =>
        ExecuteTenantScopedAsync(() => _service.GetSalesByProductsAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, top, ct));

    [HttpGet("sales/addons/extras")]
    public Task<ActionResult<PosTopExtraAddonsResponseDto>> GetSalesAddonsExtras([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, [FromQuery] Guid? cashierUserId, [FromQuery] Guid? shiftId, [FromQuery] int top = 20, CancellationToken ct = default) =>
        ExecuteTenantScopedAsync(() => _service.GetSalesAddonsExtrasAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, top, ct));

    [HttpGet("sales/addons/options")]
    public Task<ActionResult<PosTopOptionAddonsResponseDto>> GetSalesAddonsOptions([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, [FromQuery] Guid? cashierUserId, [FromQuery] Guid? shiftId, [FromQuery] int top = 20, CancellationToken ct = default) =>
        ExecuteTenantScopedAsync(() => _service.GetSalesAddonsOptionsAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, top, ct));

    [HttpGet("kpis/summary")]
    public Task<PosKpisSummaryDto> GetKpisSummary([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, [FromQuery] Guid? cashierUserId, [FromQuery] Guid? shiftId, CancellationToken ct) =>
        _service.GetKpisSummaryAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct);

    [HttpGet("control/cash-differences")]
    public Task<PosCashDifferencesResponseDto> GetControlCashDifferences([FromQuery] DateOnly dateFrom, [FromQuery] DateOnly dateTo, [FromQuery] Guid? storeId, [FromQuery] Guid? cashierUserId, CancellationToken ct) =>
        _service.GetCashDifferencesControlAsync(dateFrom, dateTo, storeId, cashierUserId, ct);

    [HttpGet("inventory/current")]
    public Task<ActionResult<IReadOnlyList<InventoryReportRowDto>>> GetInventoryCurrent([FromQuery] Guid storeId, [FromQuery] string? itemType, [FromQuery] string? search, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _catalogService.GetInventoryCurrentReportAsync(storeId, itemType, search, ct));

    [HttpGet("inventory/low-stock")]
    public Task<ActionResult<IReadOnlyList<InventoryReportRowDto>>> GetInventoryLowStock([FromQuery] Guid storeId, [FromQuery] decimal threshold = 5m, [FromQuery] string? itemType = null, [FromQuery] string? search = null, CancellationToken ct = default) =>
        ExecuteTenantScopedAsync(() => _catalogService.GetInventoryLowStockReportAsync(storeId, threshold, itemType, search, ct));

    [HttpGet("inventory/out-of-stock")]
    public Task<ActionResult<IReadOnlyList<InventoryReportRowDto>>> GetInventoryOutOfStock([FromQuery] Guid storeId, [FromQuery] string? itemType, [FromQuery] string? search, CancellationToken ct) =>
        ExecuteTenantScopedAsync(() => _catalogService.GetInventoryOutOfStockReportAsync(storeId, itemType, search, ct));

    private async Task<ActionResult<T>> ExecuteTenantScopedAsync<T>(Func<Task<T>> action)
    {
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
        if (validation is not null)
        {
            return validation;
        }

        return await action();
    }
}
