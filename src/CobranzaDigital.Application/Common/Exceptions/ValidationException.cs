namespace CobranzaDigital.Application.Common.Exceptions;

public sealed class ValidationException : Exception
{
    public ValidationException(IReadOnlyDictionary<string, string[]> errors)
        : this("One or more validation failures have occurred.", errors)
    {
    }

    public ValidationException(string message, IReadOnlyDictionary<string, string[]> errors)
        : base(message)
    {
        Errors = errors ?? throw new ArgumentNullException(nameof(errors));
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }
}
