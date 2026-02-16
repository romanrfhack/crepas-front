using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Tests;

public sealed class PosShiftIntegrationTests : IClassFixture<CobranzaDigitalApiFactory>
{
    private readonly CobranzaDigitalApiFactory _factory;
    private readonly HttpClient _client;

    public PosShiftIntegrationTests(CobranzaDigitalApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateSale_MixedPayments_OK_AndClosePreviewExpectedCashOnlyCashPortion()
    {
        var cashier = await CreateCashierAsync("cashier.mixedpayments@test.local");
        await CloseAnyOpenShiftAsync();

        await OpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000101"));
        var productId = await SeedOrGetAnyProductIdAsync();

        await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000111"),
            productId,
            quantity: 1,
            payments:
            [
                new PaymentInput("Cash", 20m, null),
                new PaymentInput("Card", 100m, "MIXED-REF-001")
            ]);

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
        var cashier = await CreateCashierAsync("cashier.previewcount@test.local");
        await CloseAnyOpenShiftAsync();

        await OpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000201"));
        var productId = await SeedOrGetAnyProductIdAsync();

        await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000211"),
            productId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 30m, null)]);

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
        var cashier = await CreateCashierAsync("cashier.threshold@test.local");
        await CloseAnyOpenShiftAsync();

        await OpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000301"));
        var productId = await SeedOrGetAnyProductIdAsync();

        await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000311"),
            productId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 20m, null)]);

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
        var cashier = await CreateCashierAsync("cashier.voidexcluded@test.local");
        await CloseAnyOpenShiftAsync();

        await OpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000401"));
        var productId = await SeedOrGetAnyProductIdAsync();

        var createdSale = await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000411"),
            productId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 120m, null)]);

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
        var cashier = await CreateCashierAsync("cashier.voididempotent@test.local");
        await CloseAnyOpenShiftAsync();

        await OpenShiftAsync(cashier.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000501"));
        var productId = await SeedOrGetAnyProductIdAsync();

        var createdSale = await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000511"),
            productId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 40m, null)]);

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
        var cashierA = await CreateCashierAsync("cashier.void.owner@test.local");
        var cashierB = await CreateCashierAsync("cashier.void.other@test.local");
        await CloseAnyOpenShiftAsync();

        await OpenShiftAsync(cashierA.Token, openingCashAmount: 0m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000601"));
        var productId = await SeedOrGetAnyProductIdAsync();

        var createdSale = await CreateSaleAsync(
            cashierA.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000611"),
            productId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 50m, null)]);

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
        var cashier = await CreateCashierAsync("cashier.defaultstore@test.local");
        await CloseAnyOpenShiftAsync();

        var defaultStoreId = await GetDefaultStoreIdAsync();
        await OpenShiftAsync(cashier.Token, openingCashAmount: 10m, clientOperationId: Guid.Parse("00000000-0000-0000-0000-000000000701"));
        var currentShift = await GetCurrentShiftAsync(cashier.Token);

        var productId = await SeedOrGetAnyProductIdAsync();
        var sale = await CreateSaleAsync(
            cashier.Token,
            clientSaleId: Guid.Parse("00000000-0000-0000-0000-000000000711"),
            productId,
            quantity: 1,
            payments: [new PaymentInput("Cash", 10m, null)]);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var dbShift = await db.PosShifts.AsNoTracking().SingleAsync(x => x.Id == currentShift.Id);
        var dbSale = await db.Sales.AsNoTracking().SingleAsync(x => x.Id == sale.SaleId);

        Assert.Equal(defaultStoreId, dbShift.StoreId);
        Assert.Equal(defaultStoreId, dbSale.StoreId);
    }

    private async Task<Guid> SeedOrGetAnyProductIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var existingProduct = await db.Products.AsNoTracking().Where(x => x.IsActive).Select(x => x.Id).FirstOrDefaultAsync();
        if (existingProduct != Guid.Empty)
        {
            return existingProduct;
        }

        var category = await db.Categories.FirstOrDefaultAsync(x => x.IsActive);
        if (category is null)
        {
            category = new Category
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                Name = "Integration Tests",
                SortOrder = 1,
                IsActive = true
            };
            db.Categories.Add(category);
        }

        var product = new Product
        {
            Id = Guid.Parse("10000000-0000-0000-0000-000000000002"),
            Name = "Integration Product",
            CategoryId = category.Id,
            BasePrice = 120m,
            IsActive = true
        };

        db.Products.Add(product);
        await db.SaveChangesAsync();
        return product.Id;
    }

    private async Task SetCashDifferenceThresholdAsync(decimal threshold)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();
        var settings = await db.PosSettings.FirstAsync();
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
        return await db.PosSettings.AsNoTracking().Select(x => x.DefaultStoreId).FirstAsync();
    }

    private async Task OpenShiftAsync(string token, decimal openingCashAmount, Guid clientOperationId)
    {
        using var openReq = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/shifts/open", token);
        openReq.Content = JsonContent.Create(new
        {
            openingCashAmount,
            clientOperationId
        });

        using var openResp = await _client.SendAsync(openReq);
        Assert.Equal(HttpStatusCode.OK, openResp.StatusCode);
    }

    private async Task<CreateSaleResponse> CreateSaleAsync(
        string token,
        Guid clientSaleId,
        Guid productId,
        int quantity,
        IReadOnlyCollection<PaymentInput> payments)
    {
        using var req = CreateAuthorizedRequest(HttpMethod.Post, "/api/v1/pos/sales", token);
        req.Content = JsonContent.Create(new
        {
            clientSaleId,
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

    private async Task CloseAnyOpenShiftAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CobranzaDigitalDbContext>();

        var openShifts = await db.PosShifts.Where(x => x.ClosedAtUtc == null).ToListAsync();
        if (openShifts.Count == 0)
        {
            return;
        }

        var closedAtUtc = DateTimeOffset.UtcNow;
        foreach (var shift in openShifts)
        {
            shift.ClosedAtUtc = closedAtUtc;
            shift.ClosingCashAmount ??= shift.OpeningCashAmount;
            shift.CloseNotes ??= "Closed by integration test setup.";
        }

        await db.SaveChangesAsync();
    }

    private async Task<(string Email, string Token)> CreateCashierAsync(string email)
    {
        var adminToken = await LoginAndGetAccessTokenAsync("admin@test.local", "Admin1234!");
        _ = await RegisterAndGetAccessTokenAsync(email, "User1234!");
        await SetUserRolesAsync(adminToken, email, ["Cashier"]);
        var cashierToken = await LoginAndGetAccessTokenAsync(email, "User1234!");
        return (email, cashierToken);
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
        var userId = await GetUserIdByEmailAsync(adminToken, email);

        using var request = CreateAuthorizedRequest(HttpMethod.Put, $"/api/v1/admin/users/{userId}/roles", adminToken);
        request.Content = JsonContent.Create(new { roles });
        using var response = await _client.SendAsync(request);

        Assert.True(response.StatusCode is HttpStatusCode.NoContent or HttpStatusCode.OK);
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
