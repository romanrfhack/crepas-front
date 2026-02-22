using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CobranzaDigital.Api.Tests;

public sealed class PosCatalogIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly HttpClient _client;

    public PosCatalogIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _client = factory.CreateClient();
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
        var p1 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stock P1", categoryId = category.Id, basePrice = 55m, isActive = true, isAvailable = true });
        var p2 = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "Stock P2", categoryId = category.Id, basePrice = 65m, isActive = true, isAvailable = true });

        var snapshot = await GetSnapshotAsync(token);

        await UpdateInventorySettingsAsync(token, true);

        try
        {
            await UpsertInventoryAsync(token, snapshot.StoreId, p1.Id, 5m);
            await UpsertInventoryAsync(token, snapshot.StoreId, p2.Id, 0m);

            var etag = await GetSnapshotEtagAsync(token);

            var stockFilteredSnapshot = await GetSnapshotAsync(token);
            Assert.Contains(stockFilteredSnapshot.Products, x => x.Id == p1.Id);
            Assert.DoesNotContain(stockFilteredSnapshot.Products, x => x.Id == p2.Id);

            await UpsertInventoryAsync(token, snapshot.StoreId, p2.Id, 3m);
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

        var snapshot = await GetSnapshotAsync(token);
        var etag = await GetSnapshotEtagAsync(token);

        using (var disableReq = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/overrides", token))
        {
            disableReq.Content = JsonContent.Create(new { itemType = "Product", itemId = p2.Id, isEnabled = false });
            using var disableResp = await _client.SendAsync(disableReq);
            Assert.Equal(HttpStatusCode.OK, disableResp.StatusCode);
        }

        using (var availabilityReq = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/availability", token))
        {
            availabilityReq.Content = JsonContent.Create(new { storeId = snapshot.StoreId, itemType = "Product", itemId = p1.Id, isAvailable = false });
            using var availabilityResp = await _client.SendAsync(availabilityReq);
            Assert.Equal(HttpStatusCode.OK, availabilityResp.StatusCode);
        }

        var filteredSnapshot = await GetSnapshotAsync(token);
        Assert.DoesNotContain(filteredSnapshot.Products, x => x.Id == p2.Id);
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
            using var availabilityReq = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/catalog/availability", token);
            availabilityReq.Content = JsonContent.Create(new { storeId = filteredSnapshot.StoreId, itemType = "Product", itemId = p1.Id, isAvailable = true });
            using var availabilityResp = await _client.SendAsync(availabilityReq);
            Assert.Equal(HttpStatusCode.OK, availabilityResp.StatusCode);
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
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SnapshotResponse>())!;
    }

    private async Task<string> GetSnapshotEtagAsync(string token)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/catalog/snapshot", token);
        using var response = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<StoreInventoryItemResponse>>())!;
    }

    private async Task UpdateInventorySettingsAsync(string token, bool showOnlyInStock)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/inventory/settings", token);
        request.Content = JsonContent.Create(new { showOnlyInStock });
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task UpsertInventoryAsync(string token, Guid storeId, Guid productId, decimal onHand)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Put, "/api/v1/pos/admin/inventory", token);
        request.Content = JsonContent.Create(new { storeId, productId, onHand });
        using var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
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
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task UpdateExtraAsync(string token, ExtraResponse extra)
    {
        using var updateReq = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/pos/admin/extras/{extra.Id}", token);
        updateReq.Content = JsonContent.Create(new { extra.Name, extra.Price, extra.IsActive, extra.IsAvailable });
        using var response = await _client.SendAsync(updateReq);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task UpdateOptionItemAsync(string token, Guid optionSetId, OptionItemResponse item)
    {
        using var updateReq = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/pos/admin/option-sets/{optionSetId}/items/{item.Id}", token);
        updateReq.Content = JsonContent.Create(new { item.Name, item.IsActive, item.IsAvailable, item.SortOrder });
        using var response = await _client.SendAsync(updateReq);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<T> PostAsync<T>(string url, string token, object body)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, url, token);
        req.Content = JsonContent.Create(body);
        using var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        return (await resp.Content.ReadFromJsonAsync<T>())!;
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

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record CategoryResponse(Guid Id, string Name, int SortOrder, bool IsActive);
    private sealed record ProductResponse(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, bool IsAvailable, Guid? CustomizationSchemaId);
    private sealed record OptionSetResponse(Guid Id, string Name, bool IsActive);
    private sealed record OptionItemResponse(Guid Id, Guid OptionSetId, string Name, bool IsActive, bool IsAvailable, int SortOrder);
    private sealed record SchemaResponse(Guid Id, string Name, bool IsActive);
    private sealed record ExtraResponse(Guid Id, string Name, decimal Price, bool IsActive, bool IsAvailable);
    private sealed record CatalogItemOverrideResponse(string ItemType, Guid ItemId, bool IsEnabled, DateTimeOffset UpdatedAtUtc, string ItemName, string? ItemSku, Guid? CatalogTemplateId);
    private sealed record CatalogStoreAvailabilityResponse(Guid StoreId, string ItemType, Guid ItemId, bool IsAvailable, DateTimeOffset UpdatedAtUtc, string ItemName, string? ItemSku);
    private sealed record StoreInventoryItemResponse(Guid StoreId, Guid ProductId, string ProductName, string? ProductSku, decimal OnHand, decimal Reserved, DateTimeOffset? UpdatedAtUtc, bool HasInventoryRow);
    private sealed record SnapshotOverride(Guid Id, Guid ProductId, string GroupKey, bool IsActive, List<Guid> AllowedOptionItemIds);
    private sealed record SnapshotResponse(Guid TenantId, Guid VerticalId, Guid CatalogTemplateId, Guid StoreId, string TimeZoneId, DateTimeOffset GeneratedAtUtc, string CatalogVersion, string EtagSeed, List<ProductResponse> Products, List<SnapshotOverride> Overrides, string VersionStamp);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem([property: JsonPropertyName("id")] string Id);
    private sealed record AdminUserResponse(string Id, string Email, string UserName, IReadOnlyCollection<string> Roles, bool IsLockedOut, DateTimeOffset? LockoutEnd);
}
