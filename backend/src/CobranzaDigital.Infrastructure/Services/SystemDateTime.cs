using CobranzaDigital.Application.Interfaces;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class SystemDateTime : IDateTime
{
    public DateTime UtcNow => DateTime.UtcNow;
}
