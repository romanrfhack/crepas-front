using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

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

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record CategoryResponse(Guid Id, string Name, int SortOrder, bool IsActive);
    private sealed record ProductResponse(Guid Id, string? ExternalCode, string Name, Guid CategoryId, string? SubcategoryName, decimal BasePrice, bool IsActive, Guid? CustomizationSchemaId);
    private sealed record OptionSetResponse(Guid Id, string Name, bool IsActive);
    private sealed record OptionItemResponse(Guid Id, Guid OptionSetId, string Name, bool IsActive, int SortOrder);
    private sealed record SchemaResponse(Guid Id, string Name, bool IsActive);
    private sealed record ExtraResponse(Guid Id, string Name, decimal Price, bool IsActive);
    private sealed record SnapshotOverride(Guid Id, Guid ProductId, string GroupKey, bool IsActive, List<Guid> AllowedOptionItemIds);
    private sealed record SnapshotResponse(List<ProductResponse> Products, List<SnapshotOverride> Overrides, string VersionStamp);
}
