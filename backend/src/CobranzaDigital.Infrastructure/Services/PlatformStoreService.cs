using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Application.Interfaces.Platform;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PlatformStoreService : IPlatformStoreService
{
    private const string AdminStoreRoleName = "AdminStore";
    private readonly CobranzaDigitalDbContext _db;

    public PlatformStoreService(CobranzaDigitalDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<PlatformTenantStoreListItemDto>> GetStoresByTenantAsync(Guid tenantId, CancellationToken ct)
    {
        if (!await _db.Tenants.AsNoTracking().AnyAsync(x => x.Id == tenantId, ct).ConfigureAwait(false))
        {
            throw new NotFoundException("Tenant", tenantId);
        }

        var tenantDefaultStoreId = await _db.Tenants.AsNoTracking()
            .Where(x => x.Id == tenantId)
            .Select(x => x.DefaultStoreId)
            .SingleAsync(ct)
            .ConfigureAwait(false);

        var storeRows = await _db.Stores.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Name,
                x.IsActive,
                x.TimeZoneId,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var storeIds = storeRows.Select(x => x.Id).ToArray();
        var adminStoreCountsByStore = await GetAdminStoreCountsByStoreAsync(storeIds, ct).ConfigureAwait(false);
        var totalUsersByStore = await GetTotalUsersByStoreAsync(storeIds, ct).ConfigureAwait(false);

        return storeRows.Select(row =>
        {
            var adminStoreCount = adminStoreCountsByStore.GetValueOrDefault(row.Id, 0);
            return new PlatformTenantStoreListItemDto(
                row.Id,
                row.TenantId,
                row.Name,
                row.IsActive,
                row.Id == tenantDefaultStoreId,
                adminStoreCount > 0,
                adminStoreCount,
                totalUsersByStore.GetValueOrDefault(row.Id, 0),
                row.TimeZoneId,
                row.CreatedAtUtc,
                row.UpdatedAtUtc);
        }).ToArray();
    }

    public async Task<PlatformStoreDetailsDto> GetStoreByIdAsync(Guid storeId, CancellationToken ct)
    {
        var row = await _db.Stores.AsNoTracking()
            .Join(_db.Tenants.AsNoTracking(), store => store.TenantId, tenant => tenant.Id, (store, tenant) => new
            {
                store.Id,
                store.TenantId,
                TenantName = tenant.Name,
                tenant.DefaultStoreId,
                store.Name,
                store.IsActive,
                store.TimeZoneId,
                store.CreatedAtUtc,
                store.UpdatedAtUtc
            })
            .SingleOrDefaultAsync(x => x.Id == storeId, ct)
            .ConfigureAwait(false);

        if (row is null)
        {
            throw new NotFoundException("Store", storeId);
        }

        var singleStoreIds = new[] { storeId };
        var adminStoreCountsByStore = await GetAdminStoreCountsByStoreAsync(singleStoreIds, ct).ConfigureAwait(false);
        var totalUsersByStore = await GetTotalUsersByStoreAsync(singleStoreIds, ct).ConfigureAwait(false);
        var adminStoreCount = adminStoreCountsByStore.GetValueOrDefault(storeId, 0);

        return new PlatformStoreDetailsDto(
            row.Id,
            row.TenantId,
            row.TenantName,
            row.Name,
            row.IsActive,
            row.DefaultStoreId == row.Id,
            adminStoreCount > 0,
            adminStoreCount,
            totalUsersByStore.GetValueOrDefault(storeId, 0),
            row.TimeZoneId,
            row.CreatedAtUtc,
            row.UpdatedAtUtc);
    }

    public async Task<PlatformStoreDetailsDto> UpdateStoreAsync(Guid storeId, UpdatePlatformStoreRequestDto request, CancellationToken ct)
    {
        var trimmedName = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["name"] = ["Name is required."] });
        }

        var trimmedTimeZone = request.TimeZoneId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmedTimeZone))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["timeZoneId"] = ["TimeZoneId is required."] });
        }

        ValidateTimeZone(trimmedTimeZone);

        var store = await _db.Stores.SingleOrDefaultAsync(x => x.Id == storeId, ct).ConfigureAwait(false);
        if (store is null)
        {
            throw new NotFoundException("Store", storeId);
        }

        store.Name = trimmedName;
        store.TimeZoneId = trimmedTimeZone;
        store.IsActive = request.IsActive;
        store.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return await GetStoreByIdAsync(storeId, ct).ConfigureAwait(false);
    }

    public async Task<Guid> UpdateTenantDefaultStoreAsync(Guid tenantId, UpdateTenantDefaultStoreRequestDto request, CancellationToken ct)
    {
        var tenant = await _db.Tenants.SingleOrDefaultAsync(x => x.Id == tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            throw new NotFoundException("Tenant", tenantId);
        }

        var store = await _db.Stores.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.DefaultStoreId, ct).ConfigureAwait(false);
        if (store is null)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["defaultStoreId"] = ["Store does not exist."] });
        }

        if (store.TenantId != tenantId)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["defaultStoreId"] = ["Store does not belong to tenant."] });
        }

        if (!store.IsActive)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["defaultStoreId"] = ["Default store must be active."] });
        }

        tenant.DefaultStoreId = store.Id;
        tenant.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        return store.Id;
    }

    private async Task<Dictionary<Guid, int>> GetAdminStoreCountsByStoreAsync(Guid[] storeIds, CancellationToken ct)
    {
        if (storeIds.Length == 0)
        {
            return new Dictionary<Guid, int>();
        }

        return await _db.UserRoles.AsNoTracking()
            .Join(_db.Roles.AsNoTracking().Where(role => role.Name == AdminStoreRoleName), userRole => userRole.RoleId, role => role.Id, (userRole, _) => userRole)
            .Join(_db.Users.AsNoTracking().Where(user => user.StoreId != null), userRole => userRole.UserId, user => user.Id, (userRole, user) => new { userRole.UserId, user.StoreId })
            .Where(x => x.StoreId.HasValue && storeIds.Contains(x.StoreId.Value))
            .GroupBy(x => x.StoreId!.Value)
            .Select(x => new { StoreId = x.Key, Count = x.Select(user => user.UserId).Distinct().Count() })
            .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct)
            .ConfigureAwait(false);
    }

    private async Task<Dictionary<Guid, int>> GetTotalUsersByStoreAsync(Guid[] storeIds, CancellationToken ct)
    {
        if (storeIds.Length == 0)
        {
            return new Dictionary<Guid, int>();
        }

        return await _db.Users.AsNoTracking()
            .Where(user => user.StoreId != null && storeIds.Contains(user.StoreId.Value))
            .GroupBy(user => user.StoreId!.Value)
            .Select(x => new { StoreId = x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct)
            .ConfigureAwait(false);
    }

    private static void ValidateTimeZone(string timeZoneId)
    {
        try
        {
            _ = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["timeZoneId"] = ["TimeZoneId is invalid."] });
        }
        catch (InvalidTimeZoneException)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["timeZoneId"] = ["TimeZoneId is invalid."] });
        }
    }
}
