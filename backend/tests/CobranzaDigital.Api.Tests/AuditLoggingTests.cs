using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CobranzaDigital.Infrastructure.Auditing;
using CobranzaDigital.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace CobranzaDigital.Api.Tests;

public sealed class AuditLoggerTests
{
    [Fact]
    public async Task LogAsync_SerializesBeforeAndAfter_WithCamelCase()
    {
        var options = new DbContextOptionsBuilder<CobranzaDigitalDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        await using var dbContext = new CobranzaDigitalDbContext(options);
        var sut = new AuditLogger(dbContext, NullLogger<AuditLogger>.Instance);

        await sut.LogAsync(new Application.Auditing.AuditEntry(
            Action: "LockUser",
            UserId: Guid.NewGuid(),
            CorrelationId: "corr-1",
            EntityType: "User",
            EntityId: "abc",
            Before: new { IsLocked = false },
            After: new { IsLocked = true },
            Source: "Api",
            Notes: "test")).ConfigureAwait(false);

        var saved = await dbContext.AuditLogs.SingleAsync().ConfigureAwait(false);

        Assert.Equal("{\"isLocked\":false}", saved.BeforeJson);
        Assert.Equal("{\"isLocked\":true}", saved.AfterJson);
    }

    [Fact]
    public async Task LogAsync_DoesNotThrow_WhenDbFails()
    {
        var options = new DbContextOptionsBuilder<CobranzaDigitalDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        var dbContext = new CobranzaDigitalDbContext(options);
        await dbContext.DisposeAsync().ConfigureAwait(false);

        var sut = new AuditLogger(dbContext, NullLogger<AuditLogger>.Instance);

        await sut.LogAsync(new Application.Auditing.AuditEntry(
            Action: "CreateRole",
            UserId: Guid.NewGuid(),
            CorrelationId: "corr-fail",
            EntityType: "Role",
            EntityId: "Backoffice",
            Before: null,
            After: new { name = "Backoffice" },
            Source: "Api",
            Notes: null)).ConfigureAwait(false);
    }
}

public sealed class AdminAuditIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public AdminAuditIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateRole_PersistsAuditLog_WithCorrelationIdAndUserId()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!").ConfigureAwait(false);
        const string correlationId = "test-correlation-role";
        var roleName = $"RoleAudit{Guid.NewGuid():N}";

        using var request = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/admin/roles", adminToken);
        request.Headers.Add("X-Correlation-Id", correlationId);
        request.Content = JsonContent.Create(new { name = roleName });

        using var response = await _client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var audit = await dbContext.AuditLogs
            .OrderByDescending(x => x.OccurredAt)
            .FirstAsync(x => x.Action == "CreateRole" && x.EntityId == roleName)
            .ConfigureAwait(false);

        Assert.Equal("Role", audit.EntityType);
        Assert.Equal(correlationId, audit.CorrelationId);
        Assert.NotNull(audit.UserId);
    }

    [Fact]
    public async Task LockUser_PersistsAuditLog_WithCorrelationIdAndUserId()
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!").ConfigureAwait(false);
        var targetEmail = $"lock.audit.{Guid.NewGuid():N}@test.local";
        await RegisterAsync(targetEmail, "User1234!").ConfigureAwait(false);
        var userId = await GetUserIdByEmailAsync(adminToken, targetEmail).ConfigureAwait(false);

        const string correlationId = "test-correlation-lock";
        using var request = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/admin/users/{userId}/lock", adminToken);
        request.Headers.Add("X-Correlation-Id", correlationId);
        request.Content = JsonContent.Create(new { lock = true });

        using var response = await _client.SendAsync(request).ConfigureAwait(false);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var audit = await dbContext.AuditLogs
            .OrderByDescending(x => x.OccurredAt)
            .FirstAsync(x => x.Action == "LockUser" && x.EntityId == userId)
            .ConfigureAwait(false);

        Assert.Equal("User", audit.EntityType);
        Assert.Equal(correlationId, audit.CorrelationId);
        Assert.NotNull(audit.UserId);
        Assert.Equal("{\"locked\":false}", audit.BeforeJson);
        Assert.Equal("{\"locked\":true}", audit.AfterJson);
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password }).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        var authResponse = await response.Content.ReadFromJsonAsync<AuthTokensResponse>(JsonOptions).ConfigureAwait(false);
        Assert.NotNull(authResponse);
        return authResponse!.AccessToken;
    }

    private async Task RegisterAsync(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password }).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    private async Task<string> GetUserIdByEmailAsync(string adminToken, string email)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, $"/api/v1/admin/users?search={Uri.EscapeDataString(email)}", adminToken);
        using var response = await _client.SendAsync(request).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<PagedResponse>(JsonOptions).ConfigureAwait(false);
        Assert.NotNull(payload);

        return payload!.Items.Single().Id;
    }

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken);

    private sealed record PagedResponse(int Total, IReadOnlyList<AdminUserDtoResponse> Items);

    private sealed record AdminUserDtoResponse(string Id, string Email, string UserName, IReadOnlyList<string> Roles, bool IsLockedOut, DateTimeOffset? LockoutEnd);
}
