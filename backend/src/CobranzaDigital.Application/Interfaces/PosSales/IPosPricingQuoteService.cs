using CobranzaDigital.Application.Contracts.PosPricing;

namespace CobranzaDigital.Application.Interfaces.PosSales;

public interface IPosPricingQuoteService
{
    Task<PosPricingQuoteResponseDto> QuoteAsync(PosPricingQuoteRequestDto request, CancellationToken ct);
}
