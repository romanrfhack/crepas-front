using CobranzaDigital.Domain.Entities;

namespace CobranzaDigital.Infrastructure.Services;

internal static class PosAvailabilityEngine
{
    internal sealed record Input(
        CatalogItemType ItemType,
        Guid ItemId,
        bool IsEnabledByTenant,
        CatalogOverrideState? StoreOverrideState,
        bool IsManualAvailable,
        bool IsInventoryTracked,
        decimal? StockOnHand,
        string ItemName = "");

    internal sealed record Result(
        bool IsAvailableEffective,
        string Reason,
        string Source,
        bool IsInventoryTracked,
        decimal? StockOnHand,
        decimal? AvailableQuantity,
        CatalogOverrideState? StoreOverrideState);

    public static Result Resolve(Input input)
    {
        if (!input.IsEnabledByTenant)
        {
            return new(false, "DisabledByTenant", "TenantOverride", input.IsInventoryTracked, input.StockOnHand, input.StockOnHand, input.StoreOverrideState);
        }

        if (input.StoreOverrideState == CatalogOverrideState.Disabled)
        {
            return new(false, "DisabledByStore", "StoreOverride", input.IsInventoryTracked, input.StockOnHand, input.StockOnHand, input.StoreOverrideState);
        }

        if (!input.IsManualAvailable)
        {
            return new(false, "ManualUnavailable", "Manual", input.IsInventoryTracked, input.StockOnHand, input.StockOnHand, input.StoreOverrideState);
        }

        if (input.IsInventoryTracked && (input.StockOnHand ?? 0m) <= 0m)
        {
            return new(false, "OutOfStock", "Inventory", input.IsInventoryTracked, input.StockOnHand, input.StockOnHand, input.StoreOverrideState);
        }

        var reason = input.StoreOverrideState == CatalogOverrideState.Enabled ? "EnabledByStore" : "Available";
        var source = input.StoreOverrideState == CatalogOverrideState.Enabled ? "StoreOverride" : "Catalog";
        return new(true, reason, source, input.IsInventoryTracked, input.StockOnHand, input.StockOnHand, input.StoreOverrideState);
    }
}
