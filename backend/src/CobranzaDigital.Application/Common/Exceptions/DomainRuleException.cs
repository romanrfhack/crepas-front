namespace CobranzaDigital.Application.Common.Exceptions;

public class DomainRuleException : Exception
{
    public DomainRuleException(string message)
        : base(message)
    {
    }
}
