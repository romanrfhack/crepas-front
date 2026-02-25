using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdatePosSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsInventoryTracked",
                table: "Products",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAtUtc",
                table: "PosSettings",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<bool>(
                name: "IsInventoryTracked",
                table: "Extras",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "CatalogInventoryAdjustments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StoreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<int>(type: "int", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QtyBefore = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    DeltaQty = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    ResultingOnHandQty = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    ClientOperationId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogInventoryAdjustments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CatalogInventoryAdjustments_Stores_StoreId",
                        column: x => x.StoreId,
                        principalTable: "Stores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CatalogInventoryAdjustments_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CatalogInventoryBalances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StoreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<int>(type: "int", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OnHandQty = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogInventoryBalances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CatalogInventoryBalances_Stores_StoreId",
                        column: x => x.StoreId,
                        principalTable: "Stores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CatalogInventoryBalances_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StoreCatalogOverrides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StoreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<int>(type: "int", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OverrideState = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreCatalogOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StoreCatalogOverrides_Stores_StoreId",
                        column: x => x.StoreId,
                        principalTable: "Stores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StoreCatalogOverrides_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_StoreId_CreatedAtUtc",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "StoreId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_StoreId_ItemType_ItemId",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "StoreId", "ItemType", "ItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryAdjustments_TenantId_StoreId_ClientOperationId",
                table: "CatalogInventoryAdjustments",
                columns: new[] { "TenantId", "StoreId", "ClientOperationId" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryBalances_StoreId_ItemType_ItemId",
                table: "CatalogInventoryBalances",
                columns: new[] { "StoreId", "ItemType", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CatalogInventoryBalances_TenantId",
                table: "CatalogInventoryBalances",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreCatalogOverrides_StoreId_ItemType_ItemId",
                table: "StoreCatalogOverrides",
                columns: new[] { "StoreId", "ItemType", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StoreCatalogOverrides_TenantId",
                table: "StoreCatalogOverrides",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CatalogInventoryAdjustments");

            migrationBuilder.DropTable(
                name: "CatalogInventoryBalances");

            migrationBuilder.DropTable(
                name: "StoreCatalogOverrides");

            migrationBuilder.DropColumn(
                name: "IsInventoryTracked",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "PosSettings");

            migrationBuilder.DropColumn(
                name: "IsInventoryTracked",
                table: "Extras");
        }
    }
}
