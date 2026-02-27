namespace CobranzaDigital.Application.Contracts.Admin;

public sealed record SetTemporaryPasswordRequestDto(string TemporaryPassword);

public sealed record SetTemporaryPasswordResponseDto(
    string Id,
    string Email,
    string UserName,
    IReadOnlyCollection<string> Roles,
    Guid? TenantId,
    Guid? StoreId,
    string Message);
