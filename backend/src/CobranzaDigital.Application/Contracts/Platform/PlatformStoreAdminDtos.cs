namespace CobranzaDigital.Application.Contracts.Platform;

public sealed record PlatformTenantStoreListItemDto(
    Guid Id,
    Guid TenantId,
    string Name,
    bool IsActive,
    bool IsDefaultStore,
    bool HasAdminStore,
    int AdminStoreUserCount,
    int TotalUsersInStore,
    string TimeZoneId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record PlatformStoreDetailsDto(
    Guid Id,
    Guid TenantId,
    string TenantName,
    string Name,
    bool IsActive,
    bool IsDefaultStore,
    bool HasAdminStore,
    int AdminStoreUserCount,
    int TotalUsersInStore,
    string TimeZoneId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record UpdatePlatformStoreRequestDto(
    string Name,
    string TimeZoneId,
    bool IsActive);

public sealed record UpdateTenantDefaultStoreRequestDto(Guid DefaultStoreId);

