namespace CobranzaDigital.Infrastructure.Options;

public sealed class PosOptions
{
    public const string SectionName = "Pos";

    public bool RequireOpenShiftForSales { get; init; }
}
