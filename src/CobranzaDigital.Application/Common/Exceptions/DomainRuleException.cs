namespace CobranzaDigital.Application.Common.Exceptions;

public sealed class DomainRuleException : Exception
{
    public DomainRuleException(string message)
        : base(message)
    {
    }
}
