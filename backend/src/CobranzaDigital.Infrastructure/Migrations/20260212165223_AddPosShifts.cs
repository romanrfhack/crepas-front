using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPosShifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ShiftId",
                table: "Sales",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PosShifts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OpenedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    OpenedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OpenedByEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    OpeningCashAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ClosedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ClosedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ClosedByEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    ClosingCashAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    OpenNotes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CloseNotes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    OpenOperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CloseOperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PosShifts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ShiftId",
                table: "Sales",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_PosShifts_ClosedAtUtc",
                table: "PosShifts",
                column: "ClosedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PosShifts_CloseOperationId",
                table: "PosShifts",
                column: "CloseOperationId",
                unique: true,
                filter: "[CloseOperationId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PosShifts_OpenOperationId",
                table: "PosShifts",
                column: "OpenOperationId",
                unique: true,
                filter: "[OpenOperationId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_PosShifts_ShiftId",
                table: "Sales",
                column: "ShiftId",
                principalTable: "PosShifts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sales_PosShifts_ShiftId",
                table: "Sales");

            migrationBuilder.DropTable(
                name: "PosShifts");

            migrationBuilder.DropIndex(
                name: "IX_Sales_ShiftId",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "ShiftId",
                table: "Sales");
        }
    }
}
