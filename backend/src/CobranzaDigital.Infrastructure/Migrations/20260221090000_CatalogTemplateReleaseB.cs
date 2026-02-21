using System;

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    public partial class CatalogTemplateReleaseB : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CatalogTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VerticalId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Version = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogTemplates", x => x.Id);
                    table.ForeignKey("FK_CatalogTemplates_Verticals_VerticalId", x => x.VerticalId, "Verticals", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StoreCatalogAvailability",
                columns: table => new
                {
                    StoreId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<int>(type: "int", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsAvailable = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreCatalogAvailability", x => new { x.StoreId, x.ItemType, x.ItemId });
                    table.ForeignKey("FK_StoreCatalogAvailability_Stores_StoreId", x => x.StoreId, "Stores", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TenantCatalogOverrides",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemType = table.Column<int>(type: "int", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantCatalogOverrides", x => new { x.TenantId, x.ItemType, x.ItemId });
                    table.ForeignKey("FK_TenantCatalogOverrides_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TenantCatalogTemplates",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CatalogTemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantCatalogTemplates", x => x.TenantId);
                    table.ForeignKey("FK_TenantCatalogTemplates_CatalogTemplates_CatalogTemplateId", x => x.CatalogTemplateId, "CatalogTemplates", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_TenantCatalogTemplates_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddColumn<Guid>(name: "CatalogTemplateId", table: "Categories", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "CatalogTemplateId", table: "Products", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "CatalogTemplateId", table: "OptionSets", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "CatalogTemplateId", table: "OptionItems", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "CatalogTemplateId", table: "CustomizationSchemas", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "CatalogTemplateId", table: "SelectionGroups", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "CatalogTemplateId", table: "Extras", type: "uniqueidentifier", nullable: true);

            migrationBuilder.CreateIndex(name: "IX_CatalogTemplates_VerticalId_Name", table: "CatalogTemplates", columns: new[] { "VerticalId", "Name" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_TenantCatalogTemplates_CatalogTemplateId", table: "TenantCatalogTemplates", column: "CatalogTemplateId");
            migrationBuilder.CreateIndex(name: "IX_Categories_CatalogTemplateId_Name", table: "Categories", columns: new[] { "CatalogTemplateId", "Name" }, unique: true, filter: "[CatalogTemplateId] IS NOT NULL");
            migrationBuilder.CreateIndex(name: "IX_Products_CatalogTemplateId", table: "Products", column: "CatalogTemplateId");
            migrationBuilder.CreateIndex(name: "IX_OptionSets_CatalogTemplateId", table: "OptionSets", column: "CatalogTemplateId");
            migrationBuilder.CreateIndex(name: "IX_OptionItems_CatalogTemplateId", table: "OptionItems", column: "CatalogTemplateId");
            migrationBuilder.CreateIndex(name: "IX_CustomizationSchemas_CatalogTemplateId", table: "CustomizationSchemas", column: "CatalogTemplateId");
            migrationBuilder.CreateIndex(name: "IX_SelectionGroups_CatalogTemplateId", table: "SelectionGroups", column: "CatalogTemplateId");
            migrationBuilder.CreateIndex(name: "IX_Extras_CatalogTemplateId", table: "Extras", column: "CatalogTemplateId");

            migrationBuilder.AddForeignKey("FK_Categories_CatalogTemplates_CatalogTemplateId", "Categories", "CatalogTemplateId", "CatalogTemplates", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey("FK_Products_CatalogTemplates_CatalogTemplateId", "Products", "CatalogTemplateId", "CatalogTemplates", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey("FK_OptionSets_CatalogTemplates_CatalogTemplateId", "OptionSets", "CatalogTemplateId", "CatalogTemplates", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey("FK_OptionItems_CatalogTemplates_CatalogTemplateId", "OptionItems", "CatalogTemplateId", "CatalogTemplates", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey("FK_CustomizationSchemas_CatalogTemplates_CatalogTemplateId", "CustomizationSchemas", "CatalogTemplateId", "CatalogTemplates", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey("FK_SelectionGroups_CatalogTemplates_CatalogTemplateId", "SelectionGroups", "CatalogTemplateId", "CatalogTemplates", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey("FK_Extras_CatalogTemplates_CatalogTemplateId", "Extras", "CatalogTemplateId", "CatalogTemplates", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey("FK_Categories_CatalogTemplates_CatalogTemplateId", "Categories");
            migrationBuilder.DropForeignKey("FK_Products_CatalogTemplates_CatalogTemplateId", "Products");
            migrationBuilder.DropForeignKey("FK_OptionSets_CatalogTemplates_CatalogTemplateId", "OptionSets");
            migrationBuilder.DropForeignKey("FK_OptionItems_CatalogTemplates_CatalogTemplateId", "OptionItems");
            migrationBuilder.DropForeignKey("FK_CustomizationSchemas_CatalogTemplates_CatalogTemplateId", "CustomizationSchemas");
            migrationBuilder.DropForeignKey("FK_SelectionGroups_CatalogTemplates_CatalogTemplateId", "SelectionGroups");
            migrationBuilder.DropForeignKey("FK_Extras_CatalogTemplates_CatalogTemplateId", "Extras");

            migrationBuilder.DropTable(name: "StoreCatalogAvailability");
            migrationBuilder.DropTable(name: "TenantCatalogOverrides");
            migrationBuilder.DropTable(name: "TenantCatalogTemplates");
            migrationBuilder.DropTable(name: "CatalogTemplates");

            migrationBuilder.DropIndex(name: "IX_Categories_CatalogTemplateId_Name", table: "Categories");
            migrationBuilder.DropIndex(name: "IX_Products_CatalogTemplateId", table: "Products");
            migrationBuilder.DropIndex(name: "IX_OptionSets_CatalogTemplateId", table: "OptionSets");
            migrationBuilder.DropIndex(name: "IX_OptionItems_CatalogTemplateId", table: "OptionItems");
            migrationBuilder.DropIndex(name: "IX_CustomizationSchemas_CatalogTemplateId", table: "CustomizationSchemas");
            migrationBuilder.DropIndex(name: "IX_SelectionGroups_CatalogTemplateId", table: "SelectionGroups");
            migrationBuilder.DropIndex(name: "IX_Extras_CatalogTemplateId", table: "Extras");

            migrationBuilder.DropColumn(name: "CatalogTemplateId", table: "Categories");
            migrationBuilder.DropColumn(name: "CatalogTemplateId", table: "Products");
            migrationBuilder.DropColumn(name: "CatalogTemplateId", table: "OptionSets");
            migrationBuilder.DropColumn(name: "CatalogTemplateId", table: "OptionItems");
            migrationBuilder.DropColumn(name: "CatalogTemplateId", table: "CustomizationSchemas");
            migrationBuilder.DropColumn(name: "CatalogTemplateId", table: "SelectionGroups");
            migrationBuilder.DropColumn(name: "CatalogTemplateId", table: "Extras");
        }
    }
}
