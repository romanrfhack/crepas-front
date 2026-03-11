using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InventoryV2WritePath : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryAdjustments_TenantId_StoreId_ClientOperationId",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "StoreCatalogOverrides",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: Array.Empty<byte>());

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "CatalogInventoryBalances",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: Array.Empty<byte>());

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_TenantId_StoreId_ClientOperationId",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "TenantId", "StoreId", "ClientOperationId" },
                unique: true,
                filter: "[ClientOperationId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryAdjustments_TenantId_StoreId_ClientOperationId",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "StoreCatalogOverrides");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "CatalogInventoryBalances");

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_TenantId_StoreId_ClientOperationId",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "TenantId", "StoreId", "ClientOperationId" });
        }
    }
}
