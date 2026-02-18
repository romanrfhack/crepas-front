using CobranzaDigital.Application.Contracts.PosSales;

namespace CobranzaDigital.Application.Interfaces.PosSales;

public interface IPosSalesService
{
    Task<CreateSaleResponseDto> CreateSaleAsync(CreateSaleRequestDto request, CancellationToken ct);
    Task<VoidSaleResponseDto> VoidSaleAsync(Guid saleId, VoidSaleRequestDto request, CancellationToken ct);
    Task<DailySummaryDto> GetDailySummaryAsync(DateOnly forDate, CancellationToken ct);
    Task<IReadOnlyList<TopProductDto>> GetTopProductsAsync(DateOnly dateFrom, DateOnly dateTo, int top, Guid? storeId, Guid? cashierUserId, Guid? shiftId, CancellationToken ct);
    Task<IReadOnlyList<PosDailySalesReportRowDto>> GetDailySalesReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct);
    Task<PosPaymentsMethodsReportDto> GetPaymentsMethodsReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct);
    Task<IReadOnlyList<PosHourlySalesReportRowDto>> GetHourlySalesReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct);
    Task<IReadOnlyList<PosCashierSalesReportRowDto>> GetCashiersSalesReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct);
    Task<IReadOnlyList<PosShiftSummaryReportRowDto>> GetShiftsSummaryReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, CancellationToken ct);
    Task<IReadOnlyList<PosVoidReasonReportRowDto>> GetVoidReasonsReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct);
}

public interface IPosShiftService
{
    Task<PosShiftDto?> GetCurrentShiftAsync(Guid? storeId, CancellationToken ct);
    Task<PosShiftDto> OpenShiftAsync(OpenPosShiftRequestDto request, CancellationToken ct);
    Task<ShiftClosePreviewDto> GetClosePreviewAsync(ShiftClosePreviewRequestDto request, CancellationToken ct);
    Task<ClosePosShiftResultDto> CloseShiftAsync(ClosePosShiftRequestDto request, CancellationToken ct);
}
