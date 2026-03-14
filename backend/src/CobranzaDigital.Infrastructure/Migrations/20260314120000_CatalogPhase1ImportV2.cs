using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    public partial class CatalogPhase1ImportV2 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryCode",
                table: "Categories",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("UPDATE c SET CategoryCode = LOWER(REPLACE(REPLACE(c.Name, ' ', '-'), '--', '-')) FROM Categories c WHERE c.CategoryCode = ''");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CatalogTemplateId_CategoryCode",
                table: "Categories",
                columns: new[] { "CatalogTemplateId", "CategoryCode" },
                unique: true,
                filter: "[CatalogTemplateId] IS NOT NULL");

            migrationBuilder.CreateTable(
                name: "CatalogImportBatchOperations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CatalogTemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ImportType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    BatchClientOperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ResultJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogImportBatchOperations", x => x.Id);
                    table.ForeignKey("FK_CatalogImportBatchOperations_CatalogTemplates_CatalogTemplateId", x => x.CatalogTemplateId, "CatalogTemplates", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_CatalogImportBatchOperations_Tenants_TenantId", x => x.TenantId, "Tenants", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogImportBatchOperations_CatalogTemplateId",
                table: "CatalogImportBatchOperations",
                column: "CatalogTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_CatalogImportBatchOperations_TenantId_CatalogTemplateId_ImportType_BatchClientOperationId",
                table: "CatalogImportBatchOperations",
                columns: new[] { "TenantId", "CatalogTemplateId", "ImportType", "BatchClientOperationId" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "CatalogImportBatchOperations");
            migrationBuilder.DropIndex(name: "IX_Categories_CatalogTemplateId_CategoryCode", table: "Categories");
            migrationBuilder.DropColumn(name: "CategoryCode", table: "Categories");
        }
    }
}
