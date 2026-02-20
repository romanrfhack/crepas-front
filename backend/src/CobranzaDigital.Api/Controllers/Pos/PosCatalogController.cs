using Asp.Versioning;

using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Application.Interfaces.PosCatalog;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/pos/catalog")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[Authorize(Policy = AuthorizationPolicies.PosOperator)]
public sealed class PosCatalogController : ControllerBase
{
    private readonly IPosCatalogService _service;
    private readonly ITenantContext _tenantContext;

    public PosCatalogController(IPosCatalogService service, ITenantContext tenantContext)
    {
        _service = service;
        _tenantContext = tenantContext;
    }

    [HttpGet("snapshot")]
    public async Task<IActionResult> GetSnapshot([FromQuery] Guid? storeId, CancellationToken ct)
    {
        if (!storeId.HasValue)
        {
            var validation = PosTenantGuard.EnsureTenantSelectedForOperation(this, _tenantContext);
            if (validation is not null)
            {
                return validation;
            }
        }

        var etag = await _service.ComputeCatalogEtagAsync(ct).ConfigureAwait(false);
        Response.Headers[HeaderNames.ETag] = etag;
        Response.Headers[HeaderNames.CacheControl] = "public, max-age=60";

        var ifNoneMatch = Request.Headers.IfNoneMatch.ToString();
        if (!string.IsNullOrWhiteSpace(ifNoneMatch) && string.Equals(ifNoneMatch, etag, StringComparison.Ordinal))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var snapshot = await _service.GetSnapshotAsync(storeId, ct).ConfigureAwait(false);
        return Ok(snapshot);
    }
}
