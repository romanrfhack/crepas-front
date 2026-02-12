using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces.PosSales;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

using ValidationException = CobranzaDigital.Application.Common.Exceptions.ValidationException;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PosShiftService : IPosShiftService
{
    private readonly CobranzaDigitalDbContext _db;
    private readonly IAuditLogger _auditLogger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PosShiftService(CobranzaDigitalDbContext db, IAuditLogger auditLogger, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _auditLogger = auditLogger;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<PosShiftDto?> GetCurrentShiftAsync(CancellationToken ct)
    {
        var shift = await GetLatestOpenShiftAsync(ct).ConfigureAwait(false);
        return shift is null ? null : Map(shift);
    }

    public async Task<PosShiftDto> OpenShiftAsync(OpenPosShiftRequestDto request, CancellationToken ct)
    {
        var openingCashAmount = request.ResolveOpeningCashAmount();
        if (openingCashAmount < 0)
        {
            throw ValidationError("openingCashAmount", "openingCashAmount cannot be negative.");
        }

        if (request.ClientOperationId.HasValue)
        {
            var existingByOperation = await _db.PosShifts.AsNoTracking()
                .Where(x => x.OpenOperationId == request.ClientOperationId)
                .FirstOrDefaultAsync(ct)
                .ConfigureAwait(false);

            if (existingByOperation is not null)
            {
                return Map(existingByOperation);
            }
        }

        var existingOpen = await GetLatestOpenShiftAsync(ct).ConfigureAwait(false);
        if (existingOpen is not null)
        {
            return Map(existingOpen);
        }

        var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
        var shift = new PosShift
        {
            Id = Guid.NewGuid(),
            OpenedAtUtc = DateTimeOffset.UtcNow,
            OpenedByUserId = userId,
            OpenedByEmail = GetCurrentUserEmail(),
            OpeningCashAmount = openingCashAmount,
            OpenNotes = request.Notes,
            OpenOperationId = request.ClientOperationId
        };

        _db.PosShifts.Add(shift);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        await _auditLogger.LogAsync(new AuditEntry(
            Action: "Open",
            UserId: userId,
            CorrelationId: GetCorrelationId(),
            EntityType: "PosShift",
            EntityId: shift.Id.ToString("D"),
            Before: null,
            After: new { shift.OpenedAtUtc, shift.OpeningCashAmount },
            Source: "POS",
            Notes: "Shift opened",
            OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);

        return Map(shift);
    }

    public async Task<ShiftClosePreviewDto> GetClosePreviewAsync(CancellationToken ct)
    {
        var openShift = await GetOpenShiftForCloseAsync(ct).ConfigureAwait(false);
        var now = DateTimeOffset.UtcNow;
        var salesCashTotal = await GetCashSalesTotalAsync(openShift.Id, openShift.OpenedAtUtc, now, ct).ConfigureAwait(false);
        var expectedCashAmount = RoundMoney(openShift.OpeningCashAmount + salesCashTotal);

        return new ShiftClosePreviewDto(openShift.Id, openShift.OpenedAtUtc, openShift.OpeningCashAmount, salesCashTotal, expectedCashAmount);
    }

    public async Task<ClosePosShiftResultDto> CloseShiftAsync(ClosePosShiftRequestDto request, CancellationToken ct)
    {
        ValidateCountedDenominations(request.CountedDenominations);

        var openShift = await GetLatestOpenShiftForUpdateAsync(ct).ConfigureAwait(false);
        if (openShift is null)
        {
            if (request.ClientOperationId.HasValue)
            {
                var existingClosed = await _db.PosShifts.AsNoTracking()
                    .Where(x => x.CloseOperationId == request.ClientOperationId)
                    .FirstOrDefaultAsync(ct)
                    .ConfigureAwait(false);

                if (existingClosed is not null)
                {
                    return MapClosed(existingClosed);
                }
            }

            throw new ConflictException("No open shift found.");
        }

        if (request.ClientOperationId.HasValue && openShift.CloseOperationId == request.ClientOperationId)
        {
            return MapClosed(openShift);
        }

        var closedAtUtc = DateTimeOffset.UtcNow;
        var salesCashTotal = await GetCashSalesTotalAsync(openShift.Id, openShift.OpenedAtUtc, closedAtUtc, ct).ConfigureAwait(false);
        var expectedTotal = RoundMoney(openShift.OpeningCashAmount + salesCashTotal);
        var countedTotal = RoundMoney(request.CountedDenominations.Sum(x => x.DenominationValue * x.Count));
        var difference = RoundMoney(countedTotal - expectedTotal);

        var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
        var before = new
        {
            openShift.ClosedAtUtc,
            openShift.ClosingCashAmount,
            openShift.ExpectedCashAmount,
            openShift.CashDifference,
            openShift.DenominationsJson
        };

        openShift.ClosedAtUtc = closedAtUtc;
        openShift.ClosedByUserId = userId;
        openShift.ClosedByEmail = GetCurrentUserEmail();
        openShift.ClosingCashAmount = countedTotal;
        openShift.ExpectedCashAmount = expectedTotal;
        openShift.CashDifference = difference;
        openShift.DenominationsJson = JsonSerializer.Serialize(request.CountedDenominations);
        openShift.CloseNotes = request.ClosingNotes;
        openShift.CloseOperationId = request.ClientOperationId;

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        await _auditLogger.LogAsync(new AuditEntry(
            Action: "Close",
            UserId: userId,
            CorrelationId: GetCorrelationId(),
            EntityType: "PosShift",
            EntityId: openShift.Id.ToString("D"),
            Before: before,
            After: new
            {
                openShift.ClosedAtUtc,
                openShift.ClosingCashAmount,
                openShift.ExpectedCashAmount,
                openShift.CashDifference,
                SalesCashTotal = salesCashTotal,
                request.CountedDenominations
            },
            Source: "POS",
            Notes: "Shift closed",
            OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);

        return new ClosePosShiftResultDto(openShift.Id, openShift.OpenedAtUtc, closedAtUtc, openShift.OpeningCashAmount, salesCashTotal, expectedTotal, countedTotal, difference, openShift.CloseNotes);
    }

    private static PosShiftDto Map(PosShift shift) => new(
        shift.Id,
        shift.OpenedAtUtc,
        shift.OpenedByUserId,
        shift.OpenedByEmail,
        shift.OpeningCashAmount,
        shift.ClosedAtUtc,
        shift.ClosedByUserId,
        shift.ClosedByEmail,
        shift.ClosingCashAmount,
        shift.OpenNotes,
        shift.CloseNotes);

    private static ClosePosShiftResultDto MapClosed(PosShift shift)
    {
        var expected = shift.ExpectedCashAmount ?? shift.OpeningCashAmount;
        var counted = shift.ClosingCashAmount ?? expected;
        var difference = shift.CashDifference ?? RoundMoney(counted - expected);
        var closedAt = shift.ClosedAtUtc ?? DateTimeOffset.UtcNow;
        var salesCashTotal = RoundMoney(expected - shift.OpeningCashAmount);

        return new ClosePosShiftResultDto(shift.Id, shift.OpenedAtUtc, closedAt, shift.OpeningCashAmount, salesCashTotal, expected, counted, difference, shift.CloseNotes);
    }

    private async Task<PosShift> GetOpenShiftForCloseAsync(CancellationToken ct)
    {
        var openShift = await GetLatestOpenShiftForUpdateAsync(ct).ConfigureAwait(false);
        return openShift ?? throw new ConflictException("No open shift found.");
    }

    private async Task<PosShift?> GetLatestOpenShiftAsync(CancellationToken ct)
    {
        var openShiftsQuery = _db.PosShifts.AsNoTracking().Where(x => x.ClosedAtUtc == null);

        if (_db.Database.IsSqlite())
        {
            return (await openShiftsQuery.ToListAsync(ct).ConfigureAwait(false))
                .OrderByDescending(x => x.OpenedAtUtc)
                .FirstOrDefault();
        }

        return await openShiftsQuery.OrderByDescending(x => x.OpenedAtUtc).FirstOrDefaultAsync(ct).ConfigureAwait(false);
    }

    private async Task<PosShift?> GetLatestOpenShiftForUpdateAsync(CancellationToken ct)
    {
        var openShiftsQuery = _db.PosShifts.Where(x => x.ClosedAtUtc == null);

        if (_db.Database.IsSqlite())
        {
            return (await openShiftsQuery.ToListAsync(ct).ConfigureAwait(false))
                .OrderByDescending(x => x.OpenedAtUtc)
                .FirstOrDefault();
        }

        return await openShiftsQuery.OrderByDescending(x => x.OpenedAtUtc).FirstOrDefaultAsync(ct).ConfigureAwait(false);
    }

    private async Task<decimal> GetCashSalesTotalAsync(Guid shiftId, DateTimeOffset openedAtUtc, DateTimeOffset untilUtc, CancellationToken ct)
    {
        if (_db.Database.IsSqlite())
        {
            var saleIds = (await _db.Sales.AsNoTracking()
                .Select(x => new { x.Id, x.ShiftId, x.Status, x.OccurredAtUtc })
                .ToListAsync(ct)
                .ConfigureAwait(false))
                .Where(x => x.ShiftId == shiftId)
                .Where(x => x.Status == SaleStatus.Completed)
                .Where(x => x.OccurredAtUtc >= openedAtUtc && x.OccurredAtUtc <= untilUtc)
                .Select(x => x.Id)
                .ToList();

            if (saleIds.Count == 0)
            {
                return 0m;
            }

            var cashPayments = await _db.Payments.AsNoTracking()
                .Where(x => saleIds.Contains(x.SaleId))
                .Where(x => x.Method == PaymentMethod.Cash)
                .Select(x => x.Amount)
                .ToListAsync(ct)
                .ConfigureAwait(false);

            return RoundMoney(cashPayments.Sum());
        }

        var total = await _db.Sales.AsNoTracking()
            .Join(_db.Payments.AsNoTracking(), sale => sale.Id, payment => payment.SaleId, (sale, payment) => new { sale, payment })
            .Where(x => x.sale.ShiftId == shiftId)
            .Where(x => x.sale.Status == SaleStatus.Completed)
            .Where(x => x.sale.OccurredAtUtc >= openedAtUtc && x.sale.OccurredAtUtc <= untilUtc)
            .Where(x => x.payment.Method == PaymentMethod.Cash)
            .SumAsync(x => (decimal?)x.payment.Amount, ct)
            .ConfigureAwait(false);

        return RoundMoney(total ?? 0m);
    }

    private static decimal RoundMoney(decimal amount) => decimal.Round(amount, 2, MidpointRounding.AwayFromZero);

    private static void ValidateCountedDenominations(IReadOnlyCollection<CountedDenominationDto> countedDenominations)
    {
        if (countedDenominations.Count == 0)
        {
            throw ValidationError("countedDenominations", "countedDenominations is required.");
        }

        if (countedDenominations.Any(x => x.DenominationValue <= 0))
        {
            throw ValidationError("countedDenominations", "denominationValue must be greater than zero.");
        }

        if (countedDenominations.Any(x => x.Count < 0))
        {
            throw ValidationError("countedDenominations", "count must be greater than or equal to zero.");
        }
    }

    private static ValidationException ValidationError(string key, string message) =>
        new(new Dictionary<string, string[]> { [key] = [message] });

    private string GetCorrelationId() => _httpContextAccessor.HttpContext?.Items["CorrelationId"] as string
        ?? Activity.Current?.TraceId.ToString()
        ?? _httpContextAccessor.HttpContext?.TraceIdentifier
        ?? Guid.NewGuid().ToString("D");

    private Guid? GetCurrentUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        var raw = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user?.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out var userId) ? userId : null;
    }

    private string? GetCurrentUserEmail()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        return user?.FindFirst(ClaimTypes.Email)?.Value ?? user?.FindFirst("email")?.Value;
    }
}
