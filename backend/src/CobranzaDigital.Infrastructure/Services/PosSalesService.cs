using System.Diagnostics;
using System.Security.Claims;

using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosSales;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Options;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using TimeZoneConverter;

using ValidationException = CobranzaDigital.Application.Common.Exceptions.ValidationException;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PosSalesService : IPosSalesService
{
    private readonly CobranzaDigitalDbContext _db;
    private readonly IAuditLogger _auditLogger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<PosSalesService> _logger;
    private readonly PosOptions _posOptions;
    private readonly IBusinessTime _businessTime;
    private readonly PosStoreContextService _storeContext;
    private readonly IPointsReversalService _pointsReversalService;

    public PosSalesService(
        CobranzaDigitalDbContext db,
        IAuditLogger auditLogger,
        IHttpContextAccessor httpContextAccessor,
        ILogger<PosSalesService> logger,
        IOptions<PosOptions> posOptions,
        IBusinessTime businessTime,
        PosStoreContextService storeContext,
        IPointsReversalService pointsReversalService)
    {
        _db = db;
        _auditLogger = auditLogger;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
        _posOptions = posOptions.Value;
        _businessTime = businessTime;
        _storeContext = storeContext;
        _pointsReversalService = pointsReversalService;
    }

    public async Task<CreateSaleResponseDto> CreateSaleAsync(CreateSaleRequestDto request, CancellationToken ct)
    {
        var payments = ResolvePayments(request);
        ValidateRequest(request, payments);

        // SQL Server retry strategies require user transactions to be created inside ExecuteAsync.
        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
            var correlationId = GetCorrelationId();
            var (storeId, _) = await _storeContext.ResolveStoreAsync(request.StoreId, ct).ConfigureAwait(false);

            Guid? openShiftId = null;
            if (_posOptions.RequireOpenShiftForSales)
            {
                var openShiftCandidates = await _db.PosShifts.AsNoTracking()
                    .Where(x => x.ClosedAtUtc == null && x.OpenedByUserId == userId && x.StoreId == storeId)
                    .Select(x => new { x.Id, x.OpenedAtUtc })
                    .ToListAsync(ct)
                    .ConfigureAwait(false);

                openShiftId = openShiftCandidates
                    .OrderByDescending(x => x.OpenedAtUtc)
                    .Select(x => (Guid?)x.Id)
                    .FirstOrDefault();

                if (!openShiftId.HasValue)
                {
                    throw new ConflictException("Cannot register sale because there is no open shift.");
                }
            }

            if (request.ClientSaleId.HasValue)
            {
                var existing = await _db.Sales.AsNoTracking()
                    .Where(x => x.ClientSaleId == request.ClientSaleId.Value)
                    .Select(x => new CreateSaleResponseDto(x.Id, x.Folio, x.OccurredAtUtc, x.Total))
                    .FirstOrDefaultAsync(ct)
                    .ConfigureAwait(false);

                if (existing is not null)
                {
                    LogAction("IdempotentHit", "Sale", existing.SaleId, correlationId);
                    return existing;
                }
            }

            var productIds = request.Items.Select(x => x.ProductId).Distinct().ToArray();
            var products = await _db.Products.AsNoTracking()
                .Where(x => productIds.Contains(x.Id) && x.IsActive)
                .ToDictionaryAsync(x => x.Id, ct)
                .ConfigureAwait(false);

            if (products.Count != productIds.Length)
            {
                throw new NotFoundException("One or more products were not found or are inactive.");
            }

            var optionIds = request.Items
                .SelectMany(x => x.Selections ?? [])
                .Select(x => x.OptionItemId)
                .Distinct()
                .ToArray();
            var options = optionIds.Length == 0
                ? new Dictionary<Guid, OptionItem>()
                : await _db.OptionItems.AsNoTracking()
                    .Where(x => optionIds.Contains(x.Id) && x.IsActive)
                    .ToDictionaryAsync(x => x.Id, ct)
                    .ConfigureAwait(false);

            if (options.Count != optionIds.Length)
            {
                throw new NotFoundException("One or more option items were not found or are inactive.");
            }

            var extraIds = request.Items
                .SelectMany(x => x.Extras ?? [])
                .Select(x => x.ExtraId)
                .Distinct()
                .ToArray();
            var extras = extraIds.Length == 0
                ? new Dictionary<Guid, Extra>()
                : await _db.Extras.AsNoTracking()
                    .Where(x => extraIds.Contains(x.Id) && x.IsActive)
                    .ToDictionaryAsync(x => x.Id, ct)
                    .ConfigureAwait(false);

            if (extras.Count != extraIds.Length)
            {
                throw new NotFoundException("One or more extras were not found or are inactive.");
            }

            var saleId = Guid.NewGuid();
            var occurredAtUtc = request.OccurredAtUtc ?? DateTimeOffset.UtcNow;
            var sale = new Sale
            {
                Id = saleId,
                Folio = GenerateFolio(occurredAtUtc),
                OccurredAtUtc = occurredAtUtc,
                Currency = "MXN",
                CreatedByUserId = userId,
                CorrelationId = correlationId,
                ClientSaleId = request.ClientSaleId,
                ShiftId = openShiftId,
                StoreId = storeId,
                Status = SaleStatus.Completed
            };

            decimal subtotal = 0m;
            foreach (var requestItem in request.Items)
            {
                var product = products[requestItem.ProductId];
                var selectionRows = requestItem.Selections ?? [];
                var extraRows = requestItem.Extras ?? [];

                const decimal selectionUnitDelta = 0m;
                var baseLineTotal = (product.BasePrice + selectionUnitDelta) * requestItem.Quantity;

                var saleItem = new SaleItem
                {
                    Id = Guid.NewGuid(),
                    SaleId = sale.Id,
                    ProductId = product.Id,
                    ProductExternalCode = product.ExternalCode,
                    ProductNameSnapshot = product.Name,
                    UnitPriceSnapshot = product.BasePrice,
                    Quantity = requestItem.Quantity,
                    LineTotal = baseLineTotal
                };
                _db.SaleItems.Add(saleItem);

                foreach (var selection in selectionRows)
                {
                    var option = options[selection.OptionItemId];
                    _db.SaleItemSelections.Add(new SaleItemSelection
                    {
                        Id = Guid.NewGuid(),
                        SaleItemId = saleItem.Id,
                        GroupKey = selection.GroupKey,
                        OptionItemId = option.Id,
                        OptionItemNameSnapshot = option.Name,
                        PriceDeltaSnapshot = 0m
                    });
                }

                decimal extrasLineTotal = 0m;
                foreach (var extraRow in extraRows)
                {
                    var extra = extras[extraRow.ExtraId];
                    var lineTotal = extra.Price * extraRow.Quantity;
                    extrasLineTotal += lineTotal;

                    _db.SaleItemExtras.Add(new SaleItemExtra
                    {
                        Id = Guid.NewGuid(),
                        SaleItemId = saleItem.Id,
                        ExtraId = extra.Id,
                        ExtraNameSnapshot = extra.Name,
                        UnitPriceSnapshot = extra.Price,
                        Quantity = extraRow.Quantity,
                        LineTotal = lineTotal
                    });
                }

                saleItem.LineTotal += extrasLineTotal;
                subtotal += saleItem.LineTotal;
            }

            sale.Subtotal = subtotal;
            sale.Total = subtotal;

            var totalPaid = RoundMoney(payments.Sum(x => x.Amount));
            if (totalPaid != sale.Total)
            {
                var debugItems = request.Items.Select(item =>
                {
                    var product = products[item.ProductId];
                    var requestedExtras = item.Extras ?? [];
                    var extrasTotal = requestedExtras.Sum(extraRow => extras[extraRow.ExtraId].Price * extraRow.Quantity);

                    return new
                    {
                        item.ProductId,
                        ProductName = product.Name,
                        ProductBasePrice = product.BasePrice,
                        item.Quantity,
                        Extras = requestedExtras.Select(extraRow => new
                        {
                            extraRow.ExtraId,
                            ExtraName = extras[extraRow.ExtraId].Name,
                            ExtraUnitPrice = extras[extraRow.ExtraId].Price,
                            extraRow.Quantity,
                            LineTotal = extras[extraRow.ExtraId].Price * extraRow.Quantity
                        }).ToArray(),
                        ItemTotal = (product.BasePrice * item.Quantity) + extrasTotal
                    };
                }).ToArray();

                PosSalesLog.PaymentMismatch(
                    _logger,
                    sale.Id,
                    storeId,
                    openShiftId,
                    request.ClientSaleId,
                    sale.Total,
                    totalPaid,
                    debugItems,
                    payments.Select(payment => new { payment.Method, payment.Amount, payment.Reference }).ToArray());

                throw ValidationError("payments.amount", "Payments total must match sale total.");
            }

            _db.Sales.Add(sale);
            foreach (var payment in payments)
            {
                _db.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    SaleId = sale.Id,
                    Method = payment.Method,
                    Amount = payment.Amount,
                    CreatedAtUtc = _businessTime.UtcNow,
                    Reference = payment.Method == PaymentMethod.Cash
                        ? null
                        : payment.Reference?.Trim()
                });
            }

            IDbContextTransaction tx = await _db.Database.BeginTransactionAsync(ct).ConfigureAwait(false);
            try
            {
                await _auditLogger.LogAsync(new AuditEntry(
                    Action: "Create",
                    UserId: userId,
                    CorrelationId: correlationId,
                    EntityType: "Sale",
                    EntityId: sale.Id.ToString("D"),
                    Before: null,
                    After: new { sale.Id, sale.Folio, sale.OccurredAtUtc, sale.Total, sale.ShiftId, sale.StoreId, Items = request.Items.Count, Payments = payments.Count },
                    Source: "POS",
                    Notes: "Sale created",
                    OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);

                await _db.SaveChangesAsync(ct).ConfigureAwait(false);
                await tx.CommitAsync(ct).ConfigureAwait(false);
            }
            catch (DbUpdateException) when (request.ClientSaleId.HasValue)
            {
                await tx.RollbackAsync(ct).ConfigureAwait(false);
                LogAction("CreateConflict", "Sale", sale.Id, correlationId);
                throw new ConflictException("A sale with the same clientSaleId already exists.");
            }
            finally
            {
                await tx.DisposeAsync().ConfigureAwait(false);
            }

            LogAction("Create", "Sale", sale.Id, correlationId);
            return new CreateSaleResponseDto(sale.Id, sale.Folio, sale.OccurredAtUtc, sale.Total);
        }).ConfigureAwait(false);
    }

    public async Task<DailySummaryDto> GetDailySummaryAsync(DateOnly forDate, CancellationToken ct)
    {
        var rawSales = await _db.Sales.AsNoTracking()
            .Where(x => x.Status == SaleStatus.Completed)
            .Select(x => new { x.Id, x.Total, x.OccurredAtUtc })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var sales = rawSales
            .Where(x => _businessTime.ToBusinessDate(x.OccurredAtUtc) == forDate)
            .Select(x => (x.Id, x.Total))
            .ToList();

        var saleIds = sales.Select(x => x.Id).ToArray();
        var totalItems = saleIds.Length == 0
            ? 0
            : await _db.SaleItems.AsNoTracking()
                .Where(x => saleIds.Contains(x.SaleId))
                .SumAsync(x => x.Quantity, ct)
                .ConfigureAwait(false);

        var totalAmount = sales.Sum(x => x.Total);
        var totalTickets = sales.Count;
        var avgTicket = totalTickets == 0 ? 0m : decimal.Round(totalAmount / totalTickets, 2, MidpointRounding.AwayFromZero);

        LogAction("DailySummary", "SaleReport", null, GetCorrelationId());

        return new DailySummaryDto(forDate, totalTickets, totalAmount, totalItems, avgTicket);
    }

    public async Task<IReadOnlyList<TopProductDto>> GetTopProductsAsync(DateOnly dateFrom, DateOnly dateTo, int top, Guid? storeId, Guid? cashierUserId, Guid? shiftId, CancellationToken ct)
    {
        if (top <= 0)
        {
            throw ValidationError("top", "Top must be greater than zero.");
        }

        ValidateDateRange(dateFrom, dateTo);

        var (resolvedStoreId, timeZoneInfo) = await ResolveStoreTimeZoneAsync(storeId, ct).ConfigureAwait(false);
        var (utcStart, utcEndExclusive) = ToUtcRange(dateFrom, dateTo, timeZoneInfo);

        var filteredSaleIds = await _db.Sales.AsNoTracking()
            .Where(x => x.Status == SaleStatus.Completed &&
                        x.StoreId == resolvedStoreId &&
                        x.OccurredAtUtc >= utcStart &&
                        x.OccurredAtUtc < utcEndExclusive &&
                        (!cashierUserId.HasValue || x.CreatedByUserId == cashierUserId.Value) &&
                        (!shiftId.HasValue || x.ShiftId == shiftId.Value))
            .Select(x => x.Id)
            .ToArrayAsync(ct)
            .ConfigureAwait(false);

        if (filteredSaleIds.Length == 0)
        {
            return [];
        }

        var rows = (await _db.SaleItems.AsNoTracking()
                .Where(x => filteredSaleIds.Contains(x.SaleId))
                .Select(x => new { x.ProductId, x.ProductNameSnapshot, x.Quantity, x.LineTotal })
                .ToListAsync(ct)
                .ConfigureAwait(false))
            .GroupBy(x => new { x.ProductId, x.ProductNameSnapshot })
            .Select(grouped => new TopProductDto(
                grouped.Key.ProductId,
                grouped.Key.ProductNameSnapshot,
                grouped.Sum(x => x.Quantity),
                grouped.Sum(x => x.LineTotal)))
            .OrderByDescending(x => x.Qty)
            .ThenByDescending(x => x.Amount)
            .Take(top)
            .ToList();

        LogAction("TopProducts", "SaleReport", null, GetCorrelationId());

        return rows;
    }

    public async Task<IReadOnlyList<PosDailySalesReportRowDto>> GetDailySalesReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct)
    {
        var (sales, payments, timeZoneInfo) = await LoadSalesAndPaymentsAsync(dateFrom, dateTo, storeId, ct).ConfigureAwait(false);

        var paymentsBySaleId = payments.GroupBy(x => x.SaleId).ToDictionary(x => x.Key, x => x.ToList());

        var rows = sales
            .GroupBy(x => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(x.OccurredAtUtc, timeZoneInfo).DateTime))
            .Select(group =>
            {
                var completed = group.Where(x => x.Status == SaleStatus.Completed).ToList();
                var voided = group.Where(x => x.Status == SaleStatus.Void).ToList();
                var totalSales = completed.Sum(x => x.Total);
                var tickets = completed.Count;
                return new PosDailySalesReportRowDto(
                    group.Key,
                    tickets,
                    completed.Sum(x => x.Subtotal),
                    0m,
                    0m,
                    totalSales,
                    tickets == 0 ? 0m : decimal.Round(totalSales / tickets, 2, MidpointRounding.AwayFromZero),
                    voided.Count,
                    voided.Sum(x => x.Total),
                    BuildPaymentsBreakdown(completed.SelectMany(x => paymentsBySaleId.GetValueOrDefault(x.Id) ?? [])));
            })
            .OrderBy(x => x.BusinessDate)
            .ToList();

        return rows;
    }

    public async Task<PosPaymentsMethodsReportDto> GetPaymentsMethodsReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct)
    {
        var (sales, payments, _) = await LoadSalesAndPaymentsAsync(dateFrom, dateTo, storeId, ct).ConfigureAwait(false);
        var completedIds = sales.Where(x => x.Status == SaleStatus.Completed).Select(x => x.Id).ToHashSet();

        var totals = payments
            .Where(x => completedIds.Contains(x.SaleId))
            .GroupBy(x => x.Method)
            .Select(x => new PosPaymentMethodTotalDto(x.Key, x.Count(), x.Sum(v => v.Amount)))
            .OrderBy(x => x.Method)
            .ToList();

        return new PosPaymentsMethodsReportDto(dateFrom, dateTo, totals);
    }

    public async Task<IReadOnlyList<PosHourlySalesReportRowDto>> GetHourlySalesReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct)
    {
        var (sales, _, timeZoneInfo) = await LoadSalesAndPaymentsAsync(dateFrom, dateTo, storeId, ct).ConfigureAwait(false);

        return sales
            .Where(x => x.Status == SaleStatus.Completed)
            .GroupBy(x => TimeZoneInfo.ConvertTime(x.OccurredAtUtc, timeZoneInfo).Hour)
            .Select(x => new PosHourlySalesReportRowDto(x.Key, x.Count(), x.Sum(v => v.Total)))
            .OrderBy(x => x.Hour)
            .ToList();
    }

    public async Task<IReadOnlyList<PosCashierSalesReportRowDto>> GetCashiersSalesReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct)
    {
        var (sales, payments, _) = await LoadSalesAndPaymentsAsync(dateFrom, dateTo, storeId, ct).ConfigureAwait(false);
        var paymentsBySaleId = payments.GroupBy(x => x.SaleId).ToDictionary(x => x.Key, x => x.ToList());

        return sales
            .GroupBy(x => x.CreatedByUserId)
            .Select(group =>
            {
                var completed = group.Where(x => x.Status == SaleStatus.Completed).ToList();
                var voided = group.Where(x => x.Status == SaleStatus.Void).ToList();
                var totalSales = completed.Sum(x => x.Total);
                var tickets = completed.Count;
                return new PosCashierSalesReportRowDto(
                    group.Key,
                    tickets,
                    totalSales,
                    tickets == 0 ? 0m : decimal.Round(totalSales / tickets, 2, MidpointRounding.AwayFromZero),
                    voided.Count,
                    voided.Sum(x => x.Total),
                    BuildPaymentsBreakdown(completed.SelectMany(x => paymentsBySaleId.GetValueOrDefault(x.Id) ?? [])));
            })
            .OrderBy(x => x.CashierUserId)
            .ToList();
    }

    public async Task<IReadOnlyList<PosShiftSummaryReportRowDto>> GetShiftsSummaryReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, CancellationToken ct)
    {
        var (sales, payments, _) = await LoadSalesAndPaymentsAsync(dateFrom, dateTo, storeId, ct).ConfigureAwait(false);
        var saleGroupsByShift = sales.Where(x => x.ShiftId.HasValue).GroupBy(x => x.ShiftId!.Value).ToDictionary(x => x.Key, x => x.ToList());
        var saleIds = sales.Select(x => x.Id).ToHashSet();
        var paymentsBySaleId = payments.Where(x => saleIds.Contains(x.SaleId)).GroupBy(x => x.SaleId).ToDictionary(x => x.Key, x => x.ToList());

        var (resolvedStoreId, _) = await ResolveStoreTimeZoneAsync(storeId, ct).ConfigureAwait(false);
        var shiftIds = saleGroupsByShift.Keys.ToArray();
        var shifts = await _db.PosShifts.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId &&
                        (!cashierUserId.HasValue || x.OpenedByUserId == cashierUserId.Value) &&
                        shiftIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                CashierUserId = x.OpenedByUserId,
                x.OpenedAtUtc,
                x.ClosedAtUtc,
                x.CloseReason,
                x.ExpectedCashAmount,
                x.ClosingCashAmount,
                x.CashDifference
            })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return shifts.Select(shift =>
            {
                var shiftSales = saleGroupsByShift.GetValueOrDefault(shift.Id) ?? [];
                var completed = shiftSales.Where(x => x.Status == SaleStatus.Completed).ToList();
                return new PosShiftSummaryReportRowDto(
                    shift.Id,
                    shift.CashierUserId,
                    shift.OpenedAtUtc,
                    shift.ClosedAtUtc,
                    shift.CloseReason,
                    completed.Count,
                    completed.Sum(x => x.Total),
                    BuildPaymentsBreakdown(completed.SelectMany(x => paymentsBySaleId.GetValueOrDefault(x.Id) ?? [])),
                    shift.ExpectedCashAmount ?? 0m,
                    shift.ClosingCashAmount ?? 0m,
                    shift.CashDifference ?? 0m);
            })
            .OrderBy(x => x.OpenedAtUtc)
            .ToList();
    }

    public async Task<IReadOnlyList<PosVoidReasonReportRowDto>> GetVoidReasonsReportAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct)
    {
        var (sales, _, _) = await LoadSalesAndPaymentsAsync(dateFrom, dateTo, storeId, ct).ConfigureAwait(false);
        return sales
            .Where(x => x.Status == SaleStatus.Void || x.VoidedAtUtc.HasValue)
            .GroupBy(x => new { x.VoidReasonCode, x.VoidReasonText })
            .Select(x => new PosVoidReasonReportRowDto(x.Key.VoidReasonCode, x.Key.VoidReasonText, x.Count(), x.Sum(v => v.Total)))
            .OrderByDescending(x => x.Amount)
            .ToList();
    }

    public async Task<PosCategorySalesMixResponseDto> GetSalesByCategoriesAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, CancellationToken ct)
    {
        var rows = await LoadCompletedSaleItemGrossLinesAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct).ConfigureAwait(false);

        var items = rows
            .GroupBy(x => new { x.CategoryId, x.CategoryName })
            .Select(x => new PosCategorySalesMixItemDto(
                x.Key.CategoryId,
                x.Key.CategoryName,
                x.Select(v => v.SaleId).Distinct().Count(),
                x.Sum(v => v.Quantity),
                x.Sum(v => v.GrossLine)))
            .OrderByDescending(x => x.GrossSales)
            .ThenBy(x => x.CategoryName)
            .ToList();

        return new PosCategorySalesMixResponseDto(items);
    }

    public async Task<PosProductSalesMixResponseDto> GetSalesByProductsAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, int top, CancellationToken ct)
    {
        top = NormalizeTop(top, 20, 200, "top");
        var rows = await LoadCompletedSaleItemGrossLinesAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct).ConfigureAwait(false);

        var items = rows
            .GroupBy(x => new { x.ProductId, x.ProductSku, x.ProductName })
            .Select(x => new PosProductSalesMixItemDto(
                x.Key.ProductId,
                x.Key.ProductSku,
                x.Key.ProductName,
                x.Select(v => v.SaleId).Distinct().Count(),
                x.Sum(v => v.Quantity),
                x.Sum(v => v.GrossLine)))
            .OrderByDescending(x => x.GrossSales)
            .ThenByDescending(x => x.Quantity)
            .ThenBy(x => x.ProductName)
            .Take(top)
            .ToList();

        return new PosProductSalesMixResponseDto(items);
    }

    public async Task<PosTopExtraAddonsResponseDto> GetSalesAddonsExtrasAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, int top, CancellationToken ct)
    {
        top = NormalizeTop(top, 20, 200, "top");

        var completedSaleIds = await LoadCompletedSaleIdsAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct).ConfigureAwait(false);
        if (completedSaleIds.Count == 0)
        {
            return new PosTopExtraAddonsResponseDto([]);
        }

        var items = await (from extra in _db.SaleItemExtras.AsNoTracking()
                           join saleItem in _db.SaleItems.AsNoTracking() on extra.SaleItemId equals saleItem.Id
                           join catalogExtra in _db.Extras.AsNoTracking() on extra.ExtraId equals catalogExtra.Id into catalogExtras
                           from catalogExtra in catalogExtras.DefaultIfEmpty()
                           where completedSaleIds.Contains(saleItem.SaleId)
                           group new { extra, catalogExtra } by new { extra.ExtraId, extra.ExtraNameSnapshot, Sku = catalogExtra != null ? catalogExtra.Id.ToString() : null } into grouped
                           orderby grouped.Sum(x => x.extra.LineTotal) descending, grouped.Sum(x => x.extra.Quantity) descending
                           select new PosTopExtraAddonItemDto(
                               grouped.Key.ExtraId,
                               grouped.Key.Sku,
                               grouped.Key.ExtraNameSnapshot,
                               grouped.Sum(x => x.extra.Quantity),
                               grouped.Sum(x => x.extra.LineTotal)))
            .Take(top)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return new PosTopExtraAddonsResponseDto(items);
    }

    public async Task<PosTopOptionAddonsResponseDto> GetSalesAddonsOptionsAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, int top, CancellationToken ct)
    {
        top = NormalizeTop(top, 20, 200, "top");

        var completedSaleIds = await LoadCompletedSaleIdsAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct).ConfigureAwait(false);
        if (completedSaleIds.Count == 0)
        {
            return new PosTopOptionAddonsResponseDto([]);
        }

        var items = await (from selection in _db.SaleItemSelections.AsNoTracking()
                           join saleItem in _db.SaleItems.AsNoTracking() on selection.SaleItemId equals saleItem.Id
                           join option in _db.OptionItems.AsNoTracking() on selection.OptionItemId equals option.Id into options
                           from option in options.DefaultIfEmpty()
                           where completedSaleIds.Contains(saleItem.SaleId)
                           group new { selection, saleItem, option } by new
                           {
                               selection.OptionItemId,
                               selection.OptionItemNameSnapshot,
                               OptionItemSku = option != null ? option.Id.ToString() : null
                           }
            into grouped
                           orderby grouped.Sum(x => x.saleItem.Quantity) descending, grouped.Sum(x => x.selection.PriceDeltaSnapshot * x.saleItem.Quantity) descending
                           select new PosTopOptionAddonItemDto(
                               grouped.Key.OptionItemId,
                               grouped.Key.OptionItemSku,
                               grouped.Key.OptionItemNameSnapshot,
                               grouped.Sum(x => x.saleItem.Quantity),
                               grouped.Sum(x => x.selection.PriceDeltaSnapshot * x.saleItem.Quantity)))
            .Take(top)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return new PosTopOptionAddonsResponseDto(items);
    }

    public async Task<PosKpisSummaryDto> GetKpisSummaryAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, CancellationToken ct)
    {
        var filteredSales = await LoadFilteredSalesAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct).ConfigureAwait(false);
        var completedSales = filteredSales.Where(x => x.Status == SaleStatus.Completed).ToList();
        var completedSaleIds = completedSales.Select(x => x.Id).ToArray();

        var totalItems = completedSaleIds.Length == 0
            ? 0
            : await _db.SaleItems.AsNoTracking()
                .Where(x => completedSaleIds.Contains(x.SaleId))
                .SumAsync(x => x.Quantity, ct)
                .ConfigureAwait(false);

        var tickets = completedSales.Count;
        var grossSales = completedSales.Sum(x => x.Total);
        var avgTicket = tickets == 0 ? 0m : decimal.Round(grossSales / tickets, 2, MidpointRounding.AwayFromZero);
        var avgItemsPerTicket = tickets == 0 ? 0m : decimal.Round((decimal)totalItems / tickets, 2, MidpointRounding.AwayFromZero);
        var voidCount = filteredSales.Count(x => x.Status == SaleStatus.Void);
        var totalSalesCount = filteredSales.Count;
        var voidRate = totalSalesCount == 0 ? 0m : decimal.Round((decimal)voidCount / totalSalesCount, 4, MidpointRounding.AwayFromZero);

        return new PosKpisSummaryDto(tickets, totalItems, grossSales, avgTicket, avgItemsPerTicket, voidCount, voidRate);
    }

    public async Task<PosCashDifferencesResponseDto> GetCashDifferencesControlAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, CancellationToken ct)
    {
        ValidateDateRange(dateFrom, dateTo);

        var (resolvedStoreId, timeZoneInfo) = await ResolveStoreTimeZoneAsync(storeId, ct).ConfigureAwait(false);
        var (utcStart, utcEndExclusive) = ToUtcRange(dateFrom, dateTo, timeZoneInfo);

        var shiftsData = await _db.PosShifts.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId
                        && (!cashierUserId.HasValue || x.OpenedByUserId == cashierUserId.Value)
                        && x.OpenedAtUtc < utcEndExclusive
                        && (x.ClosedAtUtc == null || x.ClosedAtUtc >= utcStart))
            .Select(x => new
            {
                x.Id,
                x.OpenedAtUtc,
                x.ClosedAtUtc,
                x.OpenedByUserId,
                ExpectedCash = x.ExpectedCashAmount ?? 0m,
                ClosingCash = x.ClosingCashAmount ?? 0m,
                x.CashDifference,
                x.CloseReason
            })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var shifts = shiftsData
            .Select(x => new PosCashDifferencesShiftRowDto(
                x.Id,
                x.OpenedAtUtc,
                x.ClosedAtUtc,
                x.OpenedByUserId,
                x.ExpectedCash,
                x.ClosingCash,
                x.CashDifference ?? (x.ClosingCash - x.ExpectedCash),
                x.CloseReason))
            .OrderBy(x => x.OpenedAt)
            .ToList();

        var daily = shifts
            .Select(x => new
            {
                LocalDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(x.ClosedAt ?? x.OpenedAt, timeZoneInfo).DateTime),
                x.CashierUserId,
                x.ExpectedCash,
                x.CountedCash,
                x.Difference,
                x.CloseReason
            })
            .GroupBy(x => new { x.LocalDate, x.CashierUserId })
            .Select(x => new PosCashDifferencesDailyRowDto(
                x.Key.LocalDate,
                x.Key.CashierUserId,
                x.Count(),
                x.Sum(v => v.ExpectedCash),
                x.Sum(v => v.CountedCash),
                x.Sum(v => v.Difference),
                x.Count(v => !string.IsNullOrWhiteSpace(v.CloseReason))))
            .OrderBy(x => x.Date)
            .ThenBy(x => x.CashierUserId)
            .ToList();

        return new PosCashDifferencesResponseDto(daily, shifts);
    }

    public async Task<VoidSaleResponseDto> VoidSaleAsync(Guid saleId, VoidSaleRequestDto request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ReasonCode))
        {
            throw ValidationError("reasonCode", "reasonCode is required.");
        }

        var sale = await _db.Sales.FirstOrDefaultAsync(x => x.Id == saleId, ct).ConfigureAwait(false)
            ?? throw new NotFoundException("Sale not found.");

        if (sale.Status == SaleStatus.Void)
        {
            if (request.ClientVoidId.HasValue && sale.ClientVoidId == request.ClientVoidId)
            {
                return new VoidSaleResponseDto(sale.Id, sale.Status, sale.VoidedAtUtc ?? _businessTime.UtcNow);
            }

            throw new ConflictException("Sale has already been voided.");
        }

        if (request.ClientVoidId.HasValue)
        {
            var existing = await _db.Sales.AsNoTracking().FirstOrDefaultAsync(x => x.ClientVoidId == request.ClientVoidId, ct).ConfigureAwait(false);
            if (existing is not null)
            {
                return new VoidSaleResponseDto(existing.Id, existing.Status, existing.VoidedAtUtc ?? _businessTime.UtcNow);
            }
        }

        if (!Enum.TryParse<VoidReasonCode>(request.ReasonCode, true, out _))
        {
            throw ValidationError("reasonCode", "Unknown void reason code.");
        }

        var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
        var user = _httpContextAccessor.HttpContext?.User;
        var isManager = user?.IsInRole("Manager") == true || user?.IsInRole("Admin") == true;
        if (!isManager)
        {
            var isOwnShift = sale.ShiftId.HasValue && await _db.PosShifts.AsNoTracking().AnyAsync(
                x => x.Id == sale.ShiftId.Value && x.OpenedByUserId == userId,
                ct).ConfigureAwait(false);

            if (!isOwnShift || _businessTime.ToBusinessDate(sale.OccurredAtUtc) != _businessTime.BusinessDate)
            {
                throw new ForbiddenException("Cashier can only void own-shift sales from current business day.");
            }
        }

        sale.Status = SaleStatus.Void;
        sale.VoidedAtUtc = _businessTime.UtcNow;
        sale.VoidedByUserId = userId;
        sale.VoidReasonCode = request.ReasonCode.Trim();
        sale.VoidReasonText = request.ReasonText?.Trim();
        sale.VoidNote = request.Note?.Trim();
        sale.ClientVoidId = request.ClientVoidId;

        if (sale.LoyaltyPointsAwarded.HasValue && sale.LoyaltyPointsAwarded.Value > 0)
        {
            await _pointsReversalService.ReversePointsForSaleAsync(sale.Id, sale.LoyaltyPointsAwarded.Value, userId, _businessTime.UtcNow, ct).ConfigureAwait(false);
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        var voidedAtUtc = sale.VoidedAtUtc!.Value;

        await _auditLogger.LogAsync(new AuditEntry(
            Action: "SaleVoid",
            UserId: userId,
            CorrelationId: GetCorrelationId(),
            EntityType: "Sale",
            EntityId: sale.Id.ToString("D"),
            Before: new { Status = SaleStatus.Completed },
            After: new { sale.Status, sale.VoidedAtUtc, sale.VoidReasonCode, sale.VoidReasonText },
            Source: "POS",
            Notes: "Sale voided",
            OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);

        return new VoidSaleResponseDto(sale.Id, sale.Status, voidedAtUtc);
    }


    private async Task<(List<SaleReportRow> Sales, List<PaymentReportRow> Payments, TimeZoneInfo TimeZoneInfo)> LoadSalesAndPaymentsAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, CancellationToken ct)
    {
        ValidateDateRange(dateFrom, dateTo);

        var (resolvedStoreId, timeZoneInfo) = await ResolveStoreTimeZoneAsync(storeId, ct).ConfigureAwait(false);
        var (utcStart, utcEndExclusive) = ToUtcRange(dateFrom, dateTo, timeZoneInfo);

        var sales = await _db.Sales.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId && x.OccurredAtUtc >= utcStart && x.OccurredAtUtc < utcEndExclusive)
            .Select(x => new SaleReportRow(
                x.Id,
                x.StoreId,
                x.ShiftId,
                x.CreatedByUserId,
                x.OccurredAtUtc,
                x.Subtotal,
                x.Total,
                x.Status,
                x.VoidedAtUtc,
                x.VoidReasonCode,
                x.VoidReasonText))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var saleIds = sales.Select(x => x.Id).ToArray();
        var payments = saleIds.Length == 0
            ? []
            : await _db.Payments.AsNoTracking()
                .Where(x => saleIds.Contains(x.SaleId))
                .Select(x => new PaymentReportRow(x.SaleId, x.Method, x.Amount))
                .ToListAsync(ct)
                .ConfigureAwait(false);

        return (sales, payments, timeZoneInfo);
    }

    private async Task<List<SaleReportRow>> LoadFilteredSalesAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, CancellationToken ct)
    {
        ValidateDateRange(dateFrom, dateTo);

        var (resolvedStoreId, timeZoneInfo) = await ResolveStoreTimeZoneAsync(storeId, ct).ConfigureAwait(false);
        var (utcStart, utcEndExclusive) = ToUtcRange(dateFrom, dateTo, timeZoneInfo);

        return await _db.Sales.AsNoTracking()
            .Where(x => x.StoreId == resolvedStoreId
                        && x.OccurredAtUtc >= utcStart
                        && x.OccurredAtUtc < utcEndExclusive
                        && (!cashierUserId.HasValue || x.CreatedByUserId == cashierUserId.Value)
                        && (!shiftId.HasValue || x.ShiftId == shiftId.Value))
            .Select(x => new SaleReportRow(
                x.Id,
                x.StoreId,
                x.ShiftId,
                x.CreatedByUserId,
                x.OccurredAtUtc,
                x.Subtotal,
                x.Total,
                x.Status,
                x.VoidedAtUtc,
                x.VoidReasonCode,
                x.VoidReasonText))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    private async Task<HashSet<Guid>> LoadCompletedSaleIdsAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, CancellationToken ct)
    {
        var filteredSales = await LoadFilteredSalesAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct).ConfigureAwait(false);
        return filteredSales
            .Where(x => x.Status == SaleStatus.Completed)
            .Select(x => x.Id)
            .ToHashSet();
    }

    private async Task<List<SaleItemGrossLineRow>> LoadCompletedSaleItemGrossLinesAsync(DateOnly dateFrom, DateOnly dateTo, Guid? storeId, Guid? cashierUserId, Guid? shiftId, CancellationToken ct)
    {
        var completedSaleIds = await LoadCompletedSaleIdsAsync(dateFrom, dateTo, storeId, cashierUserId, shiftId, ct).ConfigureAwait(false);
        if (completedSaleIds.Count == 0)
        {
            return [];
        }

        var saleItems = await _db.SaleItems.AsNoTracking()
            .Where(x => completedSaleIds.Contains(x.SaleId))
            .Select(x => new { x.Id, x.SaleId, x.ProductId, x.ProductExternalCode, x.ProductNameSnapshot, x.Quantity, x.LineTotal })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var saleItemIds = saleItems.Select(x => x.Id).ToArray();
        var extrasBySaleItemId = saleItemIds.Length == 0
            ? new Dictionary<Guid, decimal>()
            : await _db.SaleItemExtras.AsNoTracking()
                .Where(x => saleItemIds.Contains(x.SaleItemId))
                .GroupBy(x => x.SaleItemId)
                .ToDictionaryAsync(x => x.Key, x => x.Sum(v => v.LineTotal), ct)
                .ConfigureAwait(false);

        var selectionsBySaleItemId = saleItemIds.Length == 0
            ? new Dictionary<Guid, decimal>()
            : await _db.SaleItemSelections.AsNoTracking()
                .Where(x => saleItemIds.Contains(x.SaleItemId))
                .GroupBy(x => x.SaleItemId)
                .ToDictionaryAsync(x => x.Key, x => x.Sum(v => v.PriceDeltaSnapshot), ct)
                .ConfigureAwait(false);

        var categoryByProductId = await (from product in _db.Products.AsNoTracking()
                                         join category in _db.Categories.AsNoTracking() on product.CategoryId equals category.Id into categories
                                         from category in categories.DefaultIfEmpty()
                                         where saleItems.Select(x => x.ProductId).Contains(product.Id)
                                         select new
                                         {
                                             product.Id,
                                             CategoryId = category != null ? category.Id : Guid.Empty,
                                             CategoryName = category != null ? category.Name : "Sin categoría"
                                         })
            .ToDictionaryAsync(x => x.Id, ct)
            .ConfigureAwait(false);

        return saleItems.Select(x =>
            {
                var extras = extrasBySaleItemId.GetValueOrDefault(x.Id);
                var selectionsDelta = selectionsBySaleItemId.GetValueOrDefault(x.Id) * x.Quantity;
                var category = categoryByProductId.GetValueOrDefault(x.ProductId);

                return new SaleItemGrossLineRow(
                    x.SaleId,
                    x.ProductId,
                    x.ProductExternalCode,
                    x.ProductNameSnapshot,
                    category?.CategoryId ?? Guid.Empty,
                    category?.CategoryName ?? "Sin categoría",
                    x.Quantity,
                    x.LineTotal + extras + selectionsDelta);
            })
            .ToList();
    }

    private static int NormalizeTop(int? top, int defaultValue, int maxValue, string field)
    {
        var value = top.GetValueOrDefault(defaultValue);
        if (value <= 0 || value > maxValue)
        {
            throw ValidationError(field, $"{field} must be between 1 and {maxValue}.");
        }

        return value;
    }

    private async Task<(Guid StoreId, TimeZoneInfo TimeZoneInfo)> ResolveStoreTimeZoneAsync(Guid? storeId, CancellationToken ct)
    {
        var (resolvedStoreId, _) = await _storeContext.ResolveStoreAsync(storeId, ct).ConfigureAwait(false);

        var timeZoneId = await _db.Stores.AsNoTracking()
            .Where(x => x.Id == resolvedStoreId)
            .Select(x => x.TimeZoneId)
            .FirstAsync(ct)
            .ConfigureAwait(false);

        try
        {
            return (resolvedStoreId, TZConvert.GetTimeZoneInfo(timeZoneId));
        }
        catch (TimeZoneNotFoundException)
        {
            return (resolvedStoreId, TimeZoneInfo.Utc);
        }
    }

    private static (DateTimeOffset UtcStart, DateTimeOffset UtcEndExclusive) ToUtcRange(DateOnly dateFrom, DateOnly dateTo, TimeZoneInfo timeZoneInfo)
    {
        var localStart = dateFrom.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        var localEndExclusive = dateTo.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);

        return (
            new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localStart, timeZoneInfo)),
            new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localEndExclusive, timeZoneInfo)));
    }

    private static PosPaymentsBreakdownDto BuildPaymentsBreakdown(IEnumerable<PaymentReportRow> payments)
    {
        var rows = payments.ToList();
        return new PosPaymentsBreakdownDto(
            rows.Where(x => x.Method == PaymentMethod.Cash).Sum(x => x.Amount),
            rows.Where(x => x.Method == PaymentMethod.Card).Sum(x => x.Amount),
            rows.Where(x => x.Method == PaymentMethod.Transfer).Sum(x => x.Amount));
    }

    private static void ValidateDateRange(DateOnly dateFrom, DateOnly dateTo)
    {
        if (dateTo < dateFrom)
        {
            throw ValidationError("dateTo", "dateTo must be greater than or equal to dateFrom.");
        }
    }

    private sealed record SaleReportRow(
        Guid Id,
        Guid StoreId,
        Guid? ShiftId,
        Guid CreatedByUserId,
        DateTimeOffset OccurredAtUtc,
        decimal Subtotal,
        decimal Total,
        SaleStatus Status,
        DateTimeOffset? VoidedAtUtc,
        string? VoidReasonCode,
        string? VoidReasonText);

    private sealed record PaymentReportRow(Guid SaleId, PaymentMethod Method, decimal Amount);
    private sealed record SaleItemGrossLineRow(
        Guid SaleId,
        Guid ProductId,
        string? ProductSku,
        string ProductName,
        Guid CategoryId,
        string CategoryName,
        int Quantity,
        decimal GrossLine);

    private static string GenerateFolio(DateTimeOffset timestamp)
    {
        return $"POS-{timestamp:yyyyMMddHHmmssfff}";
    }

    private static void ValidateRequest(CreateSaleRequestDto request, IReadOnlyCollection<CreatePaymentRequestDto> payments)
    {
        if (request.Items.Count == 0)
        {
            throw ValidationError("items", "At least one sale item is required.");
        }

        if (payments.Count == 0)
        {
            throw ValidationError("payments", "At least one payment is required.");
        }

        if (payments.Any(x => x.Amount <= 0))
        {
            throw ValidationError("payments.amount", "Payment amount must be greater than zero.");
        }

        if (payments.Any(x => x.Method is PaymentMethod.Card or PaymentMethod.Transfer && string.IsNullOrWhiteSpace(x.Reference)))
        {
            throw ValidationError("payments.reference", "Payment reference is required for Card and Transfer methods.");
        }

        if (request.Items.Any(x => x.Quantity <= 0))
        {
            throw ValidationError("items.quantity", "Item quantity must be greater than zero.");
        }

        if (request.Items.SelectMany(x => x.Extras ?? []).Any(x => x.Quantity <= 0))
        {
            throw ValidationError("items.extras.quantity", "Extra quantity must be greater than zero.");
        }
    }

    private static IReadOnlyList<CreatePaymentRequestDto> ResolvePayments(CreateSaleRequestDto request)
    {
        if (request.Payments is { Count: > 0 })
        {
            return request.Payments;
        }

        if (request.Payment is not null)
        {
            return [request.Payment];
        }

        return [];
    }

    private static decimal RoundMoney(decimal amount) => decimal.Round(amount, 2, MidpointRounding.AwayFromZero);

    private static ValidationException ValidationError(string key, string message)
    {
        return new ValidationException(new Dictionary<string, string[]>
        {
            [key] = [message]
        });
    }

    private string GetCorrelationId()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context?.Items.TryGetValue("CorrelationId", out var value) == true && value is string correlationId && !string.IsNullOrWhiteSpace(correlationId))
        {
            return correlationId;
        }

        if (context?.Request.Headers.TryGetValue("X-Correlation-Id", out var headerValue) == true && !string.IsNullOrWhiteSpace(headerValue))
        {
            return headerValue.ToString();
        }

        return Activity.Current?.TraceId.ToString() ?? context?.TraceIdentifier ?? Guid.NewGuid().ToString("D");
    }

    private Guid? GetCurrentUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        var raw = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? user?.FindFirst("sub")?.Value;

        return Guid.TryParse(raw, out var userId) ? userId : null;
    }

    private void LogAction(string action, string entity, Guid? entityId, string? correlationId)
    {
        PosSalesLog.Action(
            _logger,
            action,
            entity,
            entityId?.ToString("D") ?? "-",
            correlationId ?? Activity.Current?.TraceId.ToString() ?? "-");
    }

}

