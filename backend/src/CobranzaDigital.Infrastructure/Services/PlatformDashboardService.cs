using System.Globalization;

using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Application.Interfaces.Platform;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PlatformDashboardService : IPlatformDashboardService
{
    private const decimal DefaultLowStockThreshold = 5m;
    private readonly CobranzaDigitalDbContext _db;

    public PlatformDashboardService(CobranzaDigitalDbContext db) => _db = db;

    public async Task<PlatformDashboardSummaryDto> GetSummaryAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, decimal threshold, CancellationToken ct)
    {
        var normalizedThreshold = threshold > 0m ? threshold : DefaultLowStockThreshold;
        var (todayFrom, todayTo) = ResolveRange(dateFrom, dateTo, 1);
        var last7From = todayTo.AddDays(-6);

        var activeTenants = await _db.Tenants.AsNoTracking().CountAsync(x => x.IsActive, ct).ConfigureAwait(false);
        var inactiveTenants = await _db.Tenants.AsNoTracking().CountAsync(x => !x.IsActive, ct).ConfigureAwait(false);
        var activeStores = await _db.Stores.AsNoTracking().CountAsync(x => x.IsActive, ct).ConfigureAwait(false);
        var inactiveStores = await _db.Stores.AsNoTracking().CountAsync(x => !x.IsActive, ct).ConfigureAwait(false);
        var totalUsers = await _db.Users.AsNoTracking().CountAsync(ct).ConfigureAwait(false);

        var storeScopedRoleIds = await _db.Roles.AsNoTracking()
            .Where(x => x.Name == "AdminStore" || x.Name == "Manager" || x.Name == "Cashier")
            .Select(x => x.Id)
            .ToListAsync(ct).ConfigureAwait(false);

        var usersWithoutStoreAssignment = await _db.UserRoles.AsNoTracking()
            .Where(x => storeScopedRoleIds.Contains(x.RoleId))
            .Join(_db.Users.AsNoTracking(), x => x.UserId, x => x.Id, (userRole, user) => new { user.Id, user.StoreId })
            .Where(x => x.StoreId == null)
            .Select(x => x.Id)
            .Distinct()
            .CountAsync(ct).ConfigureAwait(false);

        var tenantsWithoutCatalogTemplate = await _db.Tenants.AsNoTracking()
            .GroupJoin(_db.TenantCatalogTemplates.AsNoTracking(), t => t.Id, tt => tt.TenantId, (tenant, mappings) => new { tenant.Id, mappings })
            .CountAsync(x => !x.mappings.Any(y => y.CatalogTemplateId.HasValue), ct).ConfigureAwait(false);

        var storesWithoutAdminStore = await _db.Stores.AsNoTracking()
            .GroupJoin(_db.Users.AsNoTracking(), s => s.Id, u => u.StoreId, (store, users) => new { store.Id, Users = users })
            .CountAsync(x => !x.Users.Any(), ct).ConfigureAwait(false);

        var salesToday = await _db.Sales.AsNoTracking()
            .Where(x => x.Status == SaleStatus.Completed && x.OccurredAtUtc >= todayFrom && x.OccurredAtUtc <= todayTo)
            .GroupBy(_ => 1)
            .Select(x => new { Count = x.Count(), Amount = x.Sum(y => y.Total) })
            .FirstOrDefaultAsync(ct).ConfigureAwait(false);

        var salesLast7 = await _db.Sales.AsNoTracking()
            .Where(x => x.Status == SaleStatus.Completed && x.OccurredAtUtc >= last7From && x.OccurredAtUtc <= todayTo)
            .GroupBy(_ => 1)
            .Select(x => new { Count = x.Count(), Amount = x.Sum(y => y.Total) })
            .FirstOrDefaultAsync(ct).ConfigureAwait(false);

        var openShiftsCount = await _db.PosShifts.AsNoTracking().CountAsync(x => x.ClosedAtUtc == null, ct).ConfigureAwait(false);

        var outOfStockItemsCount = await _db.CatalogInventoryBalances.AsNoTracking()
            .CountAsync(x => x.OnHandQty <= 0m, ct).ConfigureAwait(false);

        var lowStockItemsCount = await _db.CatalogInventoryBalances.AsNoTracking()
            .CountAsync(x => x.OnHandQty > 0m && x.OnHandQty <= normalizedThreshold, ct).ConfigureAwait(false);

        return new PlatformDashboardSummaryDto(
            activeTenants,
            inactiveTenants,
            activeStores,
            inactiveStores,
            totalUsers,
            usersWithoutStoreAssignment,
            tenantsWithoutCatalogTemplate,
            storesWithoutAdminStore,
            salesToday?.Count ?? 0,
            salesToday?.Amount ?? 0m,
            salesLast7?.Count ?? 0,
            salesLast7?.Amount ?? 0m,
            openShiftsCount,
            outOfStockItemsCount,
            lowStockItemsCount,
            todayFrom,
            todayTo,
            normalizedThreshold);
    }

    public async Task<PlatformTopTenantsResponseDto> GetTopTenantsAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, int top, bool includeInactive, CancellationToken ct)
    {
        var normalizedTop = Math.Clamp(top <= 0 ? 10 : top, 1, 50);
        var (effectiveFrom, effectiveTo) = ResolveRange(dateFrom, dateTo, 7);

        var tenantRows = await (
            from tenant in _db.Tenants.AsNoTracking()
            where includeInactive || tenant.IsActive
            join vertical in _db.Verticals.AsNoTracking() on tenant.VerticalId equals vertical.Id into verticalJoin
            from vertical in verticalJoin.DefaultIfEmpty()
            join store in _db.Stores.AsNoTracking() on tenant.Id equals store.TenantId into storeJoin
            select new
            {
                tenant.Id,
                tenant.Name,
                tenant.VerticalId,
                VerticalName = vertical != null ? vertical.Name : null,
                StoreCount = storeJoin.Count()
            })
            .ToListAsync(ct).ConfigureAwait(false);

        var salesByTenant = await _db.Sales.AsNoTracking()
            .Where(s => s.OccurredAtUtc >= effectiveFrom && s.OccurredAtUtc <= effectiveTo)
            .GroupBy(s => s.TenantId)
            .Select(g => new
            {
                TenantId = g.Key,
                SalesCount = g.Count(s => s.Status == SaleStatus.Completed),
                SalesAmount = g.Where(s => s.Status == SaleStatus.Completed).Sum(s => (decimal?)s.Total) ?? 0m,
                VoidsCount = g.Count(s => s.Status == SaleStatus.Void)
            })
            .ToDictionaryAsync(x => x.TenantId, ct).ConfigureAwait(false);

        var rows = tenantRows.Select(x =>
        {
            var sales = salesByTenant.GetValueOrDefault(x.Id);
            return new PlatformTopTenantRowDto(
                x.Id,
                x.Name,
                x.VerticalId,
                x.VerticalName,
                x.StoreCount,
                sales?.SalesCount ?? 0,
                sales?.SalesAmount ?? 0m,
                0m,
                sales?.VoidsCount ?? 0);
        }).ToList();

        var sorted = rows
            .Select(x => x with { AverageTicket = x.SalesCount > 0 ? decimal.Round(x.SalesAmount / x.SalesCount, 2) : 0m })
            .OrderByDescending(x => x.SalesAmount)
            .ThenBy(x => x.TenantName)
            .Take(normalizedTop)
            .ToList();

        return new PlatformTopTenantsResponseDto(sorted, effectiveFrom, effectiveTo, normalizedTop, includeInactive);
    }

    public async Task<PlatformDashboardAlertsResponseDto> GetAlertsAsync(CancellationToken ct)
    {
        var alerts = new List<PlatformDashboardAlertDto>();

        var tenantWithoutTemplateQuery = _db.Tenants.AsNoTracking()
            .Where(t => !_db.TenantCatalogTemplates.Any(tt => tt.TenantId == t.Id && tt.CatalogTemplateId.HasValue));
        var tenantWithoutTemplateExamples = await tenantWithoutTemplateQuery
            .OrderBy(x => x.Name)
            .Select(x => x.Name)
            .Take(3)
            .ToListAsync(ct).ConfigureAwait(false);
        if (tenantWithoutTemplateExamples.Count > 0)
        {
            var total = await tenantWithoutTemplateQuery.CountAsync(ct).ConfigureAwait(false);
            alerts.Add(new PlatformDashboardAlertDto("TENANT_WITHOUT_TEMPLATE", "high", total, "Tenants without catalog template assignment.", tenantWithoutTemplateExamples));
        }

        var storesWithoutAdminExamples = await _db.Stores.AsNoTracking()
            .Where(s => !_db.Users.Any(u => u.StoreId == s.Id))
            .OrderBy(x => x.Name)
            .Select(x => x.Name)
            .Take(3)
            .ToListAsync(ct).ConfigureAwait(false);
        if (storesWithoutAdminExamples.Count > 0)
        {
            var total = await _db.Stores.AsNoTracking().CountAsync(s => !_db.Users.Any(u => u.StoreId == s.Id), ct).ConfigureAwait(false);
            alerts.Add(new PlatformDashboardAlertDto("STORE_WITHOUT_ADMINSTORE", "high", total, "Stores without assigned users.", storesWithoutAdminExamples));
        }

        var storeScopedRoleIds = await _db.Roles.AsNoTracking()
            .Where(x => x.Name == "AdminStore" || x.Name == "Manager" || x.Name == "Cashier")
            .Select(x => x.Id)
            .ToListAsync(ct).ConfigureAwait(false);

        var usersMissingStore = await _db.UserRoles.AsNoTracking()
            .Where(x => storeScopedRoleIds.Contains(x.RoleId))
            .Join(_db.Users.AsNoTracking(), ur => ur.UserId, u => u.Id, (ur, u) => new { u.Email, u.StoreId })
            .Where(x => x.StoreId == null)
            .Select(x => x.Email ?? string.Empty)
            .Distinct()
            .Take(3)
            .ToListAsync(ct).ConfigureAwait(false);
        if (usersMissingStore.Count > 0)
        {
            var total = await _db.UserRoles.AsNoTracking()
                .Where(x => storeScopedRoleIds.Contains(x.RoleId))
                .Join(_db.Users.AsNoTracking(), ur => ur.UserId, u => u.Id, (ur, u) => new { u.Id, u.StoreId })
                .Where(x => x.StoreId == null)
                .Select(x => x.Id)
                .Distinct()
                .CountAsync(ct).ConfigureAwait(false);
            alerts.Add(new PlatformDashboardAlertDto("STORE_SCOPED_USER_WITHOUT_STORE", "high", total, "Store scoped users without StoreId.", usersMissingStore));
        }

        return new PlatformDashboardAlertsResponseDto(alerts);
    }

    public async Task<PlatformDashboardAlertDrilldownResponseDto> GetAlertsDrilldownAsync(string code, int take, Guid? tenantId, Guid? storeId, CancellationToken ct)
    {
        var normalizedCode = code.Trim().ToUpperInvariant();
        var normalizedTake = Math.Clamp(take <= 0 ? 100 : take, 1, 500);

        if (normalizedCode == "TENANT_WITHOUT_TEMPLATE")
        {
            var query = from tenant in _db.Tenants.AsNoTracking()
                        join mapping in _db.TenantCatalogTemplates.AsNoTracking() on tenant.Id equals mapping.TenantId into mappings
                        where !mappings.Any(x => x.CatalogTemplateId.HasValue)
                        select tenant;

            if (tenantId.HasValue)
            {
                query = query.Where(x => x.Id == tenantId.Value);
            }

            var items = await query.OrderBy(x => x.Name).Take(normalizedTake)
                .Select(x => new PlatformDashboardAlertDrilldownItemDto(
                    x.Id,
                    x.Name,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    "Tenant does not have catalog template assignment.",
                    "MissingCatalogTemplate",
                    null))
                .ToListAsync(ct).ConfigureAwait(false);

            return new PlatformDashboardAlertDrilldownResponseDto(normalizedCode, items);
        }

        if (normalizedCode == "STORE_WITHOUT_ADMINSTORE")
        {
            var stores = _db.Stores.AsNoTracking().AsQueryable();
            if (tenantId.HasValue)
            {
                stores = stores.Where(x => x.TenantId == tenantId.Value);
            }

            if (storeId.HasValue)
            {
                stores = stores.Where(x => x.Id == storeId.Value);
            }

            var usersByStore = await _db.Users.AsNoTracking()
                .Where(x => x.StoreId != null)
                .GroupBy(x => x.StoreId!.Value)
                .Select(x => new { StoreId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct).ConfigureAwait(false);
            var tenantMap = await _db.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);

            var items = await stores.OrderBy(x => x.Name).Take(normalizedTake).ToListAsync(ct).ConfigureAwait(false);
            var result = items
                .Where(x => !usersByStore.ContainsKey(x.Id))
                .Select(x => new PlatformDashboardAlertDrilldownItemDto(
                    x.TenantId,
                    tenantMap.GetValueOrDefault(x.TenantId, "Unknown"),
                    x.Id,
                    x.Name,
                    null,
                    null,
                    null,
                    "AdminStore",
                    "Store has no assigned users.",
                    "MissingAdminStore",
                    null))
                .ToList();

            return new PlatformDashboardAlertDrilldownResponseDto(normalizedCode, result);
        }

        if (normalizedCode == "STORE_SCOPED_USER_WITHOUT_STORE")
        {
            var roleIds = await _db.Roles.AsNoTracking()
                .Where(x => x.Name == "AdminStore" || x.Name == "Manager" || x.Name == "Cashier")
                .Select(x => x.Id)
                .ToListAsync(ct).ConfigureAwait(false);

            var query = _db.UserRoles.AsNoTracking()
                .Where(x => roleIds.Contains(x.RoleId))
                .Join(_db.Users.AsNoTracking(), ur => ur.UserId, u => u.Id, (ur, u) => new { ur.UserId, ur.RoleId, u.Email, u.UserName, u.TenantId, u.StoreId })
                .Where(x => x.StoreId == null);

            if (tenantId.HasValue)
            {
                query = query.Where(x => x.TenantId == tenantId.Value);
            }

            var roleMap = await _db.Roles.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);
            var tenantMap = await _db.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);

            var users = await query.OrderBy(x => x.Email).Take(normalizedTake).ToListAsync(ct).ConfigureAwait(false);
            var items = users.Select(x => new PlatformDashboardAlertDrilldownItemDto(
                    x.TenantId,
                    x.TenantId.HasValue ? tenantMap.GetValueOrDefault(x.TenantId.Value, "Unknown") : null,
                    null,
                    null,
                    x.UserId,
                    x.UserName,
                    x.Email,
                    roleMap.GetValueOrDefault(x.RoleId, "Unknown"),
                    "Store scoped user does not have StoreId assigned.",
                    "MissingStoreAssignment",
                    null))
                .ToList();

            return new PlatformDashboardAlertDrilldownResponseDto(normalizedCode, items);
        }

        throw new ArgumentException($"Unsupported alert code '{code}'.", nameof(code));
    }

    public async Task<PlatformTenantOverviewDto> GetTenantOverviewAsync(Guid tenantId, DateTimeOffset? dateFrom, DateTimeOffset? dateTo, decimal threshold, CancellationToken ct)
    {
        var tenant = await (from t in _db.Tenants.AsNoTracking()
                            join v in _db.Verticals.AsNoTracking() on t.VerticalId equals v.Id into verticalJoin
                            from v in verticalJoin.DefaultIfEmpty()
                            where t.Id == tenantId
                            select new { t.Id, t.Name, t.VerticalId, VerticalName = v != null ? v.Name : null })
            .FirstOrDefaultAsync(ct).ConfigureAwait(false) ?? throw new KeyNotFoundException($"Tenant '{tenantId}' was not found.");

        var (effectiveFrom, effectiveTo) = ResolveRange(dateFrom, dateTo, 7);
        var normalizedThreshold = threshold > 0m ? threshold : DefaultLowStockThreshold;

        var stores = _db.Stores.AsNoTracking().Where(x => x.TenantId == tenantId);
        var storeIds = await stores.Select(x => x.Id).ToListAsync(ct).ConfigureAwait(false);
        var storeCount = storeIds.Count;
        var activeStoreCount = await stores.CountAsync(x => x.IsActive, ct).ConfigureAwait(false);

        var totalUsers = await _db.Users.AsNoTracking().CountAsync(x => x.TenantId == tenantId, ct).ConfigureAwait(false);

        var storeScopedRoleIds = await _db.Roles.AsNoTracking()
            .Where(x => x.Name == "AdminStore" || x.Name == "Manager" || x.Name == "Cashier")
            .Select(x => x.Id)
            .ToListAsync(ct).ConfigureAwait(false);

        var usersWithoutStoreAssignmentCount = await _db.UserRoles.AsNoTracking()
            .Where(x => storeScopedRoleIds.Contains(x.RoleId))
            .Join(_db.Users.AsNoTracking(), ur => ur.UserId, u => u.Id, (ur, u) => new { u.Id, u.TenantId, u.StoreId })
            .Where(x => x.TenantId == tenantId && x.StoreId == null)
            .Select(x => x.Id)
            .Distinct()
            .CountAsync(ct).ConfigureAwait(false);

        var salesInRange = await _db.Sales.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == SaleStatus.Completed && x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Amount = g.Sum(x => x.Total) })
            .FirstOrDefaultAsync(ct).ConfigureAwait(false);

        var voidedSalesCount = await _db.Sales.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.Status == SaleStatus.Void && x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo, ct).ConfigureAwait(false);

        var outOfStockItemsCount = await _db.CatalogInventoryBalances.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.OnHandQty <= 0m, ct).ConfigureAwait(false);

        var lowStockItemsCount = await _db.CatalogInventoryBalances.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.OnHandQty > 0m && x.OnHandQty <= normalizedThreshold, ct).ConfigureAwait(false);

        var lastInventoryAdjustmentAtUtc = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .MaxAsync(x => (DateTimeOffset?)x.CreatedAtUtc, ct).ConfigureAwait(false);

        var hasCatalogTemplate = await _db.TenantCatalogTemplates.AsNoTracking()
            .AnyAsync(x => x.TenantId == tenantId && x.CatalogTemplateId.HasValue, ct).ConfigureAwait(false);

        var storesWithoutAdminStoreCount = await _db.Stores.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .GroupJoin(_db.Users.AsNoTracking(), s => s.Id, u => u.StoreId, (store, users) => new { users })
            .CountAsync(x => !x.users.Any(), ct).ConfigureAwait(false);

        return new PlatformTenantOverviewDto(
            tenant.Id,
            tenant.Name,
            tenant.VerticalId,
            tenant.VerticalName,
            storeCount,
            activeStoreCount,
            totalUsers,
            usersWithoutStoreAssignmentCount,
            salesInRange?.Count ?? 0,
            salesInRange?.Amount ?? 0m,
            voidedSalesCount,
            outOfStockItemsCount,
            lowStockItemsCount,
            lastInventoryAdjustmentAtUtc,
            hasCatalogTemplate,
            storesWithoutAdminStoreCount,
            effectiveFrom,
            effectiveTo,
            normalizedThreshold);
    }

    public async Task<PlatformStoreStockoutDetailDto> GetStoreStockoutDetailsAsync(Guid storeId, string? itemType, string? search, decimal threshold, string? mode, int take, CancellationToken ct)
    {
        var parsedItemType = ParseItemType(itemType);
        var normalizedThreshold = threshold > 0m ? threshold : DefaultLowStockThreshold;
        var normalizedMode = NormalizeStockoutMode(mode);
        var normalizedTake = Math.Clamp(take <= 0 ? 200 : take, 1, 500);

        var store = await _db.Stores.AsNoTracking().FirstOrDefaultAsync(x => x.Id == storeId, ct).ConfigureAwait(false)
            ?? throw new KeyNotFoundException($"Store '{storeId}' was not found.");
        var tenantName = await _db.Tenants.AsNoTracking().Where(x => x.Id == store.TenantId).Select(x => x.Name).FirstOrDefaultAsync(ct).ConfigureAwait(false) ?? "Unknown";

        var balancesQuery = _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.StoreId == storeId);
        if (parsedItemType.HasValue)
        {
            balancesQuery = balancesQuery.Where(x => x.ItemType == parsedItemType.Value);
        }

        balancesQuery = normalizedMode switch
        {
            "low-stock" => balancesQuery.Where(x => x.OnHandQty > 0m && x.OnHandQty <= normalizedThreshold),
            "all" => balancesQuery.Where(x => x.OnHandQty <= normalizedThreshold),
            _ => balancesQuery.Where(x => x.OnHandQty <= 0m)
        };

        var balances = await balancesQuery.OrderBy(x => x.OnHandQty).Take(normalizedTake).ToListAsync(ct).ConfigureAwait(false);
        var productIds = balances.Where(x => x.ItemType == CatalogItemType.Product).Select(x => x.ItemId).Distinct().ToList();
        var extraIds = balances.Where(x => x.ItemType == CatalogItemType.Extra).Select(x => x.ItemId).Distinct().ToList();

        var products = await _db.Products.AsNoTracking().Where(x => productIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => new { x.Name, x.ExternalCode, x.IsInventoryTracked }, ct).ConfigureAwait(false);
        var extras = await _db.Extras.AsNoTracking().Where(x => extraIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => new { x.Name, x.IsInventoryTracked }, ct).ConfigureAwait(false);
        var lastAdjustments = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .Where(x => x.StoreId == storeId)
            .GroupBy(x => new { x.ItemType, x.ItemId })
            .Select(x => new { x.Key.ItemType, x.Key.ItemId, LastAdjustmentAtUtc = x.Max(y => y.CreatedAtUtc) })
            .ToDictionaryAsync(x => (x.ItemType, x.ItemId), x => (DateTimeOffset?)x.LastAdjustmentAtUtc, ct).ConfigureAwait(false);

        var items = balances.Select(x =>
        {
            var itemName = "Unknown";
            string? itemSku = null;
            var isTracked = true;
            if (x.ItemType == CatalogItemType.Product && products.TryGetValue(x.ItemId, out var product))
            {
                itemName = product.Name;
                itemSku = product.ExternalCode;
                isTracked = product.IsInventoryTracked;
            }

            if (x.ItemType == CatalogItemType.Extra && extras.TryGetValue(x.ItemId, out var extra))
            {
                itemName = extra.Name;
                isTracked = extra.IsInventoryTracked;
            }

            var reason = x.OnHandQty <= 0m ? "OutOfStock" : (x.OnHandQty <= normalizedThreshold ? "LowStock" : "InStock");

            return new PlatformStoreStockoutDetailItemDto(
                x.ItemType.ToString(),
                x.ItemId,
                itemName,
                itemSku,
                x.OnHandQty,
                isTracked,
                reason,
                lastAdjustments.GetValueOrDefault((x.ItemType, x.ItemId)));
        }).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            items = items.Where(x => x.ItemName.Contains(search, StringComparison.OrdinalIgnoreCase) || (x.ItemSku?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        return new PlatformStoreStockoutDetailDto(store.Id, store.Name, store.TenantId, tenantName, normalizedMode, normalizedThreshold, items);
    }

    public async Task<PlatformRecentInventoryAdjustmentsResponseDto> GetRecentInventoryAdjustmentsAsync(int take, string? reason, Guid? tenantId, Guid? storeId, CancellationToken ct)
    {
        var normalizedTake = Math.Clamp(take <= 0 ? 20 : take, 1, 100);
        var query = _db.CatalogInventoryAdjustments.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(reason))
        {
            query = query.Where(x => x.Reason == reason);
        }

        if (tenantId.HasValue)
        {
            query = query.Where(x => x.TenantId == tenantId.Value);
        }

        if (storeId.HasValue)
        {
            query = query.Where(x => x.StoreId == storeId.Value);
        }

        var adjustments = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(normalizedTake)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.StoreId,
                ItemType = x.ItemType.ToString(),
                x.ItemId,
                x.QtyBefore,
                x.DeltaQty,
                QtyAfter = x.ResultingOnHandQty,
                x.Reason,
                x.ReferenceType,
                x.ReferenceId,
                x.MovementKind,
                x.CreatedAtUtc,
                PerformedByUserId = x.CreatedByUserId
            })
            .ToListAsync(ct).ConfigureAwait(false);

        var tenantMap = await _db.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);
        var storeMap = await _db.Stores.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);

        var productIds = adjustments.Where(x => x.ItemType == nameof(CatalogItemType.Product)).Select(x => x.ItemId).Distinct().ToList();
        var extraIds = adjustments.Where(x => x.ItemType == nameof(CatalogItemType.Extra)).Select(x => x.ItemId).Distinct().ToList();

        var products = await _db.Products.AsNoTracking().Where(x => productIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => new { x.Name, x.ExternalCode }, ct).ConfigureAwait(false);
        var extras = await _db.Extras.AsNoTracking().Where(x => extraIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);

        var rows = adjustments.Select(x =>
        {
            var referenceId = Guid.TryParse(x.ReferenceId, out var parsed) ? parsed : (Guid?)null;
            var itemName = x.ItemType == nameof(CatalogItemType.Product)
                ? products.GetValueOrDefault(x.ItemId)?.Name ?? "Unknown"
                : extras.GetValueOrDefault(x.ItemId) ?? "Unknown";
            var itemSku = x.ItemType == nameof(CatalogItemType.Product)
                ? products.GetValueOrDefault(x.ItemId)?.ExternalCode
                : null;

            return new PlatformRecentInventoryAdjustmentDto(
                x.Id,
                x.TenantId,
                tenantMap.GetValueOrDefault(x.TenantId, "Unknown"),
                x.StoreId,
                storeMap.GetValueOrDefault(x.StoreId, "Unknown"),
                x.ItemType,
                x.ItemId,
                itemName,
                itemSku,
                x.QtyBefore,
                x.DeltaQty,
                x.QtyAfter,
                x.Reason,
                x.ReferenceType,
                referenceId,
                x.MovementKind,
                x.CreatedAtUtc,
                x.PerformedByUserId);
        }).ToList();

        return new PlatformRecentInventoryAdjustmentsResponseDto(rows, normalizedTake);
    }

    public async Task<PlatformOutOfStockResponseDto> GetOutOfStockAsync(Guid? tenantId, Guid? storeId, string? itemType, string? search, bool onlyTracked, int top, CancellationToken ct)
    {
        var normalizedTop = Math.Clamp(top <= 0 ? 50 : top, 1, 200);
        CatalogItemType? parsedItemType = ParseItemType(itemType);

        var query = _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.OnHandQty <= 0m);
        if (tenantId.HasValue)
        {
            query = query.Where(x => x.TenantId == tenantId.Value);
        }

        if (storeId.HasValue)
        {
            query = query.Where(x => x.StoreId == storeId.Value);
        }

        if (parsedItemType.HasValue)
        {
            query = query.Where(x => x.ItemType == parsedItemType.Value);
        }

        var balances = await query.OrderBy(x => x.UpdatedAtUtc).Take(normalizedTop).ToListAsync(ct).ConfigureAwait(false);
        var productIds = balances.Where(x => x.ItemType == CatalogItemType.Product).Select(x => x.ItemId).Distinct().ToList();
        var extraIds = balances.Where(x => x.ItemType == CatalogItemType.Extra).Select(x => x.ItemId).Distinct().ToList();

        var products = await _db.Products.AsNoTracking().Where(x => productIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => new { x.Name, x.ExternalCode, x.IsInventoryTracked }, ct).ConfigureAwait(false);
        var extras = await _db.Extras.AsNoTracking().Where(x => extraIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => new { x.Name, x.IsInventoryTracked }, ct).ConfigureAwait(false);

        var tenantMap = await _db.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);
        var storeMap = await _db.Stores.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);
        var lastAdjustments = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .GroupBy(x => new { x.TenantId, x.StoreId, x.ItemType, x.ItemId })
            .Select(x => new { x.Key.TenantId, x.Key.StoreId, x.Key.ItemType, x.Key.ItemId, LastAdjustmentAtUtc = x.Max(y => y.CreatedAtUtc) })
            .ToDictionaryAsync(x => (x.TenantId, x.StoreId, x.ItemType, x.ItemId), x => (DateTimeOffset?)x.LastAdjustmentAtUtc, ct).ConfigureAwait(false);

        var rows = balances.Select(x =>
        {
            var itemName = "Unknown";
            string? itemSku = null;
            var tracked = true;
            if (x.ItemType == CatalogItemType.Product && products.TryGetValue(x.ItemId, out var product))
            {
                itemName = product.Name;
                itemSku = product.ExternalCode;
                tracked = product.IsInventoryTracked;
            }

            if (x.ItemType == CatalogItemType.Extra && extras.TryGetValue(x.ItemId, out var extra))
            {
                itemName = extra.Name;
                tracked = extra.IsInventoryTracked;
            }

            return new { Row = new PlatformOutOfStockRowDto(x.TenantId, tenantMap.GetValueOrDefault(x.TenantId, "Unknown"), x.StoreId, storeMap.GetValueOrDefault(x.StoreId, "Unknown"), x.ItemType.ToString(), x.ItemId, itemName, itemSku, x.OnHandQty, x.UpdatedAtUtc, lastAdjustments.GetValueOrDefault((x.TenantId, x.StoreId, x.ItemType, x.ItemId))), Tracked = tracked };
        });

        if (onlyTracked)
        {
            rows = rows.Where(x => x.Tracked);
        }

        var materialized = rows.Select(x => x.Row).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            materialized = materialized.Where(x => x.ItemName.Contains(search, StringComparison.OrdinalIgnoreCase) || (x.ItemSku?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        return new PlatformOutOfStockResponseDto(materialized);
    }

    public async Task<PlatformSalesTrendResponseDto> GetSalesTrendAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? granularity, CancellationToken ct)
    {
        var normalizedGranularity = NormalizeGranularity(granularity);
        var (effectiveFrom, effectiveTo) = ResolveRange(dateFrom, dateTo, 14);
        var sales = await _db.Sales.AsNoTracking()
            .Where(x => x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo)
            .Select(x => new { x.OccurredAtUtc, x.Total, x.Status })
            .ToListAsync(ct).ConfigureAwait(false);

        var grouped = sales.GroupBy(x => BucketStart(x.OccurredAtUtc, normalizedGranularity))
            .ToDictionary(
                g => g.Key,
                g => new PlatformSalesTrendPointDto(
                    g.Key,
                    BuildBucketLabel(g.Key, normalizedGranularity),
                    g.Count(x => x.Status == SaleStatus.Completed),
                    g.Where(x => x.Status == SaleStatus.Completed).Sum(x => x.Total),
                    g.Count(x => x.Status == SaleStatus.Void),
                    0m));

        var cursor = BucketStart(effectiveFrom, normalizedGranularity);
        var end = BucketStart(effectiveTo, normalizedGranularity);
        var points = new List<PlatformSalesTrendPointDto>();
        while (cursor <= end)
        {
            if (grouped.TryGetValue(cursor, out var existing))
            {
                var avg = existing.SalesCount > 0 ? decimal.Round(existing.SalesAmount / existing.SalesCount, 2) : 0m;
                points.Add(existing with { AverageTicket = avg });
            }
            else
            {
                points.Add(new PlatformSalesTrendPointDto(cursor, BuildBucketLabel(cursor, normalizedGranularity), 0, 0m, 0, 0m));
            }

            cursor = normalizedGranularity == "week" ? cursor.AddDays(7) : cursor.AddDays(1);
        }

        return new PlatformSalesTrendResponseDto(points, effectiveFrom, effectiveTo, normalizedGranularity);
    }

    public async Task<PlatformTopVoidTenantsResponseDto> GetTopVoidTenantsAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, int top, CancellationToken ct)
    {
        var normalizedTop = Math.Clamp(top <= 0 ? 10 : top, 1, 50);
        var (effectiveFrom, effectiveTo) = ResolveRange(dateFrom, dateTo, 14);

        var tenantRows = await (
            from tenant in _db.Tenants.AsNoTracking()
            join vertical in _db.Verticals.AsNoTracking() on tenant.VerticalId equals vertical.Id into verticalJoin
            from vertical in verticalJoin.DefaultIfEmpty()
            join store in _db.Stores.AsNoTracking() on tenant.Id equals store.TenantId into storeJoin
            select new { tenant.Id, tenant.Name, tenant.VerticalId, VerticalName = vertical != null ? vertical.Name : null, StoreCount = storeJoin.Count() })
            .ToDictionaryAsync(x => x.Id, ct).ConfigureAwait(false);

        var sales = await _db.Sales.AsNoTracking()
            .Where(x => x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo)
            .GroupBy(x => x.TenantId)
            .Select(g => new
            {
                TenantId = g.Key,
                VoidedSalesCount = g.Count(x => x.Status == SaleStatus.Void),
                VoidedSalesAmount = g.Where(x => x.Status == SaleStatus.Void).Sum(x => (decimal?)x.Total) ?? 0m,
                TotalSalesCount = g.Count()
            })
            .ToListAsync(ct).ConfigureAwait(false);

        var rows = sales.Select(x =>
        {
            var tenant = tenantRows.GetValueOrDefault(x.TenantId);
            var voidRate = x.TotalSalesCount > 0 ? decimal.Round((decimal)x.VoidedSalesCount / x.TotalSalesCount, 4) : 0m;
            return new PlatformTopVoidTenantRowDto(x.TenantId, tenant?.Name ?? "Unknown", tenant?.VerticalId ?? Guid.Empty, tenant?.VerticalName, x.VoidedSalesCount, x.VoidedSalesAmount, x.TotalSalesCount, voidRate, tenant?.StoreCount ?? 0);
        })
        .OrderByDescending(x => x.VoidedSalesCount)
        .ThenByDescending(x => x.VoidedSalesAmount)
        .ThenBy(x => x.TenantName)
        .Take(normalizedTop)
        .ToList();

        return new PlatformTopVoidTenantsResponseDto(rows, effectiveFrom, effectiveTo, normalizedTop);
    }

    public async Task<PlatformStockoutHotspotsResponseDto> GetStockoutHotspotsAsync(decimal threshold, int top, string? itemType, CancellationToken ct)
    {
        var normalizedTop = Math.Clamp(top <= 0 ? 10 : top, 1, 100);
        var normalizedThreshold = threshold > 0m ? threshold : DefaultLowStockThreshold;
        var parsedItemType = ParseItemType(itemType);

        var query = _db.CatalogInventoryBalances.AsNoTracking().AsQueryable();
        if (parsedItemType.HasValue)
        {
            query = query.Where(x => x.ItemType == parsedItemType.Value);
        }

        var balances = await query
            .Where(x => x.OnHandQty <= normalizedThreshold)
            .Select(x => new { x.TenantId, x.StoreId, x.ItemType, x.ItemId, x.OnHandQty })
            .ToListAsync(ct).ConfigureAwait(false);

        var trackedProductIds = await _db.Products.AsNoTracking().Where(x => x.IsInventoryTracked).Select(x => x.Id).ToListAsync(ct).ConfigureAwait(false);
        var trackedExtraIds = await _db.Extras.AsNoTracking().Where(x => x.IsInventoryTracked).Select(x => x.Id).ToListAsync(ct).ConfigureAwait(false);
        var trackedProducts = trackedProductIds.ToHashSet();
        var trackedExtras = trackedExtraIds.ToHashSet();

        var byStore = balances.GroupBy(x => new { x.TenantId, x.StoreId })
            .Select(g => new
            {
                g.Key.TenantId,
                g.Key.StoreId,
                OutOfStockItemsCount = g.Count(x => x.OnHandQty <= 0m),
                LowStockItemsCount = g.Count(x => x.OnHandQty > 0m && x.OnHandQty <= normalizedThreshold),
                TrackedItemsCount = g.Count(x => (x.ItemType == CatalogItemType.Product && trackedProducts.Contains(x.ItemId)) || (x.ItemType == CatalogItemType.Extra && trackedExtras.Contains(x.ItemId)))
            })
            .Where(x => x.OutOfStockItemsCount > 0 || x.LowStockItemsCount > 0)
            .ToList();

        var lastMovements = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .GroupBy(x => new { x.TenantId, x.StoreId })
            .Select(x => new { x.Key.TenantId, x.Key.StoreId, LastInventoryMovementAtUtc = x.Max(y => y.CreatedAtUtc) })
            .ToDictionaryAsync(x => (x.TenantId, x.StoreId), x => (DateTimeOffset?)x.LastInventoryMovementAtUtc, ct).ConfigureAwait(false);

        var tenantMap = await _db.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);
        var storeMap = await _db.Stores.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);

        var rows = byStore
            .Select(x => new PlatformStockoutHotspotRowDto(
                x.TenantId,
                tenantMap.GetValueOrDefault(x.TenantId, "Unknown"),
                x.StoreId,
                storeMap.GetValueOrDefault(x.StoreId, "Unknown"),
                x.OutOfStockItemsCount,
                x.LowStockItemsCount,
                lastMovements.GetValueOrDefault((x.TenantId, x.StoreId)),
                x.TrackedItemsCount))
            .OrderByDescending(x => x.OutOfStockItemsCount)
            .ThenByDescending(x => x.LowStockItemsCount)
            .ThenBy(x => x.TenantName)
            .Take(normalizedTop)
            .ToList();

        return new PlatformStockoutHotspotsResponseDto(rows, normalizedThreshold, normalizedTop, parsedItemType?.ToString());
    }

    public async Task<PlatformActivityFeedResponseDto> GetActivityFeedAsync(int take, string? eventType, CancellationToken ct)
    {
        var normalizedTake = Math.Clamp(take <= 0 ? 20 : take, 1, 100);
        var normalizedType = string.IsNullOrWhiteSpace(eventType) ? null : eventType.Trim();

        var tenantMap = await _db.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);
        var storeMap = await _db.Stores.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);

        var items = new List<PlatformActivityFeedItemDto>();
        if (normalizedType is null or "SaleCreated")
        {
            var sales = await _db.Sales.AsNoTracking()
                .Where(x => x.Status == SaleStatus.Completed)
                .OrderByDescending(x => x.OccurredAtUtc)
                .Take(normalizedTake)
                .Select(x => new { x.Id, x.OccurredAtUtc, x.TenantId, x.StoreId, x.Total, x.CreatedByUserId })
                .ToListAsync(ct).ConfigureAwait(false);
            items.AddRange(sales.Select(x => new PlatformActivityFeedItemDto("SaleCreated", x.OccurredAtUtc, x.TenantId, tenantMap.GetValueOrDefault(x.TenantId, "Unknown"), x.StoreId, storeMap.GetValueOrDefault(x.StoreId, "Unknown"), "Sale created", $"Sale total {x.Total.ToString("0.00", CultureInfo.InvariantCulture)}", x.Id, "info", x.CreatedByUserId)));
        }

        if (normalizedType is null or "SaleVoided")
        {
            var sales = await _db.Sales.AsNoTracking()
                .Where(x => x.Status == SaleStatus.Void)
                .OrderByDescending(x => x.VoidedAtUtc ?? x.OccurredAtUtc)
                .Take(normalizedTake)
                .Select(x => new { x.Id, OccurredAt = x.VoidedAtUtc ?? x.OccurredAtUtc, x.TenantId, x.StoreId, x.Total, x.VoidedByUserId })
                .ToListAsync(ct).ConfigureAwait(false);
            items.AddRange(sales.Select(x => new PlatformActivityFeedItemDto("SaleVoided", x.OccurredAt, x.TenantId, tenantMap.GetValueOrDefault(x.TenantId, "Unknown"), x.StoreId, storeMap.GetValueOrDefault(x.StoreId, "Unknown"), "Sale voided", $"Voided total {x.Total.ToString("0.00", CultureInfo.InvariantCulture)}", x.Id, "warning", x.VoidedByUserId)));
        }

        if (normalizedType is null or "InventoryAdjusted")
        {
            var adjustments = await _db.CatalogInventoryAdjustments.AsNoTracking()
                .OrderByDescending(x => x.CreatedAtUtc)
                .Take(normalizedTake)
                .Select(x => new { x.Id, x.CreatedAtUtc, x.TenantId, x.StoreId, x.DeltaQty, x.Reason, x.CreatedByUserId })
                .ToListAsync(ct).ConfigureAwait(false);
            items.AddRange(adjustments.Select(x => new PlatformActivityFeedItemDto("InventoryAdjusted", x.CreatedAtUtc, x.TenantId, tenantMap.GetValueOrDefault(x.TenantId, "Unknown"), x.StoreId, storeMap.GetValueOrDefault(x.StoreId, "Unknown"), "Inventory adjusted", $"Reason {x.Reason}, delta {x.DeltaQty.ToString("0.##", CultureInfo.InvariantCulture)}", x.Id, "info", x.CreatedByUserId)));
        }

        return new PlatformActivityFeedResponseDto(items.OrderByDescending(x => x.OccurredAtUtc).Take(normalizedTake).ToList(), normalizedTake, normalizedType);
    }

    public async Task<PlatformExecutiveSignalsDto> GetExecutiveSignalsAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, bool previousPeriodCompare, CancellationToken ct)
    {
        var (effectiveFrom, effectiveTo) = ResolveRange(dateFrom, dateTo, 7);
        var periodDays = Math.Max(1, (int)Math.Ceiling((effectiveTo - effectiveFrom).TotalDays));
        var prevFrom = effectiveFrom.AddDays(-periodDays);
        var prevTo = effectiveFrom;

        var currentCompletedRaw = await _db.Sales.AsNoTracking()
            .Where(x => x.Status == SaleStatus.Completed && x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo)
            .Select(x => new { x.TenantId, x.Total })
            .ToListAsync(ct).ConfigureAwait(false);
        var currentCompleted = currentCompletedRaw.Select(x => (x.TenantId, x.Total)).ToList();

        var currentVoids = await _db.Sales.AsNoTracking()
            .CountAsync(x => x.Status == SaleStatus.Void && x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo, ct).ConfigureAwait(false);
        var currentTotalSales = await _db.Sales.AsNoTracking()
            .CountAsync(x => x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo, ct).ConfigureAwait(false);

        var previousCompleted = new List<(Guid TenantId, decimal Total)>();
        if (previousPeriodCompare)
        {
            var previousCompletedRaw = await _db.Sales.AsNoTracking()
                .Where(x => x.Status == SaleStatus.Completed && x.OccurredAtUtc >= prevFrom && x.OccurredAtUtc < prevTo)
                .Select(x => new { x.TenantId, x.Total })
                .ToListAsync(ct).ConfigureAwait(false);
            previousCompleted = previousCompletedRaw.Select(x => (x.TenantId, x.Total)).ToList();
        }

        var currentAmount = currentCompleted.Sum(x => x.Total);
        var previousAmount = previousCompleted.Sum(x => x.Total);
        decimal? growth = null;
        if (previousPeriodCompare)
        {
            growth = previousAmount <= 0m ? (currentAmount > 0m ? 100m : 0m) : decimal.Round(((currentAmount - previousAmount) / previousAmount) * 100m, 2);
        }

        var tenantSalesIds = currentCompleted.Select(x => x.TenantId).Distinct().ToHashSet();
        var tenantsWithNoSalesInRangeCount = await _db.Tenants.AsNoTracking().CountAsync(x => !tenantSalesIds.Contains(x.Id), ct).ConfigureAwait(false);

        var storesWithNoAdminStoreCount = await _db.Stores.AsNoTracking()
            .GroupJoin(_db.Users.AsNoTracking(), s => s.Id, u => u.StoreId, (store, users) => new { store.Id, Users = users })
            .CountAsync(x => !x.Users.Any(), ct).ConfigureAwait(false);

        var tenantsWithNoCatalogTemplateCount = await _db.Tenants.AsNoTracking()
            .GroupJoin(_db.TenantCatalogTemplates.AsNoTracking(), t => t.Id, tt => tt.TenantId, (tenant, mappings) => new { tenant.Id, mappings })
            .CountAsync(x => !x.mappings.Any(y => y.CatalogTemplateId.HasValue), ct).ConfigureAwait(false);

        var storesWithOutOfStockCount = await _db.CatalogInventoryBalances.AsNoTracking().Where(x => x.OnHandQty <= 0m).Select(x => x.StoreId).Distinct().CountAsync(ct).ConfigureAwait(false);

        var inventoryAdjustmentCountInRange = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .CountAsync(x => x.CreatedAtUtc >= effectiveFrom && x.CreatedAtUtc <= effectiveTo, ct).ConfigureAwait(false);

        var tenantMap = await _db.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct).ConfigureAwait(false);
        var currentByTenant = currentCompleted.GroupBy(x => x.TenantId).ToDictionary(x => x.Key, x => x.Sum(y => y.Total));
        var prevByTenant = previousCompleted.GroupBy(x => x.TenantId).ToDictionary(x => x.Key, x => x.Sum(y => y.Total));

        Guid? fastestId = null;
        string? fastestName = null;
        decimal bestGrowth = decimal.MinValue;
        if (previousPeriodCompare)
        {
            foreach (var row in currentByTenant)
            {
                var prev = prevByTenant.GetValueOrDefault(row.Key);
                var tenantGrowth = prev <= 0m ? (row.Value > 0m ? 100m : 0m) : ((row.Value - prev) / prev) * 100m;
                if (tenantGrowth > bestGrowth)
                {
                    bestGrowth = tenantGrowth;
                    fastestId = row.Key;
                    fastestName = tenantMap.GetValueOrDefault(row.Key, "Unknown");
                }
            }
        }

        var voidsByTenant = await _db.Sales.AsNoTracking()
            .Where(x => x.Status == SaleStatus.Void && x.OccurredAtUtc >= effectiveFrom && x.OccurredAtUtc <= effectiveTo)
            .GroupBy(x => x.TenantId)
            .Select(x => new { TenantId = x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct).ConfigureAwait(false);
        var outByTenant = await _db.CatalogInventoryBalances.AsNoTracking()
            .Where(x => x.OnHandQty <= 0m)
            .GroupBy(x => x.TenantId)
            .Select(x => new { TenantId = x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct).ConfigureAwait(false);

        var risk = tenantMap.Keys.Select(id => new { TenantId = id, Score = (voidsByTenant.GetValueOrDefault(id) * 2) + outByTenant.GetValueOrDefault(id) })
            .OrderByDescending(x => x.Score)
            .FirstOrDefault();

        return new PlatformExecutiveSignalsDto(
            fastestId,
            fastestName,
            growth,
            currentTotalSales > 0 ? decimal.Round((decimal)currentVoids / currentTotalSales * 100m, 2) : 0m,
            tenantsWithNoSalesInRangeCount,
            storesWithNoAdminStoreCount,
            tenantsWithNoCatalogTemplateCount,
            storesWithOutOfStockCount,
            inventoryAdjustmentCountInRange,
            risk?.Score > 0 ? risk.TenantId : null,
            risk?.Score > 0 ? tenantMap.GetValueOrDefault(risk.TenantId) : null,
            effectiveFrom,
            effectiveTo,
            previousPeriodCompare);
    }

    private static string NormalizeStockoutMode(string? mode)
    {
        if (string.Equals(mode, "low-stock", StringComparison.OrdinalIgnoreCase))
        {
            return "low-stock";
        }

        if (string.Equals(mode, "all", StringComparison.OrdinalIgnoreCase))
        {
            return "all";
        }

        return "out-of-stock";
    }

    private static CatalogItemType? ParseItemType(string? itemType)
    {
        if (!string.IsNullOrWhiteSpace(itemType) && Enum.TryParse<CatalogItemType>(itemType, true, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static (DateTimeOffset from, DateTimeOffset to) ResolveRange(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, int defaultDays)
    {
        if (dateFrom.HasValue && dateTo.HasValue)
        {
            return (dateFrom.Value, dateTo.Value);
        }

        var now = DateTimeOffset.UtcNow;
        return (now.AddDays(-(defaultDays - 1)).Date, now);
    }

    private static string NormalizeGranularity(string? granularity) => string.Equals(granularity, "week", StringComparison.OrdinalIgnoreCase) ? "week" : "day";

    private static DateTimeOffset BucketStart(DateTimeOffset date, string granularity)
    {
        var utcDate = date.UtcDateTime.Date;
        if (granularity == "week")
        {
            var shift = ((int)utcDate.DayOfWeek + 6) % 7;
            utcDate = utcDate.AddDays(-shift);
        }

        return new DateTimeOffset(utcDate, TimeSpan.Zero);
    }

    private static string BuildBucketLabel(DateTimeOffset bucketStartUtc, string granularity)
    {
        if (granularity == "week")
        {
            var week = ISOWeek.GetWeekOfYear(bucketStartUtc.UtcDateTime);
            return $"{bucketStartUtc:yyyy}-W{week:00}";
        }

        return bucketStartUtc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }
}
