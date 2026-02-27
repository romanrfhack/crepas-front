using CobranzaDigital.Application.Contracts.Admin;

namespace CobranzaDigital.Application.Interfaces;

public interface IUserAdminService
{
    Task<CreateAdminUserResponseDto> CreateUserAsync(CreateAdminUserRequestDto request, CancellationToken cancellationToken);
    Task<SetTemporaryPasswordResponseDto> SetTemporaryPasswordAsync(string userId, SetTemporaryPasswordRequestDto request, CancellationToken cancellationToken);
    Task<PagedResult<AdminUserDto>> GetUsersAsync(string? search, Guid? tenantId, Guid? storeId, int page, int pageSize, CancellationToken cancellationToken);
    Task<AdminUserDto> GetUserByIdAsync(string userId, CancellationToken cancellationToken);
    Task<AdminUserDto> ReplaceUserRolesAsync(string userId, IReadOnlyCollection<string> roles, CancellationToken cancellationToken);
    Task<AdminUserDto> SetUserLockAsync(string userId, bool lockUser, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<string>> GetRolesAsync(CancellationToken cancellationToken);
    Task CreateRoleAsync(string roleName, CancellationToken cancellationToken);
    Task DeleteRoleAsync(string roleName, CancellationToken cancellationToken);
}
