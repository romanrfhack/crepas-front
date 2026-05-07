namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record PagedResult<T>(
    int Total,
    IReadOnlyCollection<T> Items,
    int PageNumber = 1,
    int PageSize = 20)
{
    public int TotalCount => Total;
}
