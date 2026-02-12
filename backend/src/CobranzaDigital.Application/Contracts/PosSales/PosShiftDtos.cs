namespace CobranzaDigital.Application.Contracts.PosSales;

public sealed record OpenPosShiftRequestDto(decimal OpeningCashAmount, string? Notes, Guid? ClientOperationId);

public sealed record ClosePosShiftRequestDto(decimal ClosingCashAmount, string? Notes, Guid? ClientOperationId);

public sealed record PosShiftDto(
    Guid Id,
    DateTimeOffset OpenedAtUtc,
    Guid OpenedByUserId,
    string? OpenedByEmail,
    decimal OpeningCashAmount,
    DateTimeOffset? ClosedAtUtc,
    Guid? ClosedByUserId,
    string? ClosedByEmail,
    decimal? ClosingCashAmount,
    string? OpenNotes,
    string? CloseNotes);
