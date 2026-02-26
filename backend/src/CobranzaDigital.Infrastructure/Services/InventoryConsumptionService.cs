using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class InventoryConsumptionService
{
    private const string SaleReferenceType = "Sale";
    private const string SaleVoidReferenceType = "SaleVoid";

    private readonly CobranzaDigitalDbContext _db;
    private readonly IAuditLogger _auditLogger;

    public InventoryConsumptionService(CobranzaDigitalDbContext db, IAuditLogger auditLogger)
    {
        _db = db;
        _auditLogger = auditLogger;
    }

    public async Task ConsumeForSaleAsync(Guid tenantId, Guid storeId, Guid saleId, Guid? userId, IReadOnlyList<CreateSaleItemRequestDto> items, Dictionary<Guid, Product> products, Dictionary<Guid, Extra> extras, bool enforceStockForAllItems, Dictionary<(CatalogItemType, Guid), CatalogOverrideState?> storeOverrides, HashSet<(CatalogItemType, Guid)> tenantDisabled, CancellationToken ct)
    {
        var movements = BuildConsumption(items, products, extras, enforceStockForAllItems);
        if (movements.Count == 0)
        {
            return;
        }

        var existingCount = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .CountAsync(x => x.ReferenceType == SaleReferenceType
                             && x.ReferenceId == saleId.ToString("D")
                             && x.Reason == InventoryAdjustmentReason.SaleConsumption.ToString(), ct)
            .ConfigureAwait(false);

        if (existingCount == movements.Count)
        {
            return;
        }

        var balances = await _db.CatalogInventoryBalances
            .Where(x => x.TenantId == tenantId && x.StoreId == storeId)
            .ToDictionaryAsync(x => (x.ItemType, x.ItemId), ct)
            .ConfigureAwait(false);

        foreach (var movement in movements)
        {
            var resolved = PosAvailabilityEngine.Resolve(new PosAvailabilityEngine.Input(
                movement.ItemType,
                movement.ItemId,
                !tenantDisabled.Contains((movement.ItemType, movement.ItemId)),
                storeOverrides.GetValueOrDefault((movement.ItemType, movement.ItemId)),
                movement.IsManualAvailable,
                movement.IsInventoryTracked,
                balances.TryGetValue((movement.ItemType, movement.ItemId), out var row) ? row.OnHandQty : 0m,
                movement.ItemName));

            if (!resolved.IsAvailableEffective)
            {
                throw new ItemUnavailableException(movement.ItemType.ToString(), movement.ItemId, movement.ItemName, resolved.Reason, resolved.AvailableQuantity);
            }

            var balance = balances.GetValueOrDefault((movement.ItemType, movement.ItemId));
            var qtyBefore = balance?.OnHandQty ?? 0m;
            var qtyAfter = qtyBefore - movement.Quantity;
            if (movement.IsInventoryTracked && qtyAfter < 0m)
            {
                throw new ItemUnavailableException(movement.ItemType.ToString(), movement.ItemId, movement.ItemName, "OutOfStock", qtyBefore);
            }

            if (balance is null)
            {
                balance = new CatalogInventoryBalance
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    StoreId = storeId,
                    ItemType = movement.ItemType,
                    ItemId = movement.ItemId,
                    OnHandQty = 0m,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                };
                _db.CatalogInventoryBalances.Add(balance);
                balances[(movement.ItemType, movement.ItemId)] = balance;
            }

            balance.OnHandQty = qtyAfter;
            balance.UpdatedAtUtc = DateTimeOffset.UtcNow;

            var adjustment = new CatalogInventoryAdjustment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                StoreId = storeId,
                ItemType = movement.ItemType,
                ItemId = movement.ItemId,
                QtyBefore = qtyBefore,
                DeltaQty = -movement.Quantity,
                ResultingOnHandQty = qtyAfter,
                Reason = InventoryAdjustmentReason.SaleConsumption.ToString(),
                ReferenceType = SaleReferenceType,
                ReferenceId = saleId.ToString("D"),
                MovementKind = InventoryAdjustmentReason.SaleConsumption.ToString(),
                Reference = saleId.ToString("D"),
                CreatedAtUtc = DateTimeOffset.UtcNow,
                CreatedByUserId = userId
            };

            _db.CatalogInventoryAdjustments.Add(adjustment);

            await _auditLogger.LogAsync(new AuditEntry(
                Action: AuditActions.ConsumeInventoryForSale,
                UserId: userId,
                CorrelationId: null,
                EntityType: "CatalogInventoryAdjustment",
                EntityId: adjustment.Id.ToString("D"),
                Before: new { tenantId, storeId, saleId, movement.ItemType, movement.ItemId, QtyBefore = qtyBefore },
                After: new { QtyDelta = -movement.Quantity, QtyAfter = qtyAfter, Reason = adjustment.Reason },
                Source: "POS",
                Notes: "Automatic inventory consumption for sale",
                OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);
        }
    }

    public async Task ReverseForVoidAsync(Guid tenantId, Guid storeId, Guid saleId, Guid? userId, CancellationToken ct)
    {
        var consumptions = await _db.CatalogInventoryAdjustments
            .Where(x => x.TenantId == tenantId
                        && x.StoreId == storeId
                        && x.ReferenceType == SaleReferenceType
                        && x.ReferenceId == saleId.ToString("D")
                        && x.Reason == InventoryAdjustmentReason.SaleConsumption.ToString())
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (consumptions.Count == 0)
        {
            return;
        }

        var reversals = await _db.CatalogInventoryAdjustments.AsNoTracking()
            .Where(x => x.TenantId == tenantId
                        && x.StoreId == storeId
                        && x.ReferenceType == SaleVoidReferenceType
                        && x.ReferenceId == saleId.ToString("D")
                        && x.Reason == InventoryAdjustmentReason.VoidReversal.ToString())
            .Select(x => new { x.ItemType, x.ItemId })
            .ToListAsync(ct)
            .ConfigureAwait(false);
        var reversalSet = reversals.Select(x => (x.ItemType, x.ItemId)).ToHashSet();

        var balances = await _db.CatalogInventoryBalances
            .Where(x => x.TenantId == tenantId && x.StoreId == storeId)
            .ToDictionaryAsync(x => (x.ItemType, x.ItemId), ct)
            .ConfigureAwait(false);

        foreach (var consumption in consumptions)
        {
            if (reversalSet.Contains((consumption.ItemType, consumption.ItemId)))
            {
                continue;
            }

            var qtyToReverse = decimal.Abs(consumption.DeltaQty);
            var balance = balances.GetValueOrDefault((consumption.ItemType, consumption.ItemId));
            var qtyBefore = balance?.OnHandQty ?? 0m;
            var qtyAfter = qtyBefore + qtyToReverse;

            if (balance is null)
            {
                balance = new CatalogInventoryBalance
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    StoreId = storeId,
                    ItemType = consumption.ItemType,
                    ItemId = consumption.ItemId,
                    OnHandQty = qtyAfter,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                };
                _db.CatalogInventoryBalances.Add(balance);
                balances[(consumption.ItemType, consumption.ItemId)] = balance;
            }
            else
            {
                balance.OnHandQty = qtyAfter;
                balance.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }

            var adjustment = new CatalogInventoryAdjustment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                StoreId = storeId,
                ItemType = consumption.ItemType,
                ItemId = consumption.ItemId,
                QtyBefore = qtyBefore,
                DeltaQty = qtyToReverse,
                ResultingOnHandQty = qtyAfter,
                Reason = InventoryAdjustmentReason.VoidReversal.ToString(),
                ReferenceType = SaleVoidReferenceType,
                ReferenceId = saleId.ToString("D"),
                MovementKind = InventoryAdjustmentReason.VoidReversal.ToString(),
                Reference = saleId.ToString("D"),
                CreatedAtUtc = DateTimeOffset.UtcNow,
                CreatedByUserId = userId
            };

            _db.CatalogInventoryAdjustments.Add(adjustment);

            await _auditLogger.LogAsync(new AuditEntry(
                Action: AuditActions.ReverseInventoryForVoid,
                UserId: userId,
                CorrelationId: null,
                EntityType: "CatalogInventoryAdjustment",
                EntityId: adjustment.Id.ToString("D"),
                Before: new { tenantId, storeId, saleId, consumption.ItemType, consumption.ItemId, QtyBefore = qtyBefore },
                After: new { QtyDelta = qtyToReverse, QtyAfter = qtyAfter, Reason = adjustment.Reason },
                Source: "POS",
                Notes: "Automatic inventory reversal for void",
                OccurredAtUtc: DateTime.UtcNow), ct).ConfigureAwait(false);
        }
    }

    private static List<InventoryMovement> BuildConsumption(IReadOnlyList<CreateSaleItemRequestDto> items, Dictionary<Guid, Product> products, Dictionary<Guid, Extra> extras, bool enforceStockForAllItems)
    {
        var aggregated = new Dictionary<(CatalogItemType ItemType, Guid ItemId), InventoryMovement>();

        foreach (var item in items)
        {
            var product = products[item.ProductId];
            if (product.IsInventoryTracked || enforceStockForAllItems)
            {
                Add(aggregated, CatalogItemType.Product, product.Id, item.Quantity, product.Name, product.IsAvailable, product.IsInventoryTracked || enforceStockForAllItems);
            }

            foreach (var extraLine in item.Extras ?? [])
            {
                var extra = extras[extraLine.ExtraId];
                if (!extra.IsInventoryTracked && !enforceStockForAllItems)
                {
                    continue;
                }

                Add(aggregated, CatalogItemType.Extra, extra.Id, extraLine.Quantity, extra.Name, extra.IsAvailable, extra.IsInventoryTracked || enforceStockForAllItems);
            }
        }

        return aggregated.Values.ToList();

        static void Add(Dictionary<(CatalogItemType ItemType, Guid ItemId), InventoryMovement> map, CatalogItemType itemType, Guid itemId, int qty, string name, bool isManualAvailable, bool isInventoryTracked)
        {
            var key = (itemType, itemId);
            if (map.TryGetValue(key, out var current))
            {
                map[key] = current with { Quantity = current.Quantity + qty };
                return;
            }

            map[key] = new InventoryMovement(itemType, itemId, qty, name, isManualAvailable, isInventoryTracked);
        }
    }

    private sealed record InventoryMovement(CatalogItemType ItemType, Guid ItemId, int Quantity, string ItemName, bool IsManualAvailable, bool IsInventoryTracked);
}
