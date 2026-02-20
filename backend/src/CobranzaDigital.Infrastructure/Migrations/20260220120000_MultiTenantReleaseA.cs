using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    public partial class MultiTenantReleaseA : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(name: "TenantId", table: "AspNetUsers", type: "uniqueidentifier", nullable: true);

            migrationBuilder.CreateTable(
                name: "Verticals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_Verticals", x => x.Id));

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VerticalId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    DefaultStoreId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                    table.ForeignKey("FK_Tenants_Verticals_VerticalId", x => x.VerticalId, "Verticals", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddColumn<Guid>(name: "TenantId", table: "Stores", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "TenantId", table: "Sales", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "TenantId", table: "PosShifts", type: "uniqueidentifier", nullable: true);

            migrationBuilder.Sql(@"
DECLARE @verticalId uniqueidentifier = NEWID();
DECLARE @tenantId uniqueidentifier = NEWID();
DECLARE @defaultStoreId uniqueidentifier = (SELECT TOP 1 Id FROM Stores ORDER BY CreatedAtUtc);

INSERT INTO Verticals (Id, Name, Description, IsActive, CreatedAtUtc, UpdatedAtUtc)
VALUES (@verticalId, 'Restaurant', 'Default vertical for legacy data', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

INSERT INTO Tenants (Id, VerticalId, Name, Slug, IsActive, DefaultStoreId, CreatedAtUtc, UpdatedAtUtc)
VALUES (@tenantId, @verticalId, 'Default Tenant', 'default-tenant', 1, @defaultStoreId, SYSUTCDATETIME(), SYSUTCDATETIME());

UPDATE Stores SET TenantId = @tenantId WHERE TenantId IS NULL;
UPDATE sa SET TenantId = s.TenantId FROM Sales sa INNER JOIN Stores s ON sa.StoreId = s.Id WHERE sa.TenantId IS NULL;
UPDATE ps SET TenantId = s.TenantId FROM PosShifts ps INNER JOIN Stores s ON ps.StoreId = s.Id WHERE ps.TenantId IS NULL;
");

            migrationBuilder.AlterColumn<Guid>(name: "TenantId", table: "Stores", type: "uniqueidentifier", nullable: false, oldClrType: typeof(Guid), oldType: "uniqueidentifier", oldNullable: true);
            migrationBuilder.AlterColumn<Guid>(name: "TenantId", table: "Sales", type: "uniqueidentifier", nullable: false, oldClrType: typeof(Guid), oldType: "uniqueidentifier", oldNullable: true);
            migrationBuilder.AlterColumn<Guid>(name: "TenantId", table: "PosShifts", type: "uniqueidentifier", nullable: false, oldClrType: typeof(Guid), oldType: "uniqueidentifier", oldNullable: true);

            migrationBuilder.CreateIndex(name: "IX_Verticals_Name", table: "Verticals", column: "Name", unique: true);
            migrationBuilder.CreateIndex(name: "IX_Tenants_Slug", table: "Tenants", column: "Slug", unique: true);
            migrationBuilder.CreateIndex(name: "IX_Tenants_VerticalId", table: "Tenants", column: "VerticalId");
            migrationBuilder.CreateIndex(name: "IX_Tenants_DefaultStoreId", table: "Tenants", column: "DefaultStoreId");
            migrationBuilder.DropIndex(name: "IX_Stores_Name", table: "Stores");
            migrationBuilder.CreateIndex(name: "IX_Stores_TenantId_Name", table: "Stores", columns: new[] { "TenantId", "Name" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_Sales_TenantId", table: "Sales", column: "TenantId");
            migrationBuilder.CreateIndex(name: "IX_PosShifts_TenantId", table: "PosShifts", column: "TenantId");

            migrationBuilder.AddForeignKey(name: "FK_Stores_Tenants_TenantId", table: "Stores", column: "TenantId", principalTable: "Tenants", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey(name: "FK_Sales_Tenants_TenantId", table: "Sales", column: "TenantId", principalTable: "Tenants", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey(name: "FK_PosShifts_Tenants_TenantId", table: "PosShifts", column: "TenantId", principalTable: "Tenants", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddForeignKey(name: "FK_Tenants_Stores_DefaultStoreId", table: "Tenants", column: "DefaultStoreId", principalTable: "Stores", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Stores_Tenants_TenantId", table: "Stores");
            migrationBuilder.DropForeignKey(name: "FK_Sales_Tenants_TenantId", table: "Sales");
            migrationBuilder.DropForeignKey(name: "FK_PosShifts_Tenants_TenantId", table: "PosShifts");
            migrationBuilder.DropTable(name: "Tenants");
            migrationBuilder.DropTable(name: "Verticals");
            migrationBuilder.DropIndex(name: "IX_Stores_TenantId_Name", table: "Stores");
            migrationBuilder.CreateIndex(name: "IX_Stores_Name", table: "Stores", column: "Name", unique: true);
            migrationBuilder.DropIndex(name: "IX_Sales_TenantId", table: "Sales");
            migrationBuilder.DropIndex(name: "IX_PosShifts_TenantId", table: "PosShifts");
            migrationBuilder.DropColumn(name: "TenantId", table: "Stores");
            migrationBuilder.DropColumn(name: "TenantId", table: "Sales");
            migrationBuilder.DropColumn(name: "TenantId", table: "PosShifts");
            migrationBuilder.DropColumn(name: "TenantId", table: "AspNetUsers");
        }
    }
}
