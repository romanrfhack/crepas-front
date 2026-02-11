using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Validators.PosCatalog;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;
using CobranzaDigital.Infrastructure.Services;
using FluentValidation;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CobranzaDigital.Application.Tests;

public sealed class PosCatalogValidationTests
{
    [Fact]
    public async Task SelectionGroupValidator_Rejects_Invalid_SingleMode()
    {
        var validator = new UpsertSelectionGroupRequestValidator();
        var request = new UpsertSelectionGroupRequest("size", "Tamaño", SelectionMode.Single, 1, 2, Guid.NewGuid());
        var result = await validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task IncludedItemValidator_Rejects_Quantity_Zero()
    {
        var validator = new ReplaceIncludedItemsRequestValidator();
        var request = new ReplaceIncludedItemsRequest([new ReplaceIncludedItemRow(Guid.NewGuid(), 0)]);
        var result = await validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Product_Requires_Active_Schema()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<CobranzaDigitalDbContext>().UseSqlite(connection).Options;
        await using var db = new CobranzaDigitalDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var service = BuildService(db);
        var category = new Category { Id = Guid.NewGuid(), Name = "Cat", SortOrder = 1, IsActive = true };
        var schema = new CustomizationSchema { Id = Guid.NewGuid(), Name = "S", IsActive = false };
        db.Categories.Add(category);
        db.CustomizationSchemas.Add(schema);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => service.CreateProductAsync(new UpsertProductRequest(null, "P", category.Id, null, 10, true, schema.Id), default));
    }

    [Fact]
    public async Task Override_Rejects_OptionItem_From_Another_OptionSet()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<CobranzaDigitalDbContext>().UseSqlite(connection).Options;
        await using var db = new CobranzaDigitalDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var service = BuildService(db);
        var category = new Category { Id = Guid.NewGuid(), Name = "Cat", SortOrder = 1, IsActive = true };
        var schema = new CustomizationSchema { Id = Guid.NewGuid(), Name = "S", IsActive = true };
        var product = new Product { Id = Guid.NewGuid(), Name = "P", CategoryId = category.Id, BasePrice = 1, IsActive = true, CustomizationSchemaId = schema.Id };
        var setA = new OptionSet { Id = Guid.NewGuid(), Name = "A", IsActive = true };
        var setB = new OptionSet { Id = Guid.NewGuid(), Name = "B", IsActive = true };
        var itemB = new OptionItem { Id = Guid.NewGuid(), OptionSetId = setB.Id, Name = "Other", IsActive = true };
        var group = new SelectionGroup { Id = Guid.NewGuid(), SchemaId = schema.Id, Key = "g", Label = "Group", OptionSetId = setA.Id, SelectionMode = SelectionMode.Multi, MinSelections = 0, MaxSelections = 2, IsActive = true };
        db.AddRange(category, schema, product, setA, setB, itemB, group);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => service.UpsertOverrideAsync(product.Id, "g", new OverrideUpsertRequest([itemB.Id]), default));
    }

    private static PosCatalogService BuildService(CobranzaDigitalDbContext db)
    {
        return new PosCatalogService(
            db,
            new TestAuditLogger(),
            NullLogger<PosCatalogService>.Instance,
            new UpsertSelectionGroupRequestValidator(),
            new UpsertProductRequestValidator(),
            new UpsertExtraRequestValidator(),
            new ReplaceIncludedItemsRequestValidator(),
            new OverrideUpsertRequestValidator());
    }

    private sealed class TestAuditLogger : IAuditLogger
    {
        public Task LogAsync(AuditEntry entry, CancellationToken ct = default) => Task.CompletedTask;
    }
}
