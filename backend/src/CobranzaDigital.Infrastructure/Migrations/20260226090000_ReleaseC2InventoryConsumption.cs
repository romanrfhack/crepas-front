using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    public partial class ReleaseC2InventoryConsumption : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MovementKind",
                table: "CatalogInventoryAdjustments",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceId",
                table: "CatalogInventoryAdjustments",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceType",
                table: "CatalogInventoryAdjustments",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_StoreId_ReferenceType_ReferenceId",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "StoreId", "ReferenceType", "ReferenceId" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_ReferenceType_ReferenceId_ItemType_ItemId_Reason",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "ReferenceType", "ReferenceId", "ItemType", "ItemId", "Reason" },
                unique: true,
                filter: "[ReferenceType] IS NOT NULL AND [ReferenceId] IS NOT NULL");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryAdjustments_ReferenceType_ReferenceId_ItemType_ItemId_Reason",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryAdjustments_StoreId_ReferenceType_ReferenceId",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "MovementKind",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "ReferenceId",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "ReferenceType",
                table: "CatalogInventoryAdjustments");
        }
    }
}
