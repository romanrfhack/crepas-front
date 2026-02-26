using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PosShiftIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
    , IAsyncLifetime
{
    private const string TestDataPrefix = "IT-PosShift";
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public PosShiftIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => CleanupTestDataAsync();

    public Task DisposeAsync() => CleanupTestDataAsync();

    [Fact]
    public async Task CreateSale_MixedPayments_OK_AndClosePreviewExpectedCashOnlyCashPortion()
    {
        var cashier = await CreateCashierAsync("cashier.mixedpayments");
        var storeId = await EnsureOpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000101"));
        var product = await CreateProductAsync(expectedBasePrice: 120m);

        await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000111"),
            product.ProductId,
            quantity: 1,
            payments:
            [
                new PaymentInput("Cash", 20m, null),
                new PaymentInput("Card", 100m, "MIXED-REF-001")
            ],
            storeId);

        using var currentReq = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/current", cashier.Token);
        using var currentResp = await _client.SendAsync(currentReq);
        Assert.Equal(HttpStatusCode.OK, currentResp.StatusCode);

        using var previewReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/close-preview", cashier.Token);
        previewReq.Content = JsonContent.Create(new { });
        using var previewResp = await _client.SendAsync(previewReq);
        var preview = await previewResp.Content.ReadFromJsonAsync<ShiftClosePreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(20m, preview!.ExpectedCashAmount);
        Assert.Equal(20m, preview.Breakdown.CashAmount);
        Assert.Equal(100m, preview.Breakdown.CardAmount);
        Assert.Equal(0m, preview.Breakdown.TransferAmount);
    }

    [Fact]
    public async Task ClosePreview_WithCashCount_ReturnsCountedAndDifference()
    {
        var cashier = await CreateCashierAsync("cashier.previewcount");
        var storeId = await EnsureOpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000201"));
        var product = await CreateProductAsync(expectedBasePrice: 30m);

        await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000211"),
            product.ProductId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 30m, null)],
            storeId);

        using var previewReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/close-preview", cashier.Token);
        previewReq.Content = JsonContent.Create(new
        {
            cashCount = new[]
            {
                new { denominationValue = 100m, count = 1 }
            }
        });

        using var previewResp = await _client.SendAsync(previewReq);
        var preview = await previewResp.Content.ReadFromJsonAsync<ShiftClosePreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(100m, preview!.CountedCashAmount);
        Assert.Equal(70m, preview.Difference);
    }

    [Fact]
    public async Task CloseShift_WhenDifferenceExceedsThreshold_RequiresCloseReason()
    {
        var cashier = await CreateCashierAsync("cashier.threshold");
        var storeId = await EnsureOpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000301"));
        var product = await CreateProductAsync(expectedBasePrice: 20m);

        await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000311"),
            product.ProductId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 20m, null)],
            storeId);

        await SetCashDifferenceThresholdAsync(1m);

        using var closeWithoutReason = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/close", cashier.Token);
        closeWithoutReason.Content = JsonContent.Create(new
        {
            countedDenominations = new[] { new { denominationValue = 100m, count = 1 } },
            clientOperationId = Guid.Parse("00000000-0000-0000-0000-000000000321")
        });

        using var closeWithoutReasonResp = await _client.SendAsync(closeWithoutReason);
        Assert.Contains(closeWithoutReasonResp.StatusCode, new[] { HttpStatusCode.BadRequest, HttpStatusCode.UnprocessableEntity });

        using var closeWithReason = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/close", cashier.Token);
        closeWithReason.Content = JsonContent.Create(new
        {
            countedDenominations = new[] { new { denominationValue = 100m, count = 1 } },
            closeReason = "DiffValidatedBySupervisor",
            clientOperationId = Guid.Parse("00000000-0000-0000-0000-000000000322")
        });

        using var closeWithReasonResp = await _client.SendAsync(closeWithReason);
        Assert.Equal(HttpStatusCode.OK, closeWithReasonResp.StatusCode);
    }

    [Fact]
    public async Task VoidSale_ExcludedFromClosePreview()
    {
        var cashier = await CreateCashierAsync("cashier.voidexcluded");
        var storeId = await EnsureOpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000401"));
        var product = await CreateProductAsync(expectedBasePrice: 120m);

        var createdSale = await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000411"),
            product.ProductId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 120m, null)],
            storeId);

        var beforeVoidPreview = await GetClosePreviewAsync(cashier.Token);
        Assert.Equal(120m, beforeVoidPreview.ExpectedCashAmount);

        using var voidReq = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{createdSale.SaleId}/void", cashier.Token);
        voidReq.Content = JsonContent.Create(new
        {
            reasonCode = "CashierError",
            reasonText = "captura",
            note = "Release 1 validation",
            clientVoidId = Guid.Parse("00000000-0000-0000-0000-000000000412")
        });

        using var voidResp = await _client.SendAsync(voidReq);
        Assert.Equal(HttpStatusCode.OK, voidResp.StatusCode);

        var afterVoidPreview = await GetClosePreviewAsync(cashier.Token);
        Assert.Equal(0m, afterVoidPreview.ExpectedCashAmount);
        Assert.Equal(0m, afterVoidPreview.Breakdown.CashAmount);
    }

    [Fact]
    public async Task VoidSale_Idempotent_ByClientVoidId()
    {
        var cashier = await CreateCashierAsync("cashier.voididempotent");
        var storeId = await EnsureOpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000501"));
        var product = await CreateProductAsync(expectedBasePrice: 40m);

        var createdSale = await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000511"),
            product.ProductId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 40m, null)],
            storeId);

        var clientVoidId = Guid.Parse("00000000-0000-0000-0000-000000000512");
        var voidBody = new { reasonCode = "CashierError", reasonText = "correction", note = "idempotent", clientVoidId };

        using var voidReq1 = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{createdSale.SaleId}/void", cashier.Token);
        voidReq1.Content = JsonContent.Create(voidBody);
        using var voidResp1 = await _client.SendAsync(voidReq1);
        var payload1 = await voidResp1.Content.ReadFromJsonAsync<VoidSaleResponse>();

        using var voidReq2 = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{createdSale.SaleId}/void", cashier.Token);
        voidReq2.Content = JsonContent.Create(voidBody);
        using var voidResp2 = await _client.SendAsync(voidReq2);
        var payload2 = await voidResp2.Content.ReadFromJsonAsync<VoidSaleResponse>();

        Assert.Equal(HttpStatusCode.OK, voidResp1.StatusCode);
        Assert.Equal(HttpStatusCode.OK, voidResp2.StatusCode);
        Assert.NotNull(payload1);
        Assert.NotNull(payload2);
        Assert.Equal(payload1!.VoidedAtUtc, payload2!.VoidedAtUtc);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var dbSale = await db.Sales.AsNoTracking().SingleAsync(x => x.Id == createdSale.SaleId);
        Assert.Equal(SaleStatus.Void, dbSale.Status);
        Assert.Equal(clientVoidId, dbSale.ClientVoidId);
    }

    [Fact]
    public async Task VoidSale_CashierCannotVoidOtherCashier_403()
    {
        var cashierA = await CreateCashierAsync("cashier.void.owner");
        var cashierB = await CreateCashierAsync("cashier.void.other");
        var storeId = await EnsureOpenShiftAsync(cashierA.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000601"));
        var product = await CreateProductAsync(expectedBasePrice: 50m);

        var createdSale = await CreateSaleAsync(
            cashierA.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000611"),
            product.ProductId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 50m, null)],
            storeId);

        using var voidReq = CreateAuthorizedRequest(HttpMethod.Post, $"/api/v1/pos/sales/{createdSale.SaleId}/void", cashierB.Token);
        voidReq.Content = JsonContent.Create(new
        {
            reasonCode = "CashierError",
            reasonText = "forbidden",
            note = "cross cashier void",
            clientVoidId = Guid.Parse("00000000-0000-0000-0000-000000000612")
        });

        using var voidResp = await _client.SendAsync(voidReq);
        Assert.Equal(HttpStatusCode.Forbidden, voidResp.StatusCode);
    }

    [Fact]
    public async Task StoreIdOmitted_UsesDefaultStore_ForShiftAndSale()
    {
        var cashier = await CreateCashierAsync("cashier.defaultstore");

        var defaultStoreId = await GetDefaultStoreIdAsync();
        var resolvedStoreId = await EnsureOpenShiftAsync(cashier.Token, openingCashAmount: 10m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000701"));
        var currentShift = await GetCurrentShiftAsync(cashier.Token);

        var product = await CreateProductAsync(expectedBasePrice: 10m);
        var sale = await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000711"),
            product.ProductId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 10m, null)],
            resolvedStoreId);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var dbShift = await db.PosShifts.AsNoTracking().SingleAsync(x => x.Id == currentShift.Id);
        var dbSale = await db.Sales.AsNoTracking().SingleAsync(x => x.Id == sale.SaleId);

        Assert.Equal(defaultStoreId, dbShift.StoreId);
        Assert.Equal(defaultStoreId, dbSale.StoreId);
    }

    private async Task<(Guid ProductId, decimal BasePrice)> CreateProductAsync(decimal expectedBasePrice)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var uniqueSuffix = Guid.NewGuid().ToString("N");
        var catalogTemplateId = await db.CatalogTemplates.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => x.Id)
            .FirstAsync();

        var category = new Category
        {
            Id = Guid.NewGuid(),
            CatalogTemplateId = catalogTemplateId,
            Name = $"{TestDataPrefix}-Category-{uniqueSuffix}",
            SortOrder = 1,
            IsActive = true
        };
        db.Categories.Add(category);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CatalogTemplateId = catalogTemplateId,
            Name = $"{TestDataPrefix}-Product-{uniqueSuffix}",
            CategoryId = category.Id,
            BasePrice = expectedBasePrice,
            IsActive = true
        };

        db.Products.Add(product);
        await db.SaveChangesAsync();

        var persistedPrice = await db.Products.AsNoTracking()
            .Where(x => x.Id == product.Id)
            .Select(x => x.BasePrice)
            .SingleAsync();

        Assert.Equal(expectedBasePrice, persistedPrice);
        return (product.Id, persistedPrice);
    }

    private async Task SetCashDifferenceThresholdAsync(decimal threshold)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var settings = await db.PosSettings.OrderBy(x => x.Id).FirstAsync();
        settings.CashDifferenceThreshold = threshold;
        await db.SaveChangesAsync();
    }

    private async Task<ShiftClosePreviewResponse> GetClosePreviewAsync(string token)
    {
        using var previewReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/close-preview", token);
        previewReq.Content = JsonContent.Create(new { });
        using var previewResp = await _client.SendAsync(previewReq);
        var preview = await previewResp.Content.ReadFromJsonAsync<ShiftClosePreviewResponse>();
        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        Assert.NotNull(preview);
        return preview!;
    }

    private async Task<PosShiftResponse> GetCurrentShiftAsync(string token)
    {
        using var request = CreateAuthorizedRequest(HttpMethod.Get, "/api/v1/pos/shifts/current", token);
        using var response = await _client.SendAsync(request);
        var shift = await response.Content.ReadFromJsonAsync<PosShiftResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(shift);
        return shift!;
    }

    private async Task<Guid> GetDefaultStoreIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        return await db.PosSettings.AsNoTracking().OrderBy(x => x.Id).Select(x => x.DefaultStoreId).FirstAsync();
    }

    private async Task<Guid> EnsureOpenShiftAsync(string token, decimal openingCashAmount, Guid clientOperationId, Guid? storeId = null)
    {
        var resolvedStoreId = storeId ?? await GetDefaultStoreIdAsync();

        using var openReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/open", token);
        openReq.Content = JsonContent.Create(new
        {
            openingCashAmount,
            clientOperationId,
            storeId = resolvedStoreId
        });

        using var openResp = await _client.SendAsync(openReq);
        Assert.Equal(HttpStatusCode.OK, openResp.StatusCode);
        return resolvedStoreId;
    }

    private async Task<CreateSaleResponse> CreateSaleAsync(
        string token,
        Guid clientSaleId,
        Guid productId,
        int quantity,
        IReadOnlyCollection<PaymentInput> payments,
        Guid? storeId = null)
    {
        var resolvedStoreId = storeId ?? await GetDefaultStoreIdAsync();

        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        req.Content = JsonContent.Create(new
        {
            clientSaleId,
            storeId = resolvedStoreId,
            items = new[]
            {
                new
                {
                    productId,
                    quantity,
                    selections = Array.Empty<object>(),
                    extras = Array.Empty<object>()
                }
            },
            payments = payments.Select(x => new
            {
                method = x.Method,
                amount = x.Amount,
                reference = x.Reference
            }).ToArray()
        });

        using var resp = await _client.SendAsync(req);
        var created = await resp.Content.ReadFromJsonAsync<CreateSaleResponse>();
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.NotNull(created);
        return created!;
    }

    private async Task CleanupTestDataAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var testUserIds = await db.Users
            .Where(x => x.Email != null && EF.Functions.Like(x.Email, $"%+{TestDataPrefix.ToLowerInvariant()}-%"))
            .Select(x => x.Id)
            .ToArrayAsync();

        if (testUserIds.Length > 0)
        {
            var saleIds = await db.Sales
                .Where(x => testUserIds.Contains(x.CreatedByUserId) || (x.VoidedByUserId.HasValue && testUserIds.Contains(x.VoidedByUserId.Value)))
                .Select(x => x.Id)
                .ToArrayAsync();

            var saleItemIds = saleIds.Length == 0
                ? []
                : await db.SaleItems.Where(x => saleIds.Contains(x.SaleId)).Select(x => x.Id).ToArrayAsync();

            if (saleItemIds.Length > 0)
            {
                await db.SaleItemSelections.Where(x => saleItemIds.Contains(x.SaleItemId)).ExecuteDeleteAsync();
                await db.SaleItemExtras.Where(x => saleItemIds.Contains(x.SaleItemId)).ExecuteDeleteAsync();
            }

            if (saleIds.Length > 0)
            {
                await db.Payments.Where(x => saleIds.Contains(x.SaleId)).ExecuteDeleteAsync();
                await db.SaleItems.Where(x => saleIds.Contains(x.SaleId)).ExecuteDeleteAsync();
                await db.Sales.Where(x => saleIds.Contains(x.Id)).ExecuteDeleteAsync();
            }

            await db.PosShifts.Where(x => testUserIds.Contains(x.OpenedByUserId)).ExecuteDeleteAsync();
        }

        await db.Products.Where(x => EF.Functions.Like(x.Name, $"{TestDataPrefix}-%")).ExecuteDeleteAsync();
        await db.Categories.Where(x => EF.Functions.Like(x.Name, $"{TestDataPrefix}-%")).ExecuteDeleteAsync();
    }

    private async Task<(string Email, string Token)> CreateCashierAsync(string email)
    {
        var uniqueEmail = $"{email}+{TestDataPrefix.ToLowerInvariant()}-{Guid.NewGuid():N}@test.local";
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        _ = await RegisterAndGetAccessTokenAsync(uniqueEmail, "User1234!");
        await SetUserRolesAsync(adminToken, uniqueEmail, ["Cashier"]);
        var cashierToken = await LoginAndGetAccessTokenAsync(uniqueEmail, "User1234!");
        return (uniqueEmail, cashierToken);
    }

    private async Task<string> RegisterAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new { email, password });
        var payload = await response.Content.ReadFromJsonAsync<AuthTokensResponse>();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return payload!.AccessToken;
    }

    private async Task<string> LoginAndGetAccessTokenAsync(string email, string password)
    {
        using var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
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

        Assert.True(response.StatusCode is HttpStatusCode.NoContent or HttpStatusCode.OK);
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
                || string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
                || string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase)
                || string.Equals(role, "Cashier", StringComparison.OrdinalIgnoreCase));
        var requiresStore = roles.Any(role => string.Equals(role, "AdminStore", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
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

    private static HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private sealed record AuthTokensResponse(string AccessToken, string RefreshToken, DateTime AccessTokenExpiresAt, string TokenType);
    private sealed record PagedResponse(List<UserListItem> Items);
    private sealed record UserListItem([property: JsonPropertyName("id")] string Id);
    private sealed record PaymentInput(string Method, decimal Amount, string? Reference);
    private sealed record CreateSaleResponse(Guid SaleId, string Folio, DateTimeOffset OccurredAtUtc, decimal Total);
    private sealed record VoidSaleResponse(Guid SaleId, SaleStatus Status, DateTimeOffset VoidedAtUtc);
    private sealed record PosShiftResponse(Guid Id, DateTimeOffset OpenedAtUtc, DateTimeOffset? ClosedAtUtc, decimal OpeningCashAmount, decimal? ClosingCashAmount, string? Notes, Guid StoreId);
    private sealed record ShiftClosePreviewResponse(Guid ShiftId, decimal ExpectedCashAmount, decimal? CountedCashAmount, decimal? Difference, ShiftPaymentBreakdownResponse Breakdown);
    private sealed record ShiftPaymentBreakdownResponse(decimal CashAmount, decimal CardAmount, decimal TransferAmount, int TotalSalesCount);
}
