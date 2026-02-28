using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Application.Interfaces.Platform;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PlatformTenantService : IPlatformTenantService
{
    private const string AdminStoreRoleName = "AdminStore";
    private const string ManagerRoleName = "Manager";
    private const string CashierRoleName = "Cashier";
    private readonly CobranzaDigitalDbContext _db;

    public PlatformTenantService(CobranzaDigitalDbContext db) => _db = db;

    public async Task<PlatformTenantDetailsDto> GetTenantDetailsAsync(Guid tenantId, CancellationToken ct)
    {
        var tenantRow = await (from tenant in _db.Tenants.AsNoTracking()
                               where tenant.Id == tenantId
                               join vertical in _db.Verticals.AsNoTracking() on tenant.VerticalId equals vertical.Id into verticalJoin
                               from vertical in verticalJoin.DefaultIfEmpty()
                               join defaultStore in _db.Stores.AsNoTracking() on tenant.DefaultStoreId equals defaultStore.Id into defaultStoreJoin
                               from defaultStore in defaultStoreJoin.DefaultIfEmpty()
                               select new
                               {
                                   tenant.Id,
                                   tenant.Name,
                                   tenant.Slug,
                                   tenant.VerticalId,
                                   VerticalName = vertical != null ? vertical.Name : null,
                                   tenant.IsActive,
                                   tenant.DefaultStoreId,
                                   DefaultStoreName = defaultStore != null ? defaultStore.Name : null,
                                   tenant.CreatedAtUtc,
                                   tenant.UpdatedAtUtc
                               })
            .SingleOrDefaultAsync(ct)
            .ConfigureAwait(false);

        if (tenantRow is null)
        {
            throw new NotFoundException("Tenant", tenantId);
        }

        var storeStats = await _db.Stores.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                StoreCount = g.Count(),
                ActiveStoreCount = g.Count(x => x.IsActive)
            })
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

        var usersCount = await _db.Users.AsNoTracking().CountAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);

        var storeScopedRoleIds = await _db.Roles.AsNoTracking()
            .Where(x => x.Name == AdminStoreRoleName || x.Name == ManagerRoleName || x.Name == CashierRoleName)
            .Select(x => x.Id)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var usersWithoutStoreAssignmentCount = await _db.UserRoles.AsNoTracking()
            .Where(x => storeScopedRoleIds.Contains(x.RoleId))
            .Join(_db.Users.AsNoTracking(), ur => ur.UserId, u => u.Id, (ur, u) => new { u.Id, u.TenantId, u.StoreId })
            .Where(x => x.TenantId == tenantId && x.StoreId == null)
            .Select(x => x.Id)
            .Distinct()
            .CountAsync(ct)
            .ConfigureAwait(false);

        var adminStoreRoleId = await _db.Roles.AsNoTracking()
            .Where(x => x.Name == AdminStoreRoleName)
            .Select(x => (Guid?)x.Id)
            .SingleOrDefaultAsync(ct)
            .ConfigureAwait(false);

        var storesWithoutAdminStoreCount = adminStoreRoleId.HasValue
            ? await _db.Stores.AsNoTracking()
                .Where(store => store.TenantId == tenantId)
                .GroupJoin(
                    _db.UserRoles.AsNoTracking().Where(ur => ur.RoleId == adminStoreRoleId.Value)
                        .Join(_db.Users.AsNoTracking(), ur => ur.UserId, user => user.Id, (_, user) => new { user.StoreId }),
                    store => store.Id,
                    admin => admin.StoreId,
                    (store, admins) => new { admins })
                .CountAsync(x => !x.admins.Any(y => y.StoreId.HasValue), ct)
                .ConfigureAwait(false)
            : await _db.Stores.AsNoTracking().CountAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);

        var tenantTemplate = await _db.TenantCatalogTemplates.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CatalogTemplateId.HasValue)
            .Join(_db.CatalogTemplates.AsNoTracking(), t => t.CatalogTemplateId, c => (Guid?)c.Id, (t, c) => new { t.CatalogTemplateId, c.Name })
            .Select(x => new { x.CatalogTemplateId, CatalogTemplateName = x.Name })
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

        return new PlatformTenantDetailsDto(
            tenantRow.Id,
            tenantRow.Name,
            tenantRow.Slug,
            tenantRow.VerticalId,
            tenantRow.VerticalName,
            tenantRow.IsActive,
            tenantRow.DefaultStoreId,
            tenantRow.DefaultStoreName,
            storeStats?.StoreCount ?? 0,
            storeStats?.ActiveStoreCount ?? 0,
            tenantTemplate is not null,
            tenantTemplate?.CatalogTemplateId,
            tenantTemplate?.CatalogTemplateName,
            usersCount,
            usersWithoutStoreAssignmentCount,
            storesWithoutAdminStoreCount,
            tenantRow.CreatedAtUtc,
            tenantRow.UpdatedAtUtc);
    }

    public async Task<PlatformTenantDetailsDto> UpdateTenantAsync(Guid tenantId, UpdatePlatformTenantRequestDto request, CancellationToken ct)
    {
        var trimmedName = request.Name?.Trim() ?? string.Empty;
        var trimmedSlug = request.Slug?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["name"] = ["Name is required."] });
        }

        if (string.IsNullOrWhiteSpace(trimmedSlug))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["slug"] = ["Slug is required."] });
        }

        var tenant = await _db.Tenants.SingleOrDefaultAsync(x => x.Id == tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            throw new NotFoundException("Tenant", tenantId);
        }

        if (await _db.Tenants.AsNoTracking().AnyAsync(x => x.Id != tenantId && x.Slug == trimmedSlug, ct).ConfigureAwait(false))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["slug"] = ["Slug already exists."] });
        }

        var nextVerticalId = request.VerticalId ?? tenant.VerticalId;
        if (!await _db.Verticals.AsNoTracking().AnyAsync(x => x.Id == nextVerticalId && x.IsActive, ct).ConfigureAwait(false))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["verticalId"] = ["Vertical does not exist or is inactive."] });
        }

        tenant.Name = trimmedName;
        tenant.Slug = trimmedSlug;
        tenant.VerticalId = nextVerticalId;
        if (request.IsActive.HasValue)
        {
            tenant.IsActive = request.IsActive.Value;
        }

        tenant.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        return await GetTenantDetailsAsync(tenantId, ct).ConfigureAwait(false);
    }
}
