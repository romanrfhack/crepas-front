namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record AdminUserDto(
    string Id,
    string Email,
    string UserName,
    IReadOnlyCollection<string> Roles,
    bool IsLockedOut,
    DateTimeOffset? LockoutEnd,
    Guid? TenantId,
    Guid? StoreId);
