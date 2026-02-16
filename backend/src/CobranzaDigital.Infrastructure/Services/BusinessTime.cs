using CobranzaDigital.Application.Interfaces;

using TimeZoneConverter;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class BusinessTime : IBusinessTime
{
    private static readonly TimeZoneInfo MexicoCityTimeZone = ResolveMexicoCityTimeZone();

    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;

    public DateTimeOffset LocalNow => ToLocal(UtcNow);

    public DateOnly BusinessDate => DateOnly.FromDateTime(LocalNow.DateTime);

    public DateTimeOffset ToLocal(DateTimeOffset utc) => TimeZoneInfo.ConvertTime(utc, MexicoCityTimeZone);

    public DateOnly ToBusinessDate(DateTimeOffset utc) => DateOnly.FromDateTime(ToLocal(utc).DateTime);

    private static TimeZoneInfo ResolveMexicoCityTimeZone()
    {
        var fallbackIds = new[]
        {
            "America/Mexico_City",
            "Central Standard Time (Mexico)",
            "Central Standard Time"
        };

        foreach (var zoneId in fallbackIds)
        {
            try
            {
                return TZConvert.GetTimeZoneInfo(zoneId);
            }
            catch (TimeZoneNotFoundException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }
}
