using System.Diagnostics;
using System.Security.Claims;

using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces.PosSales;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Options;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using ValidationException = CobranzaDigital.Application.Common.Exceptions.ValidationException;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PosSalesService : IPosSalesService
{
    private readonly CobranzaDigitalDbContext _db;
    private readonly IAuditLogger _auditLogger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<PosSalesService> _logger;
    private readonly PosOptions _posOptions;

    public PosSalesService(
        CobranzaDigitalDbContext db,
        IAuditLogger auditLogger,
        IHttpContextAccessor httpContextAccessor,
        ILogger<PosSalesService> logger,
        IOptions<PosOptions> posOptions)
    {
        _db = db;
        _auditLogger = auditLogger;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
        _posOptions = posOptions.Value;
    }

    public async Task<CreateSaleResponseDto> CreateSaleAsync(CreateSaleRequestDto request, CancellationToken ct)
    {
        ValidateRequest(request);

        // SQL Server retry strategies require user transactions to be created inside ExecuteAsync.
        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
            var correlationId = GetCorrelationId();

            Guid? openShiftId = null;
            if (_posOptions.RequireOpenShiftForSales)
            {
                openShiftId = await _db.PosShifts.AsNoTracking()
                    .Where(x => x.ClosedAtUtc == null)
                    .Select(x => (Guid?)x.Id)
                    .FirstOrDefaultAsync(ct)
                    .ConfigureAwait(false);

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

            if (request.Payment.Amount != sale.Total)
            {
                throw ValidationError("payment.amount", "Payment amount must match sale total.");
            }

            _db.Sales.Add(sale);
            _db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                SaleId = sale.Id,
                Method = request.Payment.Method,
                Amount = request.Payment.Amount,
                Reference = request.Payment.Method == PaymentMethod.Cash
                    ? null
                    : request.Payment.Reference?.Trim()
            });

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
                    After: new { sale.Id, sale.Folio, sale.OccurredAtUtc, sale.Total, sale.ShiftId, Items = request.Items.Count },
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
        // Keep report boundaries as DateTimeOffset because Sale.OccurredAtUtc is DateTimeOffset.
        var fromDate = new DateTimeOffset(forDate.Year, forDate.Month, forDate.Day, 0, 0, 0, TimeSpan.Zero);
        var toExclusive = fromDate.AddDays(1);
        var isSqlite = _db.Database.IsSqlite();

        List<(Guid Id, decimal Total)> sales;

        if (isSqlite)
        {
            var rawSales = await _db.Sales.AsNoTracking()
                .Select(x => new { x.Id, x.Total, x.Status, x.OccurredAtUtc })
                .ToListAsync(ct)
                .ConfigureAwait(false);

            sales = rawSales
                .Where(x => x.OccurredAtUtc >= fromDate && x.OccurredAtUtc < toExclusive)
                .Where(x => x.Status == SaleStatus.Completed)
                .Select(x => (x.Id, x.Total))
                .ToList();
        }
        else
        {
            sales = (await _db.Sales.AsNoTracking()
                .Where(x => x.OccurredAtUtc >= fromDate && x.OccurredAtUtc < toExclusive)
                .Where(x => x.Status == SaleStatus.Completed)
                .Select(x => new { x.Id, x.Total })
                .ToListAsync(ct)
                .ConfigureAwait(false))
                .Select(x => (x.Id, x.Total))
                .ToList();
        }

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

        var correlationId = GetCorrelationId();
        LogAction("DailySummary", "SaleReport", null, correlationId);

        return new DailySummaryDto(forDate, totalTickets, totalAmount, totalItems, avgTicket);
    }

    public async Task<IReadOnlyList<TopProductDto>> GetTopProductsAsync(DateOnly dateFrom, DateOnly dateTo, int top, CancellationToken ct)
    {
        if (top <= 0)
        {
            throw ValidationError("top", "Top must be greater than zero.");
        }

        if (dateTo < dateFrom)
        {
            throw ValidationError("dateTo", "dateTo must be greater than or equal to dateFrom.");
        }

        var fromDate = new DateTimeOffset(dateFrom.Year, dateFrom.Month, dateFrom.Day, 0, 0, 0, TimeSpan.Zero);
        var toExclusiveDate = dateTo.AddDays(1);
        var toExclusive = new DateTimeOffset(toExclusiveDate.Year, toExclusiveDate.Month, toExclusiveDate.Day, 0, 0, 0, TimeSpan.Zero);
        var isSqlite = _db.Database.IsSqlite();
        List<TopProductDto> rows;

        if (isSqlite)
        {
            var sales = await _db.Sales.AsNoTracking()
                .Select(x => new { x.Id, x.Status, x.OccurredAtUtc })
                .ToListAsync(ct)
                .ConfigureAwait(false);

            var saleIds = sales
                .Where(x => x.OccurredAtUtc >= fromDate && x.OccurredAtUtc < toExclusive)
                .Where(x => x.Status == SaleStatus.Completed)
                .Select(x => x.Id)
                .ToHashSet();

            if (saleIds.Count == 0)
            {
                rows = [];
            }
            else
            {
                var items = await _db.SaleItems.AsNoTracking()
                    .Where(x => saleIds.Contains(x.SaleId))
                    .Select(x => new { x.ProductId, x.ProductNameSnapshot, x.Quantity, x.LineTotal })
                    .ToListAsync(ct)
                    .ConfigureAwait(false);

                rows = items
                    .GroupBy(x => new { x.ProductId, x.ProductNameSnapshot })
                    .Select(grouped => new TopProductDto(
                        grouped.Key.ProductId,
                        grouped.Key.ProductNameSnapshot,
                        grouped.Sum(x => x.Quantity),
                        grouped.Sum(x => x.LineTotal)))
                    .ToList();
            }
        }
        else
        {
            var baseQuery =
                from sale in _db.Sales.AsNoTracking()
                join item in _db.SaleItems.AsNoTracking() on sale.Id equals item.SaleId
                where sale.OccurredAtUtc >= fromDate && sale.OccurredAtUtc < toExclusive
                where sale.Status == SaleStatus.Completed
                select new
                {
                    item.ProductId,
                    item.ProductNameSnapshot,
                    item.Quantity,
                    item.LineTotal
                };

            rows = await baseQuery
                .GroupBy(x => new { x.ProductId, x.ProductNameSnapshot })
                .Select(grouped => new TopProductDto(
                    grouped.Key.ProductId,
                    grouped.Key.ProductNameSnapshot,
                    grouped.Sum(x => x.Quantity),
                    grouped.Sum(x => x.LineTotal)))
                .ToListAsync(ct)
                .ConfigureAwait(false);
        }

        rows = rows
            .OrderByDescending(x => x.Qty)
            .ThenByDescending(x => x.Amount)
            .Take(top)
            .ToList();

        var correlationId = GetCorrelationId();
        LogAction("TopProducts", "SaleReport", null, correlationId);

        return rows;
    }

    private static string GenerateFolio(DateTimeOffset timestamp)
    {
        return $"POS-{timestamp:yyyyMMddHHmmssfff}";
    }

    private static void ValidateRequest(CreateSaleRequestDto request)
    {
        if (request.Items.Count == 0)
        {
            throw ValidationError("items", "At least one sale item is required.");
        }

        if (request.Payment.Amount <= 0)
        {
            throw ValidationError("payment.amount", "Payment amount must be greater than zero.");
        }

        if (request.Payment.Method is PaymentMethod.Card or PaymentMethod.Transfer
            && string.IsNullOrWhiteSpace(request.Payment.Reference))
        {
            throw ValidationError("payment.reference", "Payment reference is required for Card and Transfer methods.");
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
}
