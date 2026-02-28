namespace CobranzaDigital.Application.Contracts.Platform;

public sealed record PlatformTenantDetailsDto(
    Guid Id,
    string Name,
    string Slug,
    Guid VerticalId,
    string? VerticalName,
    bool IsActive,
    Guid? DefaultStoreId,
    string? DefaultStoreName,
    int StoreCount,
    int ActiveStoreCount,
    bool HasCatalogTemplate,
    Guid? CatalogTemplateId,
    string? CatalogTemplateName,
    int UsersCount,
    int UsersWithoutStoreAssignmentCount,
    int StoresWithoutAdminStoreCount,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record UpdatePlatformTenantRequestDto(
    string Name,
    string Slug,
    Guid? VerticalId,
    bool? IsActive);
