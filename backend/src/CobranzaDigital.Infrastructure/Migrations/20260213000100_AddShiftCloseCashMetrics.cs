using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations;

public partial class AddShiftCloseCashMetrics : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "CashDifference",
            table: "PosShifts",
            type: "decimal(18,2)",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "DenominationsJson",
            table: "PosShifts",
            type: "nvarchar(4000)",
            maxLength: 4000,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "ExpectedCashAmount",
            table: "PosShifts",
            type: "decimal(18,2)",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "CashDifference",
            table: "PosShifts");

        migrationBuilder.DropColumn(
            name: "DenominationsJson",
            table: "PosShifts");

        migrationBuilder.DropColumn(
            name: "ExpectedCashAmount",
            table: "PosShifts");
    }
}
