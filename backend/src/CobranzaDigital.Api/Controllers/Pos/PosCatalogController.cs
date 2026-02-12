using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces.PosCatalog;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/catalog")]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosCatalogController : ControllerBase
{
    private readonly IPosCatalogService _service;
    public PosCatalogController(IPosCatalogService service) => _service = service;

    [HttpGet("snapshot")]
    public Task<CatalogSnapshotDto> GetSnapshot(CancellationToken ct) => _service.GetSnapshotAsync(ct);
}
