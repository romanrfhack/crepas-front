using System.Diagnostics;
using System.Security.Claims;
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
        PosShift? shift;
        var openShiftsQuery = _db.PosShifts.AsNoTracking().Where(x => x.ClosedAtUtc == null);

        if (_db.Database.IsSqlite())
        {
            shift = (await openShiftsQuery
                .ToListAsync(ct)
                .ConfigureAwait(false))
                .OrderByDescending(x => x.OpenedAtUtc)
                .FirstOrDefault();
        }
        else
        {
            shift = await openShiftsQuery
                .OrderByDescending(x => x.OpenedAtUtc)
                .FirstOrDefaultAsync(ct)
                .ConfigureAwait(false);
        }

        return shift is null ? null : Map(shift);
    }

    public async Task<PosShiftDto> OpenShiftAsync(OpenPosShiftRequestDto request, CancellationToken ct)
    {
        if (request.OpeningCashAmount < 0)
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

        var existingOpen = await _db.PosShifts.AsNoTracking()
            .Where(x => x.ClosedAtUtc == null)
            .OrderByDescending(x => x.OpenedAtUtc)
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);
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
            OpeningCashAmount = request.OpeningCashAmount,
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

    public async Task<PosShiftDto> CloseShiftAsync(ClosePosShiftRequestDto request, CancellationToken ct)
    {
        if (request.ClosingCashAmount < 0)
        {
            throw ValidationError("closingCashAmount", "closingCashAmount cannot be negative.");
        }

        var openShift = await _db.PosShifts.FirstOrDefaultAsync(x => x.ClosedAtUtc == null, ct).ConfigureAwait(false);
        if (openShift is null)
        {
            if (request.ClientOperationId.HasValue)
            {
                var closedByOperation = await _db.PosShifts.AsNoTracking()
                    .Where(x => x.CloseOperationId == request.ClientOperationId)
                    .FirstOrDefaultAsync(ct)
                    .ConfigureAwait(false);
                if (closedByOperation is not null)
                {
                    return Map(closedByOperation);
                }
            }

            throw new ConflictException("No open shift found.");
        }

        if (request.ClientOperationId.HasValue && openShift.CloseOperationId == request.ClientOperationId)
        {
            return Map(openShift);
        }

        var userId = GetCurrentUserId() ?? throw new UnauthorizedException("Authenticated user is required.");
        openShift.ClosedAtUtc = DateTimeOffset.UtcNow;
        openShift.ClosedByUserId = userId;
        openShift.ClosedByEmail = GetCurrentUserEmail();
        openShift.ClosingCashAmount = request.ClosingCashAmount;
        openShift.CloseNotes = request.Notes;
        openShift.CloseOperationId = request.ClientOperationId;

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        await _auditLogger.LogAsync(new AuditEntry(
            Action: "Close",
            UserId: userId,
            CorrelationId: GetCorrelationId(),
            EntityType: "PosShift",
            EntityId: openShift.Id.ToString("D"),
            Before: null,
            After: new { openShift.ClosedAtUtc, openShift.ClosingCashAmount },
            Source: "POS",
            Notes: "Shift closed",
            OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);

        return Map(openShift);
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

    private static ValidationException ValidationError(string key, string message)
    {
        return new ValidationException(new Dictionary<string, string[]> { [key] = [message] });
    }

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
