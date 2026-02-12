using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CobranzaDigital.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CustomizationSchemas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomizationSchemas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Extras",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Extras", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OptionSets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptionSets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExternalCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubcategoryName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    BasePrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CustomizationSchemaId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Products_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Products_CustomizationSchemas_CustomizationSchemaId",
                        column: x => x.CustomizationSchemaId,
                        principalTable: "CustomizationSchemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OptionItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OptionSetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OptionItems_OptionSets_OptionSetId",
                        column: x => x.OptionSetId,
                        principalTable: "OptionSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SelectionGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SchemaId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SelectionMode = table.Column<int>(type: "int", nullable: false),
                    MinSelections = table.Column<int>(type: "int", nullable: false),
                    MaxSelections = table.Column<int>(type: "int", nullable: false),
                    OptionSetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SelectionGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SelectionGroups_CustomizationSchemas_SchemaId",
                        column: x => x.SchemaId,
                        principalTable: "CustomizationSchemas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SelectionGroups_OptionSets_OptionSetId",
                        column: x => x.OptionSetId,
                        principalTable: "OptionSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "IncludedItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExtraId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IncludedItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IncludedItems_Extras_ExtraId",
                        column: x => x.ExtraId,
                        principalTable: "Extras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IncludedItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductGroupOverrides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductGroupOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductGroupOverrides_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductGroupOverrideAllowedItems",
                columns: table => new
                {
                    ProductGroupOverrideId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OptionItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductGroupOverrideAllowedItems", x => new { x.ProductGroupOverrideId, x.OptionItemId });
                    table.ForeignKey(
                        name: "FK_ProductGroupOverrideAllowedItems_OptionItems_OptionItemId",
                        column: x => x.OptionItemId,
                        principalTable: "OptionItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductGroupOverrideAllowedItems_ProductGroupOverrides_ProductGroupOverrideId",
                        column: x => x.ProductGroupOverrideId,
                        principalTable: "ProductGroupOverrides",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name",
                table: "Categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Categories_SortOrder",
                table: "Categories",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_IncludedItems_ExtraId",
                table: "IncludedItems",
                column: "ExtraId");

            migrationBuilder.CreateIndex(
                name: "IX_IncludedItems_ProductId",
                table: "IncludedItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OptionItems_OptionSetId",
                table: "OptionItems",
                column: "OptionSetId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductGroupOverrideAllowedItems_OptionItemId",
                table: "ProductGroupOverrideAllowedItems",
                column: "OptionItemId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductGroupOverrides_ProductId_GroupKey",
                table: "ProductGroupOverrides",
                columns: new[] { "ProductId", "GroupKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId",
                table: "Products",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_CustomizationSchemaId",
                table: "Products",
                column: "CustomizationSchemaId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_ExternalCode",
                table: "Products",
                column: "ExternalCode",
                unique: true,
                filter: "[ExternalCode] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SelectionGroups_OptionSetId",
                table: "SelectionGroups",
                column: "OptionSetId");

            migrationBuilder.CreateIndex(
                name: "IX_SelectionGroups_SchemaId_Key",
                table: "SelectionGroups",
                columns: new[] { "SchemaId", "Key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IncludedItems");

            migrationBuilder.DropTable(
                name: "ProductGroupOverrideAllowedItems");

            migrationBuilder.DropTable(
                name: "SelectionGroups");

            migrationBuilder.DropTable(
                name: "Extras");

            migrationBuilder.DropTable(
                name: "OptionItems");

            migrationBuilder.DropTable(
                name: "ProductGroupOverrides");

            migrationBuilder.DropTable(
                name: "OptionSets");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "CustomizationSchemas");
        }
    }
}
