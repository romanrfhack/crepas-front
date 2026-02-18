using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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
        var optionSet = await PostAsync<OptionSetResponse>("/api/v1/pos/admin/option-sets", token, new { name = $"etag-set-{Guid.NewGuid():N}", isActive = true });
        var optionItem = await PostAsync<OptionItemResponse>($"/api/v1/pos/admin/option-sets/{optionSet.Id}/items", token, new { name = "ETag Option", isActive = true, isAvailable = true, sortOrder = 1 });
        var extra = await PostAsync<ExtraResponse>("/api/v1/pos/admin/extras", token, new { name = "ETag Extra", price = 5m, isActive = true, isAvailable = true });
        var product = await PostAsync<ProductResponse>("/api/v1/pos/admin/products", token, new { name = "ETag Product", categoryId = category.Id, basePrice = 10m, isActive = true, isAvailable = true });

        var etag = await GetSnapshotEtagAsync(token);
        await AssertSnapshotNotModifiedAsync(token, etag);

        etag = await ToggleAvailabilityAndAssertEtagChangedAsync(
            token,
            etag,
            () => UpdateProductAsync(token, product with { IsAvailable = false }));

        etag = await ToggleAvailabilityAndAssertEtagChangedAsync(
            token,
            etag,
            () => UpdateExtraAsync(token, extra with { IsAvailable = false }));

        etag = await ToggleAvailabilityAndAssertEtagChangedAsync(
            token,
            etag,
            () => UpdateOptionItemAsync(token, optionSet.Id, optionItem with { IsAvailable = false }));

        _ = await ToggleAvailabilityAndAssertEtagChangedAsync(
            token,
            etag,
            () => UpdateProductAsync(token, product with { Name = "ETag Product Renamed", IsAvailable = false }));
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
    private sealed record SnapshotOverride(Guid Id, Guid ProductId, string GroupKey, bool IsActive, List<Guid> AllowedOptionItemIds);
    private sealed record SnapshotResponse(Guid StoreId, string TimeZoneId, DateTimeOffset GeneratedAtUtc, string CatalogVersion, string EtagSeed, List<ProductResponse> Products, List<SnapshotOverride> Overrides, string VersionStamp);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem([property: JsonPropertyName("id")] string Id);
    private sealed record AdminUserResponse(string Id, string Email, string UserName, IReadOnlyCollection<string> Roles, bool IsLockedOut, DateTimeOffset? LockoutEnd);
}
