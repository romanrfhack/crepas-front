namespace CobranzaDigital.Application.Auditing;

public static class AuditActions
{
    public const string LockUser = "LockUser";
    public const string UnlockUser = "UnlockUser";
    public const string CreateUser = "CreateUser";
    public const string UpdateUser = "UpdateUser";
    public const string ResetUserPassword = "ResetUserPassword";
    public const string CreateRole = "CreateRole";
    public const string DeleteRole = "DeleteRole";
    public const string AdjustInventory = "AdjustInventory";
    public const string SetInventoryBalance = "SetInventoryBalance";
    public const string ConsumeInventoryForSale = "ConsumeInventoryForSale";
    public const string ReverseInventoryForVoid = "ReverseInventoryForVoid";
    public const string UpdateStore = "UpdateStore";
    public const string UpdateTenantDefaultStore = "UpdateTenantDefaultStore";
}
