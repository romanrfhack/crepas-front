using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    [DbContext(typeof(CobranzaDigitalDbContext))]
    [Migration("20260318120000_Ventas2SalesIndexes")]
    public partial class Ventas2SalesIndexes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Sales_ClientSaleId",
                table: "Sales");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_TenantId_StoreId_ClientSaleId",
                table: "Sales",
                columns: new[] { "TenantId", "StoreId", "ClientSaleId" },
                unique: true,
                filter: "[ClientSaleId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_TenantId_StoreId_Folio",
                table: "Sales",
                columns: new[] { "TenantId", "StoreId", "Folio" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_TenantId_StoreId_OccurredAtUtc",
                table: "Sales",
                columns: new[] { "TenantId", "StoreId", "OccurredAtUtc" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Sales_TenantId_StoreId_ClientSaleId",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Sales_TenantId_StoreId_Folio",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Sales_TenantId_StoreId_OccurredAtUtc",
                table: "Sales");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ClientSaleId",
                table: "Sales",
                column: "ClientSaleId",
                unique: true,
                filter: "[ClientSaleId] IS NOT NULL");
        }
    }
}
