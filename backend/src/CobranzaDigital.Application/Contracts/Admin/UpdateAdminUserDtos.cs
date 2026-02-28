namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record UpdateAdminUserRequestDto(
    string UserName,
    Guid? TenantId,
    Guid? StoreId);
