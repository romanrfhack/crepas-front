namespace CobranzaDigital.Application.Common.Exceptions;

public sealed class NotFoundException : Exception
{
    public NotFoundException(string message)
        : base(message)
    {
    }

    public NotFoundException(string resourceName, object resourceKey)
        : base($"{resourceName} ({resourceKey}) was not found.")
    {
    }
}
