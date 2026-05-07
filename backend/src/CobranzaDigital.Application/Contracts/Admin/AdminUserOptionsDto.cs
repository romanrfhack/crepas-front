namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record AdminUserCurrentScopeDto(
    string Role,
    string RoleDisplayName,
    string? RoleDescription,
    int RoleLevel,
    Guid? TenantId,
    string? TenantName,
    Guid? StoreId,
    string? StoreName);

public sealed record AdminUserOptionsDto(
    IReadOnlyCollection<AdminRoleInfoDto> Roles,
    IReadOnlyCollection<AdminTenantOptionDto> Tenants,
    IReadOnlyCollection<AdminStoreOptionDto> Stores,
    AdminUserCurrentScopeDto CurrentScope);
