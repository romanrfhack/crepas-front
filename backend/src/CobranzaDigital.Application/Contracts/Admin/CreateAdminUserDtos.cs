namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record CreateAdminUserRequestDto(
    string Email,
    string UserName,
    string Role,
    Guid? TenantId,
    Guid? StoreId,
    string TemporaryPassword);

public sealed record CreateAdminUserResponseDto(
    string Id,
    string Email,
    string UserName,
    IReadOnlyCollection<string> Roles,
    Guid? TenantId,
    Guid? StoreId,
    bool IsLockedOut);
