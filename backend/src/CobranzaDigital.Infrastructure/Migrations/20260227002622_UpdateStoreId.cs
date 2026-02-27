using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateStoreId : Migration
    {
        /// <inheritdoc />
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

            migrationBuilder.AddColumn<Guid>(
                name: "StoreId",
                table: "AspNetUsers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_ReferenceType_ReferenceId_ItemType_ItemId_Reason",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "ReferenceType", "ReferenceId", "ItemType", "ItemId", "Reason" },
                unique: true,
                filter: "[ReferenceType] IS NOT NULL AND [ReferenceId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_StoreId_ReferenceType_ReferenceId",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "StoreId", "ReferenceType", "ReferenceId" });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_StoreId",
                table: "AspNetUsers",
                column: "StoreId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_TenantId",
                table: "AspNetUsers",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Stores_StoreId",
                table: "AspNetUsers",
                column: "StoreId",
                principalTable: "Stores",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Stores_StoreId",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryAdjustments_ReferenceType_ReferenceId_ItemType_ItemId_Reason",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropIndex(
                name: "IX_CatalogInventoryAdjustments_StoreId_ReferenceType_ReferenceId",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_StoreId",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "MovementKind",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "ReferenceId",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "ReferenceType",
                table: "CatalogInventoryAdjustments");

            migrationBuilder.DropColumn(
                name: "StoreId",
                table: "AspNetUsers");
        }
    }
}
