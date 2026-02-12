using System.Text.Json.Serialization;

namespace CobranzaDigital.Application.Contracts.PosSales;

public sealed record OpenPosShiftRequestDto
{
    [JsonPropertyName("openingCashAmount")]
    public decimal? OpeningCashAmount { get; init; }

    [JsonPropertyName("startingCashAmount")]
    public decimal? StartingCashAmount { get; init; }

    public string? Notes { get; init; }

    public Guid? ClientOperationId { get; init; }

    public decimal ResolveOpeningCashAmount() => StartingCashAmount ?? OpeningCashAmount ?? 0m;
}

public sealed record CountedDenominationDto(decimal DenominationValue, int Count);

public sealed record ClosePosShiftRequestDto(
    IReadOnlyCollection<CountedDenominationDto> CountedDenominations,
    string? ClosingNotes,
    Guid? ClientOperationId);

public sealed record ShiftClosePreviewDto(
    Guid ShiftId,
    DateTimeOffset OpenedAtUtc,
    decimal OpeningCashAmount,
    decimal SalesCashTotal,
    decimal ExpectedCashAmount);

public sealed record ClosePosShiftResultDto(
    Guid ShiftId,
    DateTimeOffset OpenedAtUtc,
    DateTimeOffset ClosedAtUtc,
    decimal OpeningCashAmount,
    decimal SalesCashTotal,
    decimal ExpectedCashAmount,
    decimal CountedCashAmount,
    decimal Difference,
    string? CloseNotes);

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
