using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PosCatalogIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly HttpClient _client;
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly string _tenantHeaderValue;

    public PosCatalogIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var defaultStoreId = db.PosSettings.AsNoTracking().OrderBy(x => x.Id).Select(x => x.DefaultStoreId).First();
        var tenantId = db.Stores.AsNoTracking().Where(x => x.Id == defaultStoreId).Select(x => x.TenantId).First();
        _tenantHeaderValue = tenantId.ToString("D");
    }

    [Fact]
    public async Task Category_And_Product_Crud_SoftDelete_Works()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        using var createCategory = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/categories", token);
        createCategory.Content = JsonContent.Create(new { name = "Bebidas", sortOrder = 1, isActive = true });
        using var createdCategoryResp = await _client.SendAsync(createCategory);
        var category = await createdCategoryResp.Content.ReadFromJsonAsync<CategoryResponse>();
        Assert.Equal(HttpStatusCode.OK, createdCategoryResp.StatusCode);

        using var createProduct = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/products", token);
        createProduct.Content = JsonContent.Create(new { name = "Cafe", categoryId = category!.Id, basePrice = 10.5m, isActive = true });
        using var createdProductResp = await _client.SendAsync(createProduct);
        var product = await createdProductResp.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.Equal(HttpStatusCode.OK, createdProductResp.StatusCode);

        using var deleteProduct = CreateAuthorizedRequest(HttpMethod.Delete, $"/api/v1/pos/admin/products/{product!.Id}", token);
        using var deleteResp = await _client.SendAsync(deleteProduct);
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        using var getProducts = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/admin/products", token);
        using var getProductsResp = await _client.SendAsync(getProducts);
        var products = await getProductsResp.Content.ReadFromJsonAsync<List<ProductResponse>>();
        Assert.DoesNotContain(products!, x => x.Id == product.Id);
    }

    [Fact]
    public async Task Snapshot_Returns_Only_Active_And_Overrides()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = "Comida", sortOrder = 1, isActive = true });
        var optionSet = await PostAsync<OptionSetResponse>("/api/v1/pos/admin/option-sets", token, new { name = "Salsas", isActive = true });
        var itemA = await PostAsync<OptionItemResponse>($"/api/v1/pos/admin/option-sets/{optionSet.Id}/items", token, new { name = "Roja", isActive = true, sortOrder = 1 });
        var schema = await PostAsync<SchemaResponse>("/api/v1/pos/admin/schemas", token, new { name = "Default", isActive = true });
        _ = await PostAsync<object>($"/api/v1/pos/admin/schemas/{schema.Id}/groups", token, new { key = "sauce", label = "Salsa", selectionMode = 1, minSelections = 0, maxSelections = 2, optionSetId = optionSet.Id, isActive = true, sortOrder = 1 });
        var extra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "Queso", price = 5m, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Taco", categoryId = category.Id, basePrice = 35m, isActive = true, customizationSchemaId = schema.Id });

        using var putIncluded = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/pos/admin/products/{product.Id}/included-items", token);
        putIncluded.Content = JsonContent.Create(new { items = new[] { new { extraId = extra.Id, quantity = 1 } } });
        using var _incResp = await _client.SendAsync(putIncluded);

        using var putOverride = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/pos/admin/products/{product.Id}/overrides/sauce", token);
        putOverride.Content = JsonContent.Create(new { allowedOptionItemIds = new[] { itemA.Id } });
        using var _ovResp = await _client.SendAsync(putOverride);

        using var snapshotReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", token);
        using var snapshotResp = await _client.SendAsync(snapshotReq);
        var snapshot = await snapshotResp.Content.ReadFromJsonAsync<SnapshotResponse>();

        Assert.Equal(HttpStatusCode.OK, snapshotResp.StatusCode);
        Assert.NotNull(snapshot);
        Assert.NotEmpty(snapshot!.Products);
        Assert.Contains(snapshot.Overrides, x => x.ProductId == product.Id && x.AllowedOptionItemIds.Contains(itemA.Id));
        Assert.Contains(snapshot.Products, x => x.IsAvailable);
    }

    [Fact]
    public async Task Snapshot_Filters_OutOfStock_When_ShowOnlyInStock_Enabled_And_Etag_Changes_After_Adjustment()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"stock-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stock P1", categoryId = category.Id, basePrice = 55m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var p2 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stock P2", categoryId = category.Id, basePrice = 65m, isActive = true, isAvailable = true, isInventoryTracked = true });

        var snapshot = await GetSnapshotAsync(token);

        await UpdateInventorySettingsAsync(token, true);

        try
        {
            await UpsertCatalogInventoryAsync(token, snapshot.StoreId, p1.Id, 5m);
            await UpsertCatalogInventoryAsync(token, snapshot.StoreId, p2.Id, 0m);

            var etag = await GetSnapshotEtagAsync(token);

            var stockFilteredSnapshot = await GetSnapshotAsync(token);
            Assert.Contains(stockFilteredSnapshot.Products, x => x.Id == p1.Id);
            Assert.DoesNotContain(stockFilteredSnapshot.Products, x => x.Id == p2.Id);

            await UpsertCatalogInventoryAsync(token, snapshot.StoreId, p2.Id, 3m);
            var changedEtag = await ToggleAvailabilityAndAssertEtagChangedAsync(token, etag, () => Task.CompletedTask);
            Assert.NotEqual(etag, changedEtag);

            var refreshedSnapshot = await GetSnapshotAsync(token);
            Assert.Contains(refreshedSnapshot.Products, x => x.Id == p2.Id);
        }
        finally
        {
            await UpdateInventorySettingsAsync(token, false);
        }
    }

    [Fact]
    public async Task Snapshot_Allows_Cashier()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var cashierEmail = $"cashier.snapshot.{Guid.NewGuid():N}@test.local";
        _ = await RegisterAndGetAccessTokenAsync(cashierEmail, "User1234!");

        await SetUserRolesAsync(adminToken, cashierEmail, ["Cashier"]);
        var cashierToken = await LoginAndGetAccessTokenAsync(cashierEmail, "User1234!");

        using var snapshotReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", cashierToken);
        using var snapshotResp = await _client.SendAsync(snapshotReq);

        Assert.Equal(HttpStatusCode.OK, snapshotResp.StatusCode);
    }

    [Fact]
    public async Task Snapshot_Uses_Etag_And_Changes_When_Availability_Changes()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"etag-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "P1", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true });
        var p2 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "P2", categoryId = category.Id, basePrice = 11m, isActive = true, isAvailable = true });

        await UpdateInventorySettingsAsync(token, false);

        var snapshot = await GetSnapshotAsync(token);
        var etag = await GetSnapshotEtagAsync(token);

        using (var disableReq = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/overrides", token))
        {
            disableReq.Content = JsonContent.Create(new { itemType = "Product", itemId = p2.Id, isEnabled = false });
            using var disableResp = await _client.SendAsync(disableReq);
            Assert.Equal(HttpStatusCode.OK, disableResp.StatusCode);
        }

        using (var availabilityReq = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/store-overrides", token))
        {
            availabilityReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = p1.Id, state = "Disabled" });
            using var availabilityResp = await _client.SendAsync(availabilityReq);
            Assert.Equal(HttpStatusCode.OK, availabilityResp.StatusCode);
        }

        var filteredSnapshot = await GetSnapshotAsync(token);
        Assert.Contains(filteredSnapshot.Products, x => x.Id == p2.Id && x.IsAvailable == false && x.AvailabilityReason == "DisabledByTenant");
        Assert.Contains(filteredSnapshot.Products, x => x.Id == p1.Id && x.IsAvailable == false);

        var changed = await ToggleAvailabilityAndAssertEtagChangedAsync(token, etag, async () =>
        {
            using var enableReq = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/overrides", token);
            enableReq.Content = JsonContent.Create(new { itemType = "Product", itemId = p2.Id, isEnabled = true });
            using var enableResp = await _client.SendAsync(enableReq);
            Assert.Equal(HttpStatusCode.OK, enableResp.StatusCode);
        });

        _ = await ToggleAvailabilityAndAssertEtagChangedAsync(token, changed, async () =>
        {
            using var availabilityReq = CreateAuthorizedRequest(HttpMethod.Delete, $"/api/v1/pos/admin/catalog/store-overrides?storeId={filteredSnapshot.StoreId:D}&itemType=Product&itemId={p1.Id:D}", token);
            using var availabilityResp = await _client.SendAsync(availabilityReq);
            Assert.True(availabilityResp.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent);
        });
    }

    [Fact]
    public async Task Inventory_Get_Includes_Template_Products_Without_Row_With_Default_Zeroes()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var productWithRow = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Inventory P1", externalCode = "INV-1", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true });
        var productWithoutRow = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Inventory P2", externalCode = "INV-2", categoryId = category.Id, basePrice = 12m, isActive = true, isAvailable = true });
        var snapshot = await GetSnapshotAsync(token);

        await UpsertInventoryAsync(token, snapshot.StoreId, productWithRow.Id, 4m);

        var inventory = await GetInventoryAsync(token, snapshot.StoreId);

        Assert.Contains(inventory, x => x.ProductId == productWithRow.Id && x.OnHand == 4m && x.HasInventoryRow == true && x.UpdatedAtUtc != null);
        Assert.Contains(inventory, x => x.ProductId == productWithoutRow.Id && x.OnHand == 0m && x.Reserved == 0m && x.HasInventoryRow == false && x.UpdatedAtUtc == null);

        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/inventory?storeId={snapshot.StoreId:D}", token);
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, payload.ValueKind);

        var withRowJson = payload.EnumerateArray().Single(x => x.GetProperty("productId").GetGuid() == productWithRow.Id);
        var withoutRowJson = payload.EnumerateArray().Single(x => x.GetProperty("productId").GetGuid() == productWithoutRow.Id);

        Assert.True(withRowJson.TryGetProperty("hasInventoryRow", out var withRowFlag));
        Assert.True(withRowFlag.GetBoolean());
        Assert.True(withRowJson.TryGetProperty("updatedAtUtc", out var withRowUpdatedAt));
        Assert.Equal(JsonValueKind.String, withRowUpdatedAt.ValueKind);

        Assert.True(withoutRowJson.TryGetProperty("hasInventoryRow", out var withoutRowFlag));
        Assert.False(withoutRowFlag.GetBoolean());
        Assert.True(withoutRowJson.TryGetProperty("updatedAtUtc", out var withoutRowUpdatedAt));
        Assert.Equal(JsonValueKind.Null, withoutRowUpdatedAt.ValueKind);
    }

    [Fact]
    public async Task Inventory_Get_Filters_By_Search_Name_And_Sku()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-search-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var latte = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Latte Search", externalCode = "LAT-SKU", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true });
        var mocha = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Mocha Search", externalCode = "MOC-SKU", categoryId = category.Id, basePrice = 12m, isActive = true, isAvailable = true });
        var snapshot = await GetSnapshotAsync(token);

        var byName = await GetInventoryAsync(token, snapshot.StoreId, "Latte");
        var bySku = await GetInventoryAsync(token, snapshot.StoreId, "MOC-SKU");

        Assert.Contains(byName, x => x.ProductId == latte.Id);
        Assert.DoesNotContain(byName, x => x.ProductId == mocha.Id);
        Assert.Contains(bySku, x => x.ProductId == mocha.Id);
        Assert.DoesNotContain(bySku, x => x.ProductId == latte.Id);
    }

    [Fact]
    public async Task Inventory_Get_OnlyWithStock_Returns_Products_With_OnHand_Greater_Than_Zero()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-stock-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var inStock = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stocked Product", externalCode = "STK-1", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true });
        var zeroStock = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Zero Product", externalCode = "ZER-1", categoryId = category.Id, basePrice = 12m, isActive = true, isAvailable = true });
        var snapshot = await GetSnapshotAsync(token);

        await UpsertInventoryAsync(token, snapshot.StoreId, inStock.Id, 2m);
        await UpsertInventoryAsync(token, snapshot.StoreId, zeroStock.Id, 0m);

        var filtered = await GetInventoryAsync(token, snapshot.StoreId, onlyWithStock: true);

        Assert.Contains(filtered, x => x.ProductId == inStock.Id && x.OnHand == 2m);
        Assert.DoesNotContain(filtered, x => x.ProductId == zeroStock.Id);
    }

    [Fact]
    public async Task Catalog_Overrides_Get_Returns_Item_Metadata()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"override-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Override Product", externalCode = "SKU-OVR-1", categoryId = category.Id, basePrice = 9m, isActive = true, isAvailable = true });

        using var putOverride = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/overrides", token);
        putOverride.Content = JsonContent.Create(new { itemType = "Product", itemId = product.Id, isEnabled = false });
        using var putOverrideResponse = await _client.SendAsync(putOverride);
        Assert.Equal(HttpStatusCode.OK, putOverrideResponse.StatusCode);

        using var getOverrides = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/admin/catalog/overrides?type=Product", token);
        using var getOverridesResponse = await _client.SendAsync(getOverrides);
        var payload = await getOverridesResponse.Content.ReadFromJsonAsync<List<CatalogItemOverrideResponse>>();

        Assert.Equal(HttpStatusCode.OK, getOverridesResponse.StatusCode);
        Assert.NotNull(payload);
        Assert.Contains(payload!, x => x.ItemId == product.Id && x.ItemName == "Override Product" && x.ItemSku == "SKU-OVR-1");
    }

    [Fact]
    public async Task Catalog_Availability_Get_Returns_Empty_And_Overrides_By_Store()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"availability-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Availability Product", categoryId = category.Id, basePrice = 12m, isActive = true, isAvailable = true });
        var snapshot = await GetSnapshotAsync(token);

        using var emptyRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/catalog/availability?storeId={snapshot.StoreId:D}&type=Product", token);
        using var emptyResponse = await _client.SendAsync(emptyRequest);
        var emptyPayload = await emptyResponse.Content.ReadFromJsonAsync<List<CatalogStoreAvailabilityResponse>>();

        Assert.Equal(HttpStatusCode.OK, emptyResponse.StatusCode);
        Assert.NotNull(emptyPayload);
        Assert.Empty(emptyPayload!);

        using var putAvailability = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/availability", token);
        putAvailability.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, isAvailable = false });
        using var putAvailabilityResponse = await _client.SendAsync(putAvailability);
        Assert.Equal(HttpStatusCode.OK, putAvailabilityResponse.StatusCode);

        using var getAvailability = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/catalog/availability?storeId={snapshot.StoreId:D}&type=Product", token);
        using var getAvailabilityResponse = await _client.SendAsync(getAvailability);
        var payload = await getAvailabilityResponse.Content.ReadFromJsonAsync<List<CatalogStoreAvailabilityResponse>>();

        Assert.Equal(HttpStatusCode.OK, getAvailabilityResponse.StatusCode);
        Assert.NotNull(payload);
        Assert.Contains(payload!, x => x.ItemId == product.Id && x.IsAvailable == false && x.ItemName == "Availability Product");
    }

    [Fact]
    public async Task SuperAdmin_Can_Read_CatalogAvailability_With_Tenant_Override_Header()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var superAdminEmail = $"super.catalog.{Guid.NewGuid():N}@test.local";
        _ = await RegisterAndGetAccessTokenAsync(superAdminEmail, "User1234!");
        await SetUserRolesAsync(adminToken, superAdminEmail, ["SuperAdmin"]);

        var superAdminToken = await LoginAndGetAccessTokenAsync(superAdminEmail, "User1234!");
        var snapshot = await GetSnapshotAsync(adminToken);

        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/catalog/availability?storeId={snapshot.StoreId:D}&type=Product", superAdminToken);
        request.Headers.Add("X-Tenant-Id", snapshot.TenantId.ToString("D"));
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Catalog_Admin_Modifications_Allow_AdminAndManager_But_Deny_Cashier()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var managerEmail = $"manager.catalog.{Guid.NewGuid():N}@test.local";
        var cashierEmail = $"cashier.catalog.{Guid.NewGuid():N}@test.local";
        _ = await RegisterAndGetAccessTokenAsync(managerEmail, "User1234!");
        _ = await RegisterAndGetAccessTokenAsync(cashierEmail, "User1234!");

        await SetUserRolesAsync(adminToken, managerEmail, ["Manager"]);
        await SetUserRolesAsync(adminToken, cashierEmail, ["Cashier"]);

        var managerToken = await LoginAndGetAccessTokenAsync(managerEmail, "User1234!");
        var cashierToken = await LoginAndGetAccessTokenAsync(cashierEmail, "User1234!");

        using var managerCreate = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/categories", managerToken);
        managerCreate.Content = JsonContent.Create(new { name = $"ManagerCat-{Guid.NewGuid():N}", sortOrder = 5, isActive = true });
        using var managerResp = await _client.SendAsync(managerCreate);
        Assert.Equal(HttpStatusCode.OK, managerResp.StatusCode);

        using var cashierCreate = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/categories", cashierToken);
        cashierCreate.Content = JsonContent.Create(new { name = $"CashierCat-{Guid.NewGuid():N}", sortOrder = 6, isActive = true });
        using var cashierResp = await _client.SendAsync(cashierCreate);
        Assert.Equal(HttpStatusCode.Forbidden, cashierResp.StatusCode);
    }

    [Fact]
    public async Task Snapshot_Uses_ReleaseC_Precedence_With_StoreOverride_Manual_And_Inventory()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"precedence-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Tracked product", categoryId = category.Id, basePrice = 15m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var extra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "Tracked extra", price = 3m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using (var putOverride = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/store-overrides", token))
        {
            putOverride.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, state = "Disabled" });
            using var putResp = await _client.SendAsync(putOverride);
            Assert.Equal(HttpStatusCode.OK, putResp.StatusCode);
        }

        using (var putInventory = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token))
        {
            putInventory.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Extra", itemId = extra.Id, onHandQty = 0m });
            using var putResp = await _client.SendAsync(putInventory);
            Assert.Equal(HttpStatusCode.OK, putResp.StatusCode);
        }

        var next = await GetSnapshotAsync(token);
        var productRow = Assert.Single(next.Products, x => x.Id == product.Id);
        var extraRow = Assert.Single(next.Extras, x => x.Id == extra.Id);

        Assert.False(productRow.IsAvailable);
        Assert.Equal("DisabledByStore", productRow.AvailabilityReason);
        Assert.False(extraRow.IsAvailable);
        Assert.Equal("OutOfStock", extraRow.AvailabilityReason);
    }

    [Fact]
    public async Task CatalogInventory_Rejects_OptionItem_With_Stable400()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var snapshot = await GetSnapshotAsync(token);

        using var request = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token);
        request.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "OptionItem", itemId = Guid.NewGuid(), onHandQty = 1m });
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CatalogInventory_Adjustment_For_Product_Updates_Balance_And_Creates_History_With_Audit()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"adj-prod-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Tracked product adj", categoryId = category.Id, basePrice = 25m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token);
        request.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, quantityDelta = 5m, reason = "Purchase", note = "restock" });
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var historyRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/catalog/inventory/adjustments?storeId={snapshot.StoreId:D}&itemType=Product&itemId={product.Id:D}", token);
        using var historyResponse = await _client.SendAsync(historyRequest);
        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);
        var history = (await historyResponse.Content.ReadFromJsonAsync<List<CatalogInventoryAdjustmentResponse>>())!;
        var row = Assert.Single(history);
        Assert.Equal(0m, row.QtyBefore);
        Assert.Equal(5m, row.QtyDelta);
        Assert.Equal(5m, row.QtyAfter);
        Assert.Equal("Purchase", row.Reason);

        using var currentRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/inventory/current?storeId={snapshot.StoreId:D}&itemType=Product", token);
        using var currentResponse = await _client.SendAsync(currentRequest);
        Assert.Equal(HttpStatusCode.OK, currentResponse.StatusCode);
        var rows = (await currentResponse.Content.ReadFromJsonAsync<List<InventoryReportRowResponse>>())!;
        Assert.Contains(rows, x => x.ItemId == product.Id && x.StockOnHandQty == 5m);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        Assert.Contains(await db.AuditLogs.AsNoTracking().ToListAsync(), x => x.Action == "AdjustInventory");
    }


    [Fact]
    public async Task CatalogInventory_Adjustment_History_Exposes_Reference_Metadata_When_Present()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"adj-meta-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Tracked product meta", categoryId = category.Id, basePrice = 25m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using (var manualReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token))
        {
            manualReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, quantityDelta = 5m, reason = "Purchase", note = "manual restock" });
            using var manualResp = await _client.SendAsync(manualReq);
            Assert.Equal(HttpStatusCode.OK, manualResp.StatusCode);
        }

        var saleId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
            var tenantId = snapshot.TenantId;
            var storeId = snapshot.StoreId;
            var itemType = CobranzaDigital.Domain.Entities.CatalogItemType.Product;

            db.CatalogInventoryAdjustments.Add(new CobranzaDigital.Domain.Entities.CatalogInventoryAdjustment
            {
                TenantId = tenantId,
                StoreId = storeId,
                ItemType = itemType,
                ItemId = product.Id,
                QtyBefore = 5m,
                DeltaQty = -2m,
                ResultingOnHandQty = 3m,
                Reason = "SaleConsumption",
                Reference = "sale consumption",
                ReferenceType = "Sale",
                ReferenceId = saleId.ToString("D"),
                MovementKind = "SaleConsumption",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMinutes(1)
            });

            db.CatalogInventoryAdjustments.Add(new CobranzaDigital.Domain.Entities.CatalogInventoryAdjustment
            {
                TenantId = tenantId,
                StoreId = storeId,
                ItemType = itemType,
                ItemId = product.Id,
                QtyBefore = 3m,
                DeltaQty = 2m,
                ResultingOnHandQty = 5m,
                Reason = "VoidReversal",
                Reference = "sale void reversal",
                ReferenceType = "SaleVoid",
                ReferenceId = saleId.ToString("D"),
                MovementKind = "VoidReversal",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMinutes(2)
            });

            await db.SaveChangesAsync();
        }

        using var historyRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/admin/catalog/inventory/adjustments?storeId={snapshot.StoreId:D}&itemType=Product&itemId={product.Id:D}", token);
        using var historyResponse = await _client.SendAsync(historyRequest);
        Assert.Equal(HttpStatusCode.OK, historyResponse.StatusCode);
        var history = (await historyResponse.Content.ReadFromJsonAsync<List<CatalogInventoryAdjustmentResponse>>())!;

        var manualRow = Assert.Single(history, x => x.Reason == "Purchase");
        Assert.Null(manualRow.ReferenceType);
        Assert.Null(manualRow.ReferenceId);
        Assert.Null(manualRow.MovementKind);

        var saleRow = Assert.Single(history, x => x.Reason == "SaleConsumption");
        Assert.Equal("Sale", saleRow.ReferenceType);
        Assert.Equal(saleId, saleRow.ReferenceId);
        Assert.Equal("SaleConsumption", saleRow.MovementKind);

        var voidRow = Assert.Single(history, x => x.Reason == "VoidReversal");
        Assert.Equal("SaleVoid", voidRow.ReferenceType);
        Assert.Equal(saleId, voidRow.ReferenceId);
        Assert.Equal("VoidReversal", voidRow.MovementKind);
    }

    [Fact]
    public async Task CatalogInventory_Adjustment_Validates_OptionItem_Reason_Delta_And_NegativeStock()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var snapshot = await GetSnapshotAsync(token);

        using (var optionReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token))
        {
            optionReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "OptionItem", itemId = Guid.NewGuid(), quantityDelta = 1m, reason = "Purchase" });
            using var optionResp = await _client.SendAsync(optionReq);
            Assert.Equal(HttpStatusCode.BadRequest, optionResp.StatusCode);
        }

        using (var badReasonReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token))
        {
            badReasonReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = Guid.NewGuid(), quantityDelta = 1m, reason = "Invalid" });
            using var badReasonResp = await _client.SendAsync(badReasonReq);
            Assert.Equal(HttpStatusCode.BadRequest, badReasonResp.StatusCode);
        }

        using (var zeroReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token))
        {
            zeroReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = Guid.NewGuid(), quantityDelta = 0m, reason = "Correction" });
            using var zeroResp = await _client.SendAsync(zeroReq);
            Assert.Equal(HttpStatusCode.BadRequest, zeroResp.StatusCode);
        }
    }

    [Fact]
    public async Task CatalogInventory_Adjustment_Rejects_Item_When_Not_Tracked_And_Negative_Result()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"adj-nottracked-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var notTracked = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Not tracked", categoryId = category.Id, basePrice = 15m, isActive = true, isAvailable = true, isInventoryTracked = false });
        var tracked = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Tracked", categoryId = category.Id, basePrice = 18m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using (var notTrackedReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token))
        {
            notTrackedReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = notTracked.Id, quantityDelta = 1m, reason = "Purchase" });
            using var notTrackedResp = await _client.SendAsync(notTrackedReq);
            Assert.Equal(HttpStatusCode.Conflict, notTrackedResp.StatusCode);
        }

        using (var negativeReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token))
        {
            negativeReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = tracked.Id, quantityDelta = -1m, reason = "Waste" });
            using var negativeResp = await _client.SendAsync(negativeReq);
            Assert.Equal(HttpStatusCode.Conflict, negativeResp.StatusCode);
            var payload = await negativeResp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("NEGATIVE_STOCK", payload.GetProperty("reason").GetString());
        }
    }

    [Fact]
    public async Task Inventory_Reports_Low_And_Out_Of_Stock_Work_With_Threshold()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"reports-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Low stock", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var p2 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Out stock", categoryId = category.Id, basePrice = 12m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        await AdjustInventoryAsync(token, snapshot.StoreId, "Product", p1.Id, 2m, "Purchase");
        await AdjustInventoryAsync(token, snapshot.StoreId, "Product", p2.Id, 0m, "Correction", expectStatus: HttpStatusCode.BadRequest);

        using var lowReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/inventory/low-stock?storeId={snapshot.StoreId:D}&threshold=3", token);
        using var lowResp = await _client.SendAsync(lowReq);
        Assert.Equal(HttpStatusCode.OK, lowResp.StatusCode);
        var lowRows = (await lowResp.Content.ReadFromJsonAsync<List<InventoryReportRowResponse>>())!;
        Assert.Contains(lowRows, x => x.ItemId == p1.Id);

        using var outReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/pos/reports/inventory/out-of-stock?storeId={snapshot.StoreId:D}", token);
        using var outResp = await _client.SendAsync(outReq);
        Assert.Equal(HttpStatusCode.OK, outResp.StatusCode);
    }

    [Fact]
    public async Task Snapshot_Denies_User_Without_Allowed_Role()
    {
        var userToken = await RegisterAndGetAccessTokenAsync($"user.snapshot.{Guid.NewGuid():N}@test.local", "User1234!");

        using var snapshotReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", userToken);
        using var snapshotResp = await _client.SendAsync(snapshotReq);

        Assert.Equal(HttpStatusCode.Forbidden, snapshotResp.StatusCode);
    }

    private async Task<SnapshotResponse> GetSnapshotAsync(string token)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", token);
        using var response = await _client.SendAsync(req);
        await AssertStatusAsync(response, HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<SnapshotResponse>())!;
    }

    private async Task<string> GetSnapshotEtagAsync(string token)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", token);
        using var response = await _client.SendAsync(req);

        await AssertStatusAsync(response, HttpStatusCode.OK);
        Assert.True(response.Headers.TryGetValues("ETag", out var etagValues));
        return etagValues!.Single();
    }

    private async Task AssertSnapshotNotModifiedAsync(string token, string etag)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", token);
        req.Headers.TryAddWithoutValidation("If-None-Match", etag);
        using var response = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.NotModified, response.StatusCode);
    }

    private async Task<string> ToggleAvailabilityAndAssertEtagChangedAsync(string token, string previousEtag, Func<Task> updater)
    {
        await updater();

        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", token);
        req.Headers.TryAddWithoutValidation("If-None-Match", previousEtag);
        using var response = await _client.SendAsync(req);

        await AssertStatusAsync(response, HttpStatusCode.OK);
        Assert.True(response.Headers.TryGetValues("ETag", out var etagValues));

        var changedEtag = etagValues!.Single();
        Assert.NotEqual(previousEtag, changedEtag);
        return changedEtag;
    }

    private async Task<List<StoreInventoryItemResponse>> GetInventoryAsync(string token, Guid storeId, string? search = null, bool onlyWithStock = false)
    {
        var query = $"/api/v1/pos/admin/inventory?storeId={storeId:D}";
        if (!string.IsNullOrWhiteSpace(search))
        {
            query += $"&search={Uri.EscapeDataString(search)}";
        }

        if (onlyWithStock)
        {
            query += "&onlyWithStock=true";
        }

        using var request = CreateAuthorizedRequest(HttpMethod.Get, query, token);
        using var response = await _client.SendAsync(request);
        await AssertStatusAsync(response, HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<List<StoreInventoryItemResponse>>())!;
    }

    private async Task UpdateInventorySettingsAsync(string token, bool showOnlyInStock)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/inventory/settings", token);
        request.Content = JsonContent.Create(new { showOnlyInStock });
        using var response = await _client.SendAsync(request);
        await AssertStatusAsync(response, HttpStatusCode.OK);
    }

    private async Task UpsertInventoryAsync(string token, Guid storeId, Guid productId, decimal onHand)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/inventory", token);
        request.Content = JsonContent.Create(new { storeId, productId, onHand });
        using var response = await _client.SendAsync(request);
        await AssertStatusAsync(response, HttpStatusCode.OK);
    }

    private async Task UpsertCatalogInventoryAsync(string token, Guid storeId, Guid productId, decimal onHandQty)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token);
        request.Content = JsonContent.Create(new { storeId, itemType = "Product", itemId = productId, onHandQty, reason = "Correction" });
        using var response = await _client.SendAsync(request);
        await AssertStatusAsync(response, HttpStatusCode.OK);
    }

    private async Task AdjustInventoryAsync(string token, Guid storeId, string itemType, Guid itemId, decimal quantityDelta, string reason, HttpStatusCode expectStatus = HttpStatusCode.OK)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/admin/catalog/inventory/adjustments", token);
        request.Content = JsonContent.Create(new { storeId, itemType, itemId, quantityDelta, reason });
        using var response = await _client.SendAsync(request);
        await AssertStatusAsync(response, expectStatus);
    }

    private async Task UpdateProductAsync(string token, ProductResponse product)
    {
        using var updateReq = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/pos/admin/products/{product.Id}", token);
        updateReq.Content = JsonContent.Create(new
        {
            product.ExternalCode,
            product.Name,
            product.CategoryId,
            product.SubcategoryName,
            product.BasePrice,
            product.IsActive,
            product.IsAvailable,
            product.CustomizationSchemaId,
        });
        using var response = await _client.SendAsync(updateReq);
        await AssertStatusAsync(response, HttpStatusCode.OK);
    }

    private async Task UpdateExtraAsync(string token, ExtraResponse extra)
    {
        using var updateReq = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/pos/admin/extras/{extra.Id}", token);
        updateReq.Content = JsonContent.Create(new { extra.Name, extra.Price, extra.IsActive, extra.IsAvailable });
        using var response = await _client.SendAsync(updateReq);
        await AssertStatusAsync(response, HttpStatusCode.OK);
    }

    private async Task UpdateOptionItemAsync(string token, Guid optionSetId, OptionItemResponse item)
    {
        using var updateReq = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/pos/admin/option-sets/{optionSetId}/items/{item.Id}", token);
        updateReq.Content = JsonContent.Create(new { item.Name, item.IsActive, item.IsAvailable, item.SortOrder });
        using var response = await _client.SendAsync(updateReq);
        await AssertStatusAsync(response, HttpStatusCode.OK);
    }

    private async Task<T> PostAsync<T>(string url, string token, object body)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, url, token);
        req.Content = JsonContent.Create(body);
        using var resp = await _client.SendAsync(req);
        await AssertStatusAsync(resp, HttpStatusCode.OK);
        return (await resp.Content.ReadFromJsonAsync<T>())!;
    }

    [Fact]
    public async Task InventoryV2_Balances_Supports_Pagination_And_Filters()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var categoryA = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-a-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var categoryB = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-b-{Guid.NewGuid():N}", sortOrder = 2, isActive = true });
        var trackedProduct = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Tracked Latte", externalCode = "LAT-V2", categoryId = categoryA.Id, basePrice = 30m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var notTrackedProduct = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Untracked Mocha", externalCode = "MOC-V2", categoryId = categoryB.Id, basePrice = 31m, isActive = true, isAvailable = true, isInventoryTracked = false });
        var trackedExtra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "V2 Shot", price = 5m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using (var upsertTracked = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token))
        {
            upsertTracked.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = trackedProduct.Id, onHandQty = 1.250m });
            using var resp = await _client.SendAsync(upsertTracked);
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        }

        using (var upsertExtra = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token))
        {
            upsertExtra.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Extra", itemId = trackedExtra.Id, onHandQty = 2.500m });
            using var resp = await _client.SendAsync(upsertExtra);
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        }

        using var pageRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={snapshot.StoreId:D}&page=1&pageSize=2", token);
        using var pageResponse = await _client.SendAsync(pageRequest);
        Assert.Equal(HttpStatusCode.OK, pageResponse.StatusCode);
        var paged = (await pageResponse.Content.ReadFromJsonAsync<PagedInventoryBalancesResponse>())!;
        Assert.Equal(1, paged.Page);
        Assert.Equal(2, paged.PageSize);
        Assert.Equal(2, paged.Items.Count);
        Assert.True(paged.TotalCount >= 3);

        using var trackedRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={snapshot.StoreId:D}&tracked=true", token);
        using var trackedResponse = await _client.SendAsync(trackedRequest);
        var trackedRows = (await trackedResponse.Content.ReadFromJsonAsync<PagedInventoryBalancesResponse>())!;
        Assert.All(trackedRows.Items, row => Assert.True(row.IsInventoryTracked));
        Assert.DoesNotContain(trackedRows.Items, row => row.ItemId == notTrackedProduct.Id);

        using var searchRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={snapshot.StoreId:D}&q=LAT-V2", token);
        using var searchResponse = await _client.SendAsync(searchRequest);
        var searchRows = (await searchResponse.Content.ReadFromJsonAsync<PagedInventoryBalancesResponse>())!;
        Assert.Contains(searchRows.Items, row => row.ItemId == trackedProduct.Id);

        using var categoryRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={snapshot.StoreId:D}&categoryId={categoryA.Id:D}", token);
        using var categoryResponse = await _client.SendAsync(categoryRequest);
        var categoryRows = (await categoryResponse.Content.ReadFromJsonAsync<PagedInventoryBalancesResponse>())!;
        Assert.DoesNotContain(categoryRows.Items, row => row.ItemId == notTrackedProduct.Id);
    }

    [Fact]
    public async Task InventoryV2_Balances_Validates_Store_Belongs_To_Tenant()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={Guid.NewGuid():D}", token);
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }


    [Fact]
    public async Task InventoryV2_Adjustments_Are_Idempotent_By_ClientOperationId()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-idem-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Idem Product", externalCode = "IDEM-V2", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);
        var opId = Guid.NewGuid().ToString("D");

        using var req1 = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token);
        req1.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, operationType = "Delta", quantityDelta = 2m, reasonCode = "Correction", clientOperationId = opId });
        using var resp1 = await _client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);
        var first = (await resp1.Content.ReadFromJsonAsync<InventoryAdjustmentV2Response>())!;

        using var req2 = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token);
        req2.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, operationType = "Delta", quantityDelta = 2m, reasonCode = "Correction", clientOperationId = opId });
        using var resp2 = await _client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
        var second = (await resp2.Content.ReadFromJsonAsync<InventoryAdjustmentV2Response>())!;

        Assert.Equal(first.AdjustmentId, second.AdjustmentId);
        Assert.Equal(first.QtyAfter, second.QtyAfter);
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Reject_Negative_Stock()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-neg-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Negative Product", externalCode = "NEG-V2", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token);
        req.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, operationType = "Delta", quantityDelta = -1m, reasonCode = "Waste", clientOperationId = Guid.NewGuid().ToString("D") });
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        var payload = (await resp.Content.ReadFromJsonAsync<JsonElement>());
        Assert.Equal("NEGATIVE_STOCK", payload.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Delta_Concurrent_Requests_Eventually_Succeed()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-delta-con-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Delta Concurrency Product", externalCode = "DELTA-CON-V2", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        async Task<HttpStatusCode> SendDeltaAsync(string clientOperationId)
        {
            using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token);
            req.Content = JsonContent.Create(new
            {
                storeId = snapshot.StoreId,
                itemType = "Product",
                itemId = product.Id,
                operationType = "Delta",
                quantityDelta = 1m,
                reasonCode = "Correction",
                clientOperationId
            });
            using var resp = await _client.SendAsync(req);
            return resp.StatusCode;
        }

        var responses = await Task.WhenAll(
            SendDeltaAsync(Guid.NewGuid().ToString("D")),
            SendDeltaAsync(Guid.NewGuid().ToString("D")));

        Assert.All(responses, code => Assert.Equal(HttpStatusCode.OK, code));

        using var balancesReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={snapshot.StoreId:D}&q=DELTA-CON-V2", token);
        using var balancesResp = await _client.SendAsync(balancesReq);
        Assert.Equal(HttpStatusCode.OK, balancesResp.StatusCode);
        var balances = (await balancesResp.Content.ReadFromJsonAsync<PagedInventoryBalancesResponse>())!;
        var row = Assert.Single(balances.Items, x => x.ItemId == product.Id);
        Assert.Equal(2m, row.OnHandQty);
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Set_Uses_Concurrency_Version()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-con-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Concurrency Product", externalCode = "CON-V2", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using (var seedReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token))
        {
            seedReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, operationType = "Delta", quantityDelta = 3m, reasonCode = "Correction", clientOperationId = Guid.NewGuid().ToString("D") });
            using var seedResp = await _client.SendAsync(seedReq);
            Assert.Equal(HttpStatusCode.OK, seedResp.StatusCode);
        }

        using var balancesReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={snapshot.StoreId:D}&q=CON-V2", token);
        using var balancesResp = await _client.SendAsync(balancesReq);
        var balances = (await balancesResp.Content.ReadFromJsonAsync<PagedInventoryBalancesResponse>())!;
        var row = Assert.Single(balances.Items, x => x.ItemId == product.Id);
        Assert.False(string.IsNullOrWhiteSpace(row.BalanceVersion));

        using var setReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token);
        setReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, operationType = "Set", quantitySet = 2m, expectedVersion = row.BalanceVersion, reasonCode = "ManualCount", clientOperationId = Guid.NewGuid().ToString("D") });
        using var setResp = await _client.SendAsync(setReq);
        Assert.Equal(HttpStatusCode.OK, setResp.StatusCode);

        using var staleReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token);
        staleReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = product.Id, operationType = "Set", quantitySet = 1m, expectedVersion = row.BalanceVersion, reasonCode = "ManualCount", clientOperationId = Guid.NewGuid().ToString("D") });
        using var staleResp = await _client.SendAsync(staleReq);
        Assert.Equal(HttpStatusCode.Conflict, staleResp.StatusCode);
        var stalePayload = (await staleResp.Content.ReadFromJsonAsync<JsonElement>());
        Assert.Equal("CONCURRENCY_CONFLICT", stalePayload.GetProperty("reason").GetString());

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var adjustmentCount = await db.CatalogInventoryAdjustments.AsNoTracking()
            .CountAsync(x => x.StoreId == snapshot.StoreId && x.ItemType.ToString() == "Product" && x.ItemId == product.Id);
        Assert.Equal(2, adjustmentCount);
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Reject_Store_From_Other_Tenant()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments", token);
        req.Content = JsonContent.Create(new { storeId = Guid.NewGuid(), itemType = "Product", itemId = Guid.NewGuid(), operationType = "Delta", quantityDelta = 1m, reasonCode = "Correction", clientOperationId = Guid.NewGuid().ToString("D") });
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }




    [Fact]
    public async Task InventoryV2_Balances_Clamps_PageSize_And_Applies_OnHand_Filters()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-f-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 F1", externalCode = "V2F1", categoryId = category.Id, basePrice = 30m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var p2 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 F2", externalCode = "V2F2", categoryId = category.Id, basePrice = 31m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using (var upsert1 = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token))
        {
            upsert1.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = p1.Id, onHandQty = 0m });
            using var resp = await _client.SendAsync(upsert1);
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        }

        using (var upsert2 = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/inventory", token))
        {
            upsert2.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = p2.Id, onHandQty = 9m });
            using var resp = await _client.SendAsync(upsert2);
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        }

        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances?storeId={snapshot.StoreId:D}&page=1&pageSize=500&onHandMax=0", token);
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = (await response.Content.ReadFromJsonAsync<PagedInventoryBalancesResponse>())!;
        Assert.Equal(200, payload.PageSize);
        Assert.All(payload.Items, row => Assert.True(row.OnHandQty <= 0m));
    }

    [Fact]
    public async Task InventoryV2_Movements_Clamps_PageSize()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-m-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Clamp Product", externalCode = "V2CLAMP", categoryId = category.Id, basePrice = 40m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);
        var now = DateTimeOffset.UtcNow;
        await SeedInventoryMovementAsync(snapshot.StoreId, product.Id, now.AddDays(-1), "Correction", 2m, 1m, "Manual", "manual-1", "admin-1");

        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/movements?storeId={snapshot.StoreId:D}&itemType=Product&itemId={product.Id:D}&page=1&pageSize=500", token);
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = (await response.Content.ReadFromJsonAsync<PagedInventoryMovementsResponse>())!;
        Assert.Equal(200, payload.PageSize);
    }
    [Fact]
    public async Task InventoryV2_Movements_Supports_Pagination_And_Filters()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"inventory-v2-movements-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "V2 Movement Latte", externalCode = "MOV-V2", categoryId = category.Id, basePrice = 30m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        var now = DateTimeOffset.UtcNow;
        await SeedInventoryMovementAsync(snapshot.StoreId, product.Id, now.AddDays(-3), "Correction", 4m, 2m, "Sale", "sale-1", "admin-1");
        await SeedInventoryMovementAsync(snapshot.StoreId, product.Id, now.AddDays(-2), "SaleConsumption", 6m, -1m, "Sale", "sale-2", "admin-1");
        await SeedInventoryMovementAsync(snapshot.StoreId, product.Id, now.AddDays(-1), "VoidReversal", 5m, 1m, "SaleVoid", "void-1", "admin-2");

        using var pageReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/movements?storeId={snapshot.StoreId:D}&itemType=Product&itemId={product.Id:D}&page=1&pageSize=2", token);
        using var pageResp = await _client.SendAsync(pageReq);
        Assert.Equal(HttpStatusCode.OK, pageResp.StatusCode);
        var page = (await pageResp.Content.ReadFromJsonAsync<PagedInventoryMovementsResponse>())!;
        Assert.Equal(2, page.Items.Count);
        Assert.True(page.TotalCount >= 3);
        Assert.Equal(2, page.PageSize);
        Assert.True(page.Items[0].OccurredAtUtc >= page.Items[1].OccurredAtUtc);

        using var reasonReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/movements?storeId={snapshot.StoreId:D}&itemType=Product&itemId={product.Id:D}&reason=SaleConsumption&page=1&pageSize=20", token);
        using var reasonResp = await _client.SendAsync(reasonReq);
        var reasonRows = (await reasonResp.Content.ReadFromJsonAsync<PagedInventoryMovementsResponse>())!;
        Assert.Single(reasonRows.Items);
        Assert.Equal("SaleConsumption", reasonRows.Items[0].ReasonCode);

        var from = Uri.EscapeDataString(now.AddDays(-2).ToString("O"));
        var to = Uri.EscapeDataString(now.AddHours(-12).ToString("O"));
        using var rangeReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/movements?storeId={snapshot.StoreId:D}&itemType=Product&itemId={product.Id:D}&from={from}&to={to}&page=1&pageSize=20", token);
        using var rangeResp = await _client.SendAsync(rangeReq);
        var rangeRows = (await rangeResp.Content.ReadFromJsonAsync<PagedInventoryMovementsResponse>())!;
        Assert.All(rangeRows.Items, row => Assert.InRange(row.OccurredAtUtc, now.AddDays(-2), now));

        using var referenceReq = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/movements?storeId={snapshot.StoreId:D}&itemType=Product&itemId={product.Id:D}&referenceType=Sale&referenceId=sale-2&page=1&pageSize=20", token);
        using var referenceResp = await _client.SendAsync(referenceReq);
        var referenceRows = (await referenceResp.Content.ReadFromJsonAsync<PagedInventoryMovementsResponse>())!;
        Assert.Single(referenceRows.Items);
        Assert.Equal("sale-2", referenceRows.Items[0].ReferenceId);
        Assert.Equal("Sale", referenceRows.Items[0].ReferenceType);
    }

    [Fact]
    public async Task InventoryV2_Movements_Reject_Store_From_Other_Tenant()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/movements?storeId={Guid.NewGuid():D}&itemType=Product&itemId={Guid.NewGuid():D}&page=1&pageSize=20", token);
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Batch_Partial_Apply_And_Replay_Works()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"batch-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Batch P1", externalCode = $"B-P1-{Guid.NewGuid():N}"[..12], categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var p2 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Batch P2", externalCode = $"B-P2-{Guid.NewGuid():N}"[..12], categoryId = category.Id, basePrice = 12m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        var batchId = Guid.NewGuid();
        var payload = new
        {
            storeId = snapshot.StoreId,
            reasonCode = "Correction",
            batchClientOperationId = batchId,
            lines = new object[]
            {
                new { lineNo = 1, itemType = "Product", itemId = p1.Id, deltaQty = 3m },
                new { lineNo = 2, itemType = "Product", itemId = p2.Id, deltaQty = 2m },
                new { lineNo = 3, itemType = "Product", itemId = Guid.NewGuid(), deltaQty = 1m }
            }
        };

        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments/batch", token);
        req.Content = JsonContent.Create(payload);
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var result = (await resp.Content.ReadFromJsonAsync<InventoryBatchAdjustmentV2Response>())!;
        Assert.Equal(2, result.AppliedCount);
        Assert.Equal(1, result.FailedCount);
        Assert.Contains(result.Lines, x => x.LineNo == 3 && x.Status == "Failed" && x.ErrorCode == "UNKNOWN_ITEM");

        using var replayReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments/batch", token);
        replayReq.Content = JsonContent.Create(payload);
        using var replayResp = await _client.SendAsync(replayReq);
        Assert.Equal(HttpStatusCode.OK, replayResp.StatusCode);
        var replay = (await replayResp.Content.ReadFromJsonAsync<InventoryBatchAdjustmentV2Response>())!;
        Assert.Equal(result.AppliedCount, replay.AppliedCount);
        Assert.Equal(result.FailedCount, replay.FailedCount);
        Assert.Equal(result.Lines.Count, replay.Lines.Count);
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Batch_Rejects_Idempotency_Conflict()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"batch-conflict-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Batch Conflict", externalCode = $"BC-{Guid.NewGuid():N}"[..12], categoryId = category.Id, basePrice = 9m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);
        var batchId = Guid.NewGuid();

        using (var req1 = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments/batch", token))
        {
            req1.Content = JsonContent.Create(new
            {
                storeId = snapshot.StoreId,
                reasonCode = "Correction",
                batchClientOperationId = batchId,
                lines = new[] { new { lineNo = 1, itemType = "Product", itemId = p1.Id, deltaQty = 1m } }
            });
            using var resp1 = await _client.SendAsync(req1);
            Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);
        }

        using var req2 = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments/batch", token);
        req2.Content = JsonContent.Create(new
        {
            storeId = snapshot.StoreId,
            reasonCode = "Correction",
            batchClientOperationId = batchId,
            lines = new[] { new { lineNo = 1, itemType = "Product", itemId = p1.Id, deltaQty = 2m } }
        });
        using var resp2 = await _client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Batch_Rejects_Negative_Stock_Line()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"batch-neg-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Batch Negative", externalCode = $"BN-{Guid.NewGuid():N}"[..12], categoryId = category.Id, basePrice = 9m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);

        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments/batch", token);
        req.Content = JsonContent.Create(new
        {
            storeId = snapshot.StoreId,
            reasonCode = "Correction",
            batchClientOperationId = Guid.NewGuid(),
            lines = new[] { new { lineNo = 1, itemType = "Product", itemId = p1.Id, deltaQty = -1m } }
        });
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var result = (await resp.Content.ReadFromJsonAsync<InventoryBatchAdjustmentV2Response>())!;
        Assert.Equal(0, result.AppliedCount);
        Assert.Equal(1, result.FailedCount);
        Assert.Contains(result.Lines, x => x.ErrorCode == "NEGATIVE_STOCK");
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Batch_Validate_No_SideEffects_And_Detects_Negative_Cascade()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"batch-validate-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var tracked = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Batch Validate Tracked", externalCode = $"BV-P1-{Guid.NewGuid():N}"[..12], categoryId = category.Id, basePrice = 11m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var notTracked = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Batch Validate NotTracked", externalCode = $"BV-P2-{Guid.NewGuid():N}"[..12], categoryId = category.Id, basePrice = 11m, isActive = true, isAvailable = true, isInventoryTracked = false });
        var snapshot = await GetSnapshotAsync(token);
        await UpsertCatalogInventoryAsync(token, snapshot.StoreId, tracked.Id, 5m);

        var before = await GetInventoryDbCountersAsync(snapshot.StoreId);

        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments/batch/validate", token);
        req.Content = JsonContent.Create(new
        {
            storeId = snapshot.StoreId,
            reasonCode = "Correction",
            batchClientOperationId = Guid.NewGuid(),
            lines = new object[]
            {
                new { lineNo = 1, itemType = "Product", itemId = tracked.Id, deltaQty = -3m },
                new { lineNo = 2, itemType = "Product", itemId = tracked.Id, deltaQty = -3m },
                new { lineNo = 3, itemType = "Product", itemId = Guid.NewGuid(), deltaQty = 1m },
                new { lineNo = 4, itemType = "Product", itemId = notTracked.Id, deltaQty = 1m }
            }
        });

        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var result = (await resp.Content.ReadFromJsonAsync<InventoryBatchValidationResponse>())!;
        Assert.Equal(1, result.ValidCount);
        Assert.Equal(3, result.InvalidCount);
        Assert.Contains(result.Lines, x => x.LineNo == 1 && x.Status == "Valid" && x.QtyBefore == 5m && x.QtyAfter == 2m);
        Assert.Contains(result.Lines, x => x.LineNo == 2 && x.Status == "Invalid" && x.ErrorCode == "NEGATIVE_STOCK" && x.QtyBefore == 2m && x.QtyAfter == -1m);
        Assert.Contains(result.Lines, x => x.LineNo == 3 && x.Status == "Invalid" && x.ErrorCode == "UNKNOWN_ITEM");
        Assert.Contains(result.Lines, x => x.LineNo == 4 && x.Status == "Invalid" && x.ErrorCode == "NOT_TRACKED");

        var after = await GetInventoryDbCountersAsync(snapshot.StoreId);
        Assert.Equal(before.BalanceCount, after.BalanceCount);
        Assert.Equal(before.AdjustmentCount, after.AdjustmentCount);
        Assert.Equal(before.BatchOperationCount, after.BatchOperationCount);
    }

    [Fact]
    public async Task InventoryV2_Adjustments_Batch_Validate_Reject_Store_From_Other_Tenant()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/inventory/adjustments/batch/validate", token);
        req.Content = JsonContent.Create(new
        {
            storeId = Guid.NewGuid(),
            reasonCode = "Correction",
            batchClientOperationId = Guid.NewGuid(),
            lines = new[] { new { lineNo = 1, itemType = "Product", itemId = Guid.NewGuid(), deltaQty = 1m } }
        });

        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }


    [Fact]
    public async Task CatalogV2_Categories_Export_And_Import_Validate_Apply_Workflow()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        _ = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { categoryCode = "BEB", name = "Bebidas", sortOrder = 1, isActive = true });

        using var exportReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v2/pos/catalog/categories/export", token);
        using var exportResp = await _client.SendAsync(exportReq);
        Assert.Equal(HttpStatusCode.OK, exportResp.StatusCode);
        var csv = await exportResp.Content.ReadAsStringAsync();
        Assert.Contains("categoryCode,name,sortOrder,updatedAtUtc", csv);

        using var validateReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/catalog/categories/import/validate", token);
        validateReq.Content = JsonContent.Create(new
        {
            lines = new[]
            {
                new { lineNo = 1, categoryCode = "BEB", name = "Bebidas X", sortOrder = 1, isActive = true },
                new { lineNo = 2, categoryCode = "BEB", name = "Dup", sortOrder = 1, isActive = true }
            }
        });
        using var validateResp = await _client.SendAsync(validateReq);
        Assert.Equal(HttpStatusCode.OK, validateResp.StatusCode);
        var validation = await validateResp.Content.ReadFromJsonAsync<CatalogImportValidationResponse>();
        Assert.NotNull(validation);
        Assert.Contains(validation!.Lines, x => x.ErrorCode == "DUPLICATE_IN_FILE");

        var batchId = Guid.NewGuid();
        using var applyReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/catalog/categories/import/apply", token);
        applyReq.Content = JsonContent.Create(new
        {
            batchClientOperationId = batchId,
            lines = new[]
            {
                new { lineNo = 1, categoryCode = "BEB", name = "Bebidas X", sortOrder = 2, isActive = true },
                new { lineNo = 2, categoryCode = "POS", name = "Postres", sortOrder = 3, isActive = true }
            }
        });
        using var applyResp = await _client.SendAsync(applyReq);
        Assert.Equal(HttpStatusCode.OK, applyResp.StatusCode);
        var apply = await applyResp.Content.ReadFromJsonAsync<CatalogImportApplyResponse>();
        Assert.Equal(2, apply!.AppliedCount);
    }

    [Fact]
    public async Task CatalogV2_Products_Validate_Unknown_Category_And_Idempotency_Conflict()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        _ = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { categoryCode = "BEB", name = "Bebidas", sortOrder = 1, isActive = true });

        using var validateReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/catalog/products/import/validate", token);
        validateReq.Content = JsonContent.Create(new
        {
            lines = new[]
            {
                new { lineNo = 1, externalCode = "SKU-1", name = "Latte", categoryCode = "UNKNOWN", basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = false, subcategoryName = "" }
            }
        });
        using var validateResp = await _client.SendAsync(validateReq);
        var validation = await validateResp.Content.ReadFromJsonAsync<CatalogImportValidationResponse>();
        Assert.Contains(validation!.Lines, x => x.ErrorCode == "UNKNOWN_CATEGORY");

        var batchId = Guid.NewGuid();
        using var applyReq1 = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/catalog/products/import/apply", token);
        applyReq1.Content = JsonContent.Create(new
        {
            batchClientOperationId = batchId,
            lines = new[]
            {
                new { lineNo = 1, externalCode = "SKU-1", name = "Latte", categoryCode = "BEB", basePrice = 10m, isActive = true, isAvailable = true, isInventoryTracked = false, subcategoryName = "" }
            }
        });
        using var applyResp1 = await _client.SendAsync(applyReq1);
        Assert.Equal(HttpStatusCode.OK, applyResp1.StatusCode);

        using var applyReqConflict = CreateAuthorizedRequest(HttpMethod.Post, "/api/v2/pos/catalog/products/import/apply", token);
        applyReqConflict.Content = JsonContent.Create(new
        {
            batchClientOperationId = batchId,
            lines = new[]
            {
                new { lineNo = 1, externalCode = "SKU-1", name = "Latte XL", categoryCode = "BEB", basePrice = 12m, isActive = true, isAvailable = true, isInventoryTracked = false, subcategoryName = "" }
            }
        });
        using var applyRespConflict = await _client.SendAsync(applyReqConflict);
        Assert.Equal(HttpStatusCode.Conflict, applyRespConflict.StatusCode);
    }

    [Fact]
    public async Task InventoryV2_Balances_Export_Returns_Csv_And_Respects_Filters()
    {
        var token = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        var category = await PostAsync<CategoryResponse>("/api/v1/pos/admin/categories", token, new { name = $"exp-cat-{Guid.NewGuid():N}", sortOrder = 1, isActive = true });
        var tracked = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Export Tracked", externalCode = $"EXP-{Guid.NewGuid():N}"[..12], categoryId = category.Id, basePrice = 15m, isActive = true, isAvailable = true, isInventoryTracked = true });
        var snapshot = await GetSnapshotAsync(token);
        await UpsertCatalogInventoryAsync(token, snapshot.StoreId, tracked.Id, 4m);

        using var req = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v2/pos/inventory/balances/export?storeId={snapshot.StoreId:D}&q=Export%20Tracked&tracked=true", token);
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal("text/csv", resp.Content.Headers.ContentType?.MediaType);
        var csv = await resp.Content.ReadAsStringAsync();
        Assert.Contains("ItemType,ExternalCode,Name,CategoryName,IsInventoryTracked,OnHandQty,UpdatedAtUtc", csv);
        Assert.Contains("Export Tracked", csv);
    }

    private static async Task AssertStatusAsync(HttpResponseMessage response, HttpStatusCode expectedStatus)
    {
        if (response.StatusCode == expectedStatus)
        {
            return;
        }

        var content = response.Content is null ? string.Empty : await response.Content.ReadAsStringAsync();
        Assert.Fail($"Expected HTTP {(int)expectedStatus} ({expectedStatus}) but got {(int)response.StatusCode} ({response.StatusCode}). Body: {content}");
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private async Task<string> RegisterAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private async Task SetUserRolesAsync(string adminToken, string email, string[] roles)
    {
        await EnsureUserScopeForRolesAsync(email, roles);
        var userId = await GetUserIdByEmailAsync(adminToken, email);

        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles", adminToken);
        request.Content = JsonContent.Create(new { roles });
        using var response = await _client.SendAsync(request);

        // Keep compatibility while the endpoint transitions between update semantics (204) and resource return (200).
        Assert.True(response.StatusCode is HttpStatusCode.NoContent or HttpStatusCode.OK);

        using var verifyRequest = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/admin/users/{userId}", adminToken);
        using var verifyResponse = await _client.SendAsync(verifyRequest);
        var user = await verifyResponse.Content.ReadFromJsonAsync<AdminUserResponse>();

        Assert.Equal(HttpStatusCode.OK, verifyResponse.StatusCode);
        Assert.NotNull(user);
        Assert.Equal(roles.OrderBy(x => x), user!.Roles.OrderBy(x => x));
    }


    private async Task EnsureUserScopeForRolesAsync(string email, IReadOnlyCollection<string> roles)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);

        var requiresTenant = roles.Any(role => string.Equals(role, "TenantAdmin", StringComparison.OrdinalIgnoreCase))
            || roles.Any(role => string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase)
                || string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase)
                || string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase));
        var requiresStore = roles.Any(role => string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase));
        var isSuperAdmin = roles.Any(role => string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase));

        if (isSuperAdmin)
        {
            user!.TenantId = null;
            user.StoreId = null;
        }
        else
        {
            if (requiresTenant && !user!.TenantId.HasValue)
            {
                user.TenantId = await db.Tenants.AsNoTracking().OrderBy(x => x.Name).Select(x => (Guid?)x.Id).FirstOrDefaultAsync();
            }

            if (requiresStore && !user.StoreId.HasValue)
            {
                user.StoreId = await db.Stores.AsNoTracking()
                    .Where(x => user.TenantId.HasValue && x.TenantId == user.TenantId.Value)
                    .OrderBy(x => x.Name)
                    .Select(x => (Guid?)x.Id)
                    .FirstOrDefaultAsync();
            }
        }

        var update = await userManager.UpdateAsync(user!);
        Assert.True(update.Succeeded, string.Join("; ", update.Errors.Select(x => x.Description)));
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/admin/users?search={Uri.EscapeDataString(email)}", adminToken);
        using var response = await _client.SendAsync(request);

        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.Single(payload!.Items);

        return payload.Items[0].Id;
    }

    private HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (url.StartsWith("/api/v1/pos/", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("/api/v2/pos/", StringComparison.OrdinalIgnoreCase))
        {
            request.Headers.Add("X-Tenant-Id", _tenantHeaderValue);
        }

        return request;
    }


    private async Task<(int BalanceCount, int AdjustmentCount, int BatchOperationCount)> GetInventoryDbCountersAsync(Guid storeId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var tenantId = Guid.Parse(_tenantHeaderValue);
        var balances = await db.CatalogInventoryBalances.CountAsync(x => x.TenantId == tenantId && x.StoreId == storeId);
        var adjustments = await db.CatalogInventoryAdjustments.CountAsync(x => x.TenantId == tenantId && x.StoreId == storeId);
        var batchOperations = await db.CatalogInventoryBatchOperations.CountAsync(x => x.TenantId == tenantId && x.StoreId == storeId);
        return (balances, adjustments, batchOperations);
    }


    private async Task SeedInventoryMovementAsync(Guid storeId, Guid itemId, DateTimeOffset createdAtUtc, string reason, decimal qtyBefore, decimal deltaQty, string? referenceType, string? referenceId, string? createdByUserId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var tenantId = Guid.Parse(_tenantHeaderValue);
        db.CatalogInventoryAdjustments.Add(new CobranzaDigital.Domain.Entities.CatalogInventoryAdjustment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StoreId = storeId,
            ItemType = CobranzaDigital.Domain.Entities.CatalogItemType.Product,
            ItemId = itemId,
            QtyBefore = qtyBefore,
            DeltaQty = deltaQty,
            ResultingOnHandQty = qtyBefore + deltaQty,
            Reason = reason,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            CreatedAtUtc = createdAtUtc,
            CreatedByUserId = Guid.TryParse(createdByUserId, out var userId) ? userId : null,
        });
        await db.SaveChangesAsync();
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record CategoryResponse(Guid Id, string Name, int SortOrder, bool IsActive);
    private sealed record ProductResponse(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, bool IsAvailable, Guid? CustomizationSchemaId, bool? IsInventoryTracked = null, decimal? StockOnHandQty = null, string? AvailabilityReason = null, string? StoreOverrideState = null);
    private sealed record OptionSetResponse(Guid Id, string Name, bool IsActive);
    private sealed record OptionItemResponse(Guid Id, Guid OptionSetId, string Name, bool IsActive, bool IsAvailable, int SortOrder, string? AvailabilityReason = null, string? StoreOverrideState = null);
    private sealed record SchemaResponse(Guid Id, string Name, bool IsActive);
    private sealed record ExtraResponse(Guid Id, string Name, decimal Price, bool IsActive, bool IsAvailable, bool? IsInventoryTracked = null, decimal? StockOnHandQty = null, string? AvailabilityReason = null, string? StoreOverrideState = null);
    private sealed record CatalogItemOverrideResponse(string ItemType, Guid ItemId, bool IsEnabled, DateTimeOffset UpdatedAtUtc, string ItemName, string? ItemSku, Guid? CatalogTemplateId);
    private sealed record CatalogStoreAvailabilityResponse(Guid StoreId, string ItemType, Guid ItemId, bool IsAvailable, DateTimeOffset UpdatedAtUtc, string ItemName, string? ItemSku);
    private sealed record StoreInventoryItemResponse(Guid StoreId, Guid ProductId, string ProductName, string? ProductSku, decimal OnHand, decimal Reserved, DateTimeOffset? UpdatedAtUtc, bool HasInventoryRow);
    private sealed record CatalogInventoryAdjustmentResponse(Guid Id, Guid StoreId, string ItemType, Guid ItemId, decimal QtyBefore, decimal QtyDelta, decimal QtyAfter, string Reason, string? Reference, string? Note, string? ClientOperationId, DateTimeOffset CreatedAtUtc, Guid? PerformedByUserId, string? ItemName = null, string? ItemSku = null, string? ReferenceType = null, Guid? ReferenceId = null, string? MovementKind = null);
    private sealed record InventoryReportRowResponse(string ItemType, Guid ItemId, string ItemName, string? ItemSku, Guid StoreId, decimal StockOnHandQty, bool IsInventoryTracked, string AvailabilityReason, string? StoreOverrideState, DateTimeOffset? UpdatedAtUtc, DateTimeOffset? LastAdjustmentAtUtc);
    private sealed record InventoryBalanceRowResponse(string ItemType, Guid ItemId, string Name, string? Sku, string? CategoryName, bool IsInventoryTracked, decimal OnHandQty, DateTimeOffset? UpdatedAtUtc, string? BalanceVersion = null);
    private sealed record InventoryAdjustmentV2Response(Guid AdjustmentId, Guid StoreId, string ItemType, Guid ItemId, decimal QtyBefore, decimal QtyAfter, decimal DeltaApplied, string BalanceVersion, DateTimeOffset CreatedAtUtc, string ReasonCode, string? Reference);
    private sealed record InventoryBatchAdjustmentV2Response(Guid BatchClientOperationId, int AppliedCount, int FailedCount, List<InventoryBatchAdjustmentV2LineResponse> Lines);
    private sealed record InventoryBatchAdjustmentV2LineResponse(int LineNo, string ItemType, string? ExternalCode, Guid? ItemId, string Status, string? ErrorCode, string? Message, decimal? QtyBefore, decimal? QtyAfter, decimal? DeltaApplied, Guid? AdjustmentId);
    private sealed record InventoryBatchValidationResponse(Guid StoreId, int TotalLines, int ValidCount, int InvalidCount, List<InventoryBatchValidationLineResponse> Lines);
    private sealed record InventoryBatchValidationLineResponse(int LineNo, string ItemType, string? ExternalCode, Guid? ItemId, string Status, string? ErrorCode, string? Message, decimal? QtyBefore, decimal? QtyAfter, decimal? DeltaQtyNormalized, Guid? ItemResolvedId, string? ItemName);
    private sealed record CatalogImportValidationResponse(int TotalLines, int ValidCount, int InvalidCount, List<CatalogImportValidationLineResponse> Lines);
    private sealed record CatalogImportValidationLineResponse(int LineNo, string Status, string? ErrorCode, string? Message, string? Action, Guid? EntityId);
    private sealed record CatalogImportApplyResponse(Guid BatchClientOperationId, int AppliedCount, int FailedCount, List<CatalogImportApplyLineResponse> Lines);
    private sealed record CatalogImportApplyLineResponse(int LineNo, string Status, string? ErrorCode, string? Message, string? Action, Guid? EntityId);
    private sealed record PagedInventoryBalancesResponse(List<InventoryBalanceRowResponse> Items, int TotalCount, int Page, int PageSize);
    private sealed record InventoryMovementRowResponse(Guid MovementId, DateTimeOffset OccurredAtUtc, string ReasonCode, string? ReferenceType, string? ReferenceId, string? Note, Guid? CreatedByUserId, string? CreatedByDisplayName, decimal DeltaQty, decimal QtyBefore, decimal QtyAfter, string? ClientOperationId, bool HasAnomaly);
    private sealed record PagedInventoryMovementsResponse(List<InventoryMovementRowResponse> Items, int TotalCount, int Page, int PageSize);
    private sealed record SnapshotOverride(Guid Id, Guid ProductId, string GroupKey, bool IsActive, List<Guid> AllowedOptionItemIds);
    private sealed record SnapshotResponse(Guid TenantId, Guid VerticalId, Guid CatalogTemplateId, Guid StoreId, string TimeZoneId, DateTimeOffset GeneratedAtUtc, string CatalogVersion, string EtagSeed, List<ProductResponse> Products, List<OptionItemResponse> OptionItems, List<ExtraResponse> Extras, List<SnapshotOverride> Overrides, string VersionStamp);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem([property: JsonPropertyName("id")] string Id);
    private sealed record AdminUserResponse(string Id, string Email, string UserName, IReadOnlyCollection<string> Roles, bool IsLockedOut, DateTimeOffset? LockoutEnd);
}
