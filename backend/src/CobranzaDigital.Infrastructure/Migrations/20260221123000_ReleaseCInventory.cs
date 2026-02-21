using System;

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    public partial class ReleaseCInventory : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ShowOnlyInStock",
                table: "PosSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "StoreInventories",
                columns: table => new
                {
                    StoreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OnHand = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    Reserved = table.Column<decimal>(type: "decimal(18,3)", nullable: false, defaultValue: 0m),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreInventories", x => new { x.StoreId, x.ProductId });
                    table.ForeignKey(
                        name: "FK_StoreInventories_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StoreInventories_Stores_StoreId",
                        column: x => x.StoreId,
                        principalTable: "Stores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StoreInventory_ProductId",
                table: "StoreInventories",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreInventory_StoreId",
                table: "StoreInventories",
                column: "StoreId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StoreInventories");

            migrationBuilder.DropColumn(
                name: "ShowOnlyInStock",
                table: "PosSettings");
        }
    }
}
