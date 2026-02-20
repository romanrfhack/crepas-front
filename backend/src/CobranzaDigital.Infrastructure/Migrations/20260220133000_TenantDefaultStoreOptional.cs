using System;

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    public partial class TenantDefaultStoreOptional : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_Stores_DefaultStoreId",
                table: "Tenants");

            migrationBuilder.AlterColumn<Guid>(
                name: "DefaultStoreId",
                table: "Tenants",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_Stores_DefaultStoreId",
                table: "Tenants",
                column: "DefaultStoreId",
                principalTable: "Stores",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_Stores_DefaultStoreId",
                table: "Tenants");

            migrationBuilder.Sql("UPDATE Tenants SET DefaultStoreId = '00000000-0000-0000-0000-000000000000' WHERE DefaultStoreId IS NULL;");

            migrationBuilder.AlterColumn<Guid>(
                name: "DefaultStoreId",
                table: "Tenants",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_Stores_DefaultStoreId",
                table: "Tenants",
                column: "DefaultStoreId",
                principalTable: "Stores",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
