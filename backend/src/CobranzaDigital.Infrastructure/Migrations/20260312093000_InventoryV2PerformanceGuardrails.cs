using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    [DbContext(typeof(CobranzaDigitalDbContext))]
    [Migration("20260312093000_InventoryV2PerformanceGuardrails")]
    public partial class InventoryV2PerformanceGuardrails : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_TenantId_StoreId_ItemType_ItemId_CreatedAtUtc",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "TenantId", "StoreId", "ItemType", "ItemId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryBalances_TenantId_StoreId_ItemType_OnHandQty",
                table: "CatalogInventoryBalances",
                columns: new[] { "TenantId", "StoreId", "ItemType", "OnHandQty" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryBalances_TenantId_StoreId_ItemType_UpdatedAtUtc",
                table: "CatalogInventoryBalances",
                columns: new[] { "TenantId", "StoreId", "ItemType", "UpdatedAtUtc" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryAdjustments_TenantId_StoreId_ItemType_ItemId_CreatedAtUtc",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryBalances_TenantId_StoreId_ItemType_OnHandQty",
                table: "CatalogInventoryBalances");

            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryBalances_TenantId_StoreId_ItemType_UpdatedAtUtc",
                table: "CatalogInventoryBalances");
        }
    }
}
