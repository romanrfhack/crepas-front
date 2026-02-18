using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces;
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
    private readonly IBusinessTime _businessTime;
    private readonly PosStoreContextService _storeContext;

    public PosShiftService(CobranzaDigitalDbContext db, IAuditLogger auditLogger, IHttpContextAccessor httpContextAccessor, IBusinessTime businessTime, PosStoreContextService storeContext)
    {
        _db = db;
        _auditLogger = auditLogger;
        _httpContextAccessor = httpContextAccessor;
        _businessTime = businessTime;
        _storeContext = storeContext;
    }

    public async Task<PosShiftDto?> GetCurrentShiftAsync(Guid? storeId, CancellationToken ct)
    {
        var resolvedStoreId = (await _storeContext.ResolveStoreAsync(storeId, ct).ConfigureAwait(false)).StoreId;
        var shift = await GetLatestOpenShiftAsync(resolvedStoreId, ct).ConfigureAwait(false);
        return shift is null ? null : Map(shift);
    }

    public async Task<PosShiftDto> OpenShiftAsync(OpenPosShiftRequestDto request, CancellationToken ct)
    {
        var openingCashAmount = request.ResolveOpeningCashAmount();
        if (openingCashAmount < 0)
        {
            throw ValidationError("openingCashAmount", "openingCashAmount cannot be negative.");
        }

        var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
        var resolvedStoreId = (await _storeContext.ResolveStoreAsync(request.StoreId, ct).ConfigureAwait(false)).StoreId;

        if (request.ClientOperationId.HasValue)
        {
            var existingByOperation = await _db.PosShifts.AsNoTracking()
                .Where(x => x.OpenOperationId == request.ClientOperationId && x.OpenedByUserId == userId && x.StoreId == resolvedStoreId)
                .FirstOrDefaultAsync(ct)
                .ConfigureAwait(false);

            if (existingByOperation is not null)
            {
                return Map(existingByOperation);
            }
        }

        var existingOpen = await GetLatestOpenShiftAsync(resolvedStoreId, ct).ConfigureAwait(false);
        if (existingOpen is not null)
        {
            return Map(existingOpen);
        }

        var shift = new PosShift
        {
            Id = Guid.NewGuid(),
            OpenedAtUtc = _businessTime.UtcNow,
            OpenedByUserId = userId,
            OpenedByEmail = GetCurrentUserEmail(),
            OpeningCashAmount = openingCashAmount,
            OpenNotes = request.Notes,
            OpenOperationId = request.ClientOperationId,
            StoreId = resolvedStoreId
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

    public async Task<ShiftClosePreviewDto> GetClosePreviewAsync(ShiftClosePreviewRequestDto request, CancellationToken ct)
    {
        var storeId = (await _storeContext.ResolveStoreAsync(request.StoreId, ct).ConfigureAwait(false)).StoreId;
        var openShift = await GetOpenShiftForCloseAsync(request.ShiftId, storeId, ct).ConfigureAwait(false);
        var now = _businessTime.UtcNow;
        var breakdown = await GetPaymentBreakdownAsync(openShift.Id, openShift.OpenedAtUtc, now, ct).ConfigureAwait(false);
        var salesCashTotal = breakdown.CashAmount;
        var expectedCashAmount = RoundMoney(openShift.OpeningCashAmount + salesCashTotal);
        var counted = request.CashCount is { Count: > 0 }
            ? RoundMoney(request.CashCount.Sum(x => x.DenominationValue * x.Count))
            : (decimal?)null;
        var difference = counted.HasValue ? RoundMoney(counted.Value - expectedCashAmount) : (decimal?)null;

        return new ShiftClosePreviewDto(openShift.Id, openShift.OpenedAtUtc, openShift.OpeningCashAmount, salesCashTotal, expectedCashAmount, counted, difference, openShift.ClosingCashAmount, breakdown);
    }

    public async Task<ClosePosShiftResultDto> CloseShiftAsync(ClosePosShiftRequestDto request, CancellationToken ct)
    {
        if (request.CountedDenominations is { Count: > 0 })
        {
            ValidateCountedDenominations(request.CountedDenominations);
        }

        var storeId = (await _storeContext.ResolveStoreAsync(request.StoreId, ct).ConfigureAwait(false)).StoreId;
        var openShift = await GetLatestOpenShiftForUpdateAsync(request.ShiftId, storeId, ct).ConfigureAwait(false);
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

        var closedAtUtc = _businessTime.UtcNow;
        var breakdown = await GetPaymentBreakdownAsync(openShift.Id, openShift.OpenedAtUtc, closedAtUtc, ct).ConfigureAwait(false);
        var salesCashTotal = breakdown.CashAmount;
        var expectedTotal = RoundMoney(openShift.OpeningCashAmount + salesCashTotal);
        var countedTotal = request.CountedDenominations is { Count: > 0 }
            ? RoundMoney(request.CountedDenominations.Sum(x => x.DenominationValue * x.Count))
            : expectedTotal;
        var difference = RoundMoney(countedTotal - expectedTotal);

        var threshold = (await _db.PosSettings.AsNoTracking().OrderBy(x => x.Id).FirstAsync(ct).ConfigureAwait(false)).CashDifferenceThreshold;
        if (Math.Abs(difference) > threshold && string.IsNullOrWhiteSpace(request.CloseReason))
        {
            throw ValidationError("closeReason", "closeReason is required when cash difference exceeds threshold.");
        }

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
        openShift.DenominationsJson = request.CountedDenominations is { Count: > 0 }
            ? JsonSerializer.Serialize(request.CountedDenominations)
            : openShift.DenominationsJson;
        openShift.CloseNotes = request.ClosingNotes;
        openShift.CloseReason = request.CloseReason;
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
                Breakdown = breakdown,
                request.CountedDenominations,
                request.CloseReason
            },
            Source: "POS",
            Notes: "Shift closed",
            OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);

        return new ClosePosShiftResultDto(openShift.Id, openShift.OpenedAtUtc, closedAtUtc, openShift.OpeningCashAmount, salesCashTotal, expectedTotal, countedTotal, difference, openShift.CloseNotes, openShift.CloseReason);
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
        shift.CloseNotes,
        shift.StoreId);

    private static ClosePosShiftResultDto MapClosed(PosShift shift)
    {
        var expected = shift.ExpectedCashAmount ?? shift.OpeningCashAmount;
        var counted = shift.ClosingCashAmount ?? expected;
        var difference = shift.CashDifference ?? RoundMoney(counted - expected);
        var closedAt = shift.ClosedAtUtc ?? DateTimeOffset.UtcNow;
        var salesCashTotal = RoundMoney(expected - shift.OpeningCashAmount);

        return new ClosePosShiftResultDto(shift.Id, shift.OpenedAtUtc, closedAt, shift.OpeningCashAmount, salesCashTotal, expected, counted, difference, shift.CloseNotes, shift.CloseReason);
    }

    private async Task<PosShift> GetOpenShiftForCloseAsync(Guid? shiftId, Guid storeId, CancellationToken ct)
    {
        var openShift = await GetLatestOpenShiftForUpdateAsync(shiftId, storeId, ct).ConfigureAwait(false);
        return openShift ?? throw new ConflictException("No open shift found.");
    }

    private async Task<PosShift?> GetLatestOpenShiftAsync(Guid storeId, CancellationToken ct)
    {
        var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
        var openShiftsQuery = _db.PosShifts.AsNoTracking().Where(x => x.ClosedAtUtc == null && x.OpenedByUserId == userId && x.StoreId == storeId);

        return await openShiftsQuery.OrderByDescending(x => x.OpenedAtUtc).FirstOrDefaultAsync(ct).ConfigureAwait(false);
    }

    private async Task<PosShift?> GetLatestOpenShiftForUpdateAsync(Guid? shiftId, Guid storeId, CancellationToken ct)
    {
        var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
        var openShiftsQuery = _db.PosShifts.Where(x => x.ClosedAtUtc == null && x.OpenedByUserId == userId && x.StoreId == storeId);
        if (shiftId.HasValue)
        {
            openShiftsQuery = openShiftsQuery.Where(x => x.Id == shiftId.Value);
        }

        return await openShiftsQuery.OrderByDescending(x => x.OpenedAtUtc).FirstOrDefaultAsync(ct).ConfigureAwait(false);
    }

    private async Task<PaymentBreakdownDto> GetPaymentBreakdownAsync(Guid shiftId, DateTimeOffset openedAtUtc, DateTimeOffset untilUtc, CancellationToken ct)
    {
        var sales = await _db.Sales.AsNoTracking()
            .Where(x => x.ShiftId == shiftId)
            .Where(x => x.Status == SaleStatus.Completed)
            .Where(x => x.OccurredAtUtc >= openedAtUtc && x.OccurredAtUtc <= untilUtc)
            .Select(x => x.Id)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (sales.Count == 0)
        {
            return new PaymentBreakdownDto(0m, 0m, 0m, 0);
        }

        var payments = await _db.Payments.AsNoTracking()
            .Where(x => sales.Contains(x.SaleId))
            .Select(x => new { x.Method, x.Amount })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return new PaymentBreakdownDto(
            RoundMoney(payments.Where(x => x.Method == PaymentMethod.Cash).Sum(x => x.Amount)),
            RoundMoney(payments.Where(x => x.Method == PaymentMethod.Card).Sum(x => x.Amount)),
            RoundMoney(payments.Where(x => x.Method == PaymentMethod.Transfer).Sum(x => x.Amount)),
            sales.Count);
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
