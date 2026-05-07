namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record AdminRoleInfoDto(
    string Name,
    string DisplayName,
    string? Description,
    int Level);

public sealed record AdminTenantOptionDto(
    Guid Id,
    string Name,
    string? Slug);

public sealed record AdminStoreOptionDto(
    Guid Id,
    Guid TenantId,
    string Name);

public sealed record AdminUserStatusDto(
    bool IsLockedOut,
    DateTimeOffset? LockoutEnd,
    string Label);

public sealed record AdminUserAllowedActionsDto(
    bool CanEdit,
    bool CanChangeRole,
    bool CanChangeScope,
    bool CanLock,
    bool CanUnlock,
    bool CanResetTemporaryPassword);

public sealed record AdminUserDto(
    string Id,
    string Email,
    string UserName,
    IReadOnlyCollection<string> Roles,
    bool IsLockedOut,
    DateTimeOffset? LockoutEnd,
    Guid? TenantId,
    Guid? StoreId,
    string DisplayName,
    AdminRoleInfoDto PrimaryRole,
    IReadOnlyCollection<AdminRoleInfoDto> RoleDetails,
    AdminTenantOptionDto? Tenant,
    AdminStoreOptionDto? Store,
    AdminUserStatusDto Status,
    AdminUserAllowedActionsDto AllowedActions);
