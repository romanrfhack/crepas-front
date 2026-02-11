namespace CobranzaDigital.Api.Observability;

public interface IAuditRequestContextAccessor
{
    string GetCorrelationId();
    Guid? GetUserId();
}
