using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Contracts.PosPricing;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosSales;
using CobranzaDigital.Application.Services;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PosPricingQuoteService : IPosPricingQuoteService
{
    private readonly CobranzaDigitalDbContext _db;
    private readonly ITenantContext _tenantContext;

    public PosPricingQuoteService(
        CobranzaDigitalDbContext db,
        ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<PosPricingQuoteResponseDto> QuoteAsync(PosPricingQuoteRequestDto request, CancellationToken ct)
    {
        if (request.Lines.Count == 0)
        {
            return new PosPricingQuoteResponseDto([], new PosPricingQuoteTotalsDto(0m, 0m));
        }

        var tenantId = _tenantContext.EffectiveTenantId;
        if (!tenantId.HasValue)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["tenantId"] = ["A tenant context is required."]
            });
        }

        var storeExists = await _db.Stores.AsNoTracking()
            .AnyAsync(x => x.Id == request.StoreId && x.TenantId == tenantId.Value && x.IsActive, ct)
            .ConfigureAwait(false);
        if (!storeExists)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["storeId"] = ["Store does not exist for the active tenant."]
            });
        }

        var ids = request.Lines.Where(x => x.ProductId.HasValue).Select(x => x.ProductId!.Value).Distinct().ToArray();
        var codes = request.Lines.Where(x => !string.IsNullOrWhiteSpace(x.ExternalCode)).Select(x => x.ExternalCode!.Trim()).Distinct().ToArray();

        var products = await _db.Products.AsNoTracking()
            .Where(x => ids.Contains(x.Id) || (x.ExternalCode != null && codes.Contains(x.ExternalCode)))
            .Select(x => new PosQuoteProductProjection(x.Id, x.ExternalCode, x.BasePrice))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var byId = products.ToDictionary(x => x.Id);
        var byCode = products.Where(x => !string.IsNullOrWhiteSpace(x.ExternalCode)).ToDictionary(x => x.ExternalCode!, x => x);

        var lines = new List<PosPricingQuoteLineResponseDto>(request.Lines.Count);
        decimal subtotal = 0m;

        foreach (var line in request.Lines)
        {
            var product = ResolveProduct(line, byId, byCode);
            var computed = PosPricingQuoteCalculator.ComputeLine(
                line.Qty,
                line.BasePrice ?? product.BasePrice,
                request.TenantPolicy,
                line.Override,
                line.RequestedUnitPrice);

            subtotal += computed.LineSubtotal;
            lines.Add(new PosPricingQuoteLineResponseDto(
                product.Id,
                product.ExternalCode,
                computed.Qty,
                computed.BaseUnitPrice,
                computed.AppliedUnitPrice,
                computed.TierApplied,
                computed.LineSubtotal,
                computed.IsMismatch,
                computed.ExpectedUnitPrice));
        }

        subtotal = PosPricingQuoteCalculator.RoundMoney(subtotal);
        return new PosPricingQuoteResponseDto(lines, new PosPricingQuoteTotalsDto(subtotal, subtotal));
    }

    private static PosQuoteProductProjection ResolveProduct(
        PosPricingQuoteLineRequestDto line,
        IReadOnlyDictionary<Guid, PosQuoteProductProjection> byId,
        IReadOnlyDictionary<string, PosQuoteProductProjection> byCode)
    {
        if (line.ProductId.HasValue && byId.TryGetValue(line.ProductId.Value, out var byIdProduct))
        {
            return byIdProduct;
        }

        if (!string.IsNullOrWhiteSpace(line.ExternalCode) && byCode.TryGetValue(line.ExternalCode.Trim(), out var byCodeProduct))
        {
            return byCodeProduct;
        }

        throw new ValidationException(new Dictionary<string, string[]>
        {
            ["lines"] = ["Product not found for one or more quote lines."]
        });
    }

    private sealed record PosQuoteProductProjection(Guid Id, string? ExternalCode, decimal BasePrice);
}
