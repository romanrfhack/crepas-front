using Asp.Versioning;
using CobranzaDigital.Application.Contracts.PosSales;
using CobranzaDigital.Application.Interfaces.PosSales;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/sales")]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosSalesController : ControllerBase
{
    private readonly IPosSalesService _service;

    public PosSalesController(IPosSalesService service)
    {
        _service = service;
    }

    [HttpPost]
    public Task<CreateSaleResponseDto> Create([FromBody] CreateSaleRequestDto request, CancellationToken ct)
    {
        return _service.CreateSaleAsync(request, ct);
    }
}
