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
