namespace CobranzaDigital.Application.Interfaces;

public interface IBusinessTime
{
    DateTimeOffset UtcNow { get; }
    DateTimeOffset LocalNow { get; }
    DateOnly BusinessDate { get; }
    DateTimeOffset ToLocal(DateTimeOffset utc);
    DateOnly ToBusinessDate(DateTimeOffset utc);
}
