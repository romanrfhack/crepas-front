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
        CatalogItemType? parsedItemType = null;
        if (!string.IsNullOrWhiteSpace(itemType) && Enum.TryParse<CatalogItemType>(itemType, true, out var parsed))
        {
            parsedItemType = parsed;
        }

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

    private static (DateTimeOffset from, DateTimeOffset to) ResolveRange(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, int defaultDays)
    {
        if (dateFrom.HasValue && dateTo.HasValue)
        {
            return (dateFrom.Value, dateTo.Value);
        }

        var now = DateTimeOffset.UtcNow;
        return (now.AddDays(-(defaultDays - 1)).Date, now);
    }
}
