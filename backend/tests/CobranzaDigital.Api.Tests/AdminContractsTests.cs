using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace CobranzaDigital.Api.Tests;

public sealed class AdminContractsTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly HttpClient _client;

    public AdminContractsTests(CobranzaDigitalApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/api/v1/admin/users?page=1")]
    [InlineData("/api/v1/admin/users?pageNumber=1")]
    public async Task GetUsers_PagingContractSupportsPageAndPageNumber(string uri)
    {
        var accessToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var request = CreateAuthorizedRequest(HttpMethod.Get, uri, accessToken);
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PutLockUser_CompatibilityRouteReturnsSuccess()
    {
        var userEmail = "contract.lock.user@test.local";
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        await RegisterAsync(userEmail, "User1234!");

        var userId = await GetUserIdByEmailAsync(adminToken, userEmail);

        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}/lock", adminToken);
        request.Content = JsonContent.Create(new { @lock = true });

        using var response = await _client.SendAsync(request);

        Assert.True(
            response.StatusCode is HttpStatusCode.OK or HttpStatusCode.NoContent,
            $"Expected 200/204 from lock compatibility endpoint but got {(int)response.StatusCode} ({response.StatusCode}).");
    }

    [Fact]
    public async Task GetRoles_ReturnsRoleObjectsWithName()
    {
        var accessToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");

        using var request = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/admin/roles", accessToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<List<RoleContractDto>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);
        Assert.NotEmpty(payload!);
        Assert.All(payload!, role => Assert.False(string.IsNullOrWhiteSpace(role.Name)));
    }

    private async Task RegisterAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        var rawBody = await response.Content.ReadAsStringAsync();

        Assert.True(
            response.IsSuccessStatusCode,
            $"Expected register to return success for {email} but got {(int)response.StatusCode} ({response.StatusCode}). Body: {rawBody}");
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(payload);

        return payload!.AccessToken;
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        using var request = CreateAuthorizedRequest(
            HttpMethod.Get,
            $"/api/v1/admin/users?search={Uri.EscapeDataString(email)}",
            adminToken);
        using var response = await _client.SendAsync(request);
        var payload = await response.Content.ReadFromJsonAsync<PagedUsersResponse>();

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

    private sealed record PagedUsersResponse(int Total, List<UserSummary> Items);

    private sealed record UserSummary(string Id);

    private sealed record RoleContractDto(string Name);
}