internal static class PosSalesLog
{
    private static readonly Action<ILogger, string, string, string, string, Exception?> LogActionMessage =
        LoggerMessage.Define<string, string, string, string>(
            LogLevel.Information,
            new EventId(1, nameof(Action)),
            "pos_action={Action} entity={Entity} entityId={EntityId} correlationId={CorrelationId}");

    public static void Action(ILogger logger, string action, string entity, string entityId, string correlationId)
    {
        LogActionMessage(logger, action, entity, entityId, correlationId, null);
    }

    private static readonly Action<ILogger, Guid, Guid, Guid?, Guid?, decimal, decimal, Exception?> LogPaymentMismatchMessage =
        LoggerMessage.Define<Guid, Guid, Guid?, Guid?, decimal, decimal>(
            LogLevel.Warning,
            new EventId(2, nameof(PaymentMismatch)),
            "payment_mismatch SaleId={SaleId}, StoreId={StoreId}, ShiftId={ShiftId}, ClientSaleId={ClientSaleId}, SaleTotal={SaleTotal}, TotalPaid={TotalPaid}");

    private static readonly Action<ILogger, object, object, Exception?> LogPaymentMismatchDetailsMessage =
        LoggerMessage.Define<object, object>(
            LogLevel.Warning,
            new EventId(3, "PaymentMismatchDetails"),
            "Payment mismatch details - Items: {Items}, Payments: {Payments}");

    public static void PaymentMismatch(ILogger logger, Guid saleId, Guid storeId, Guid? shiftId, Guid? clientSaleId, decimal saleTotal, decimal totalPaid, object items, object payments)
    {
        LogPaymentMismatchMessage(
            logger,
            saleId,
            storeId,
            shiftId,
            clientSaleId,
            saleTotal,
            totalPaid,
            null);
        
        LogPaymentMismatchDetailsMessage(logger, items, payments, null);
    }
}
