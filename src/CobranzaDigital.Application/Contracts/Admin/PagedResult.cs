namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record PagedResult<T>(
    int Total,
    IReadOnlyCollection<T> Items);
