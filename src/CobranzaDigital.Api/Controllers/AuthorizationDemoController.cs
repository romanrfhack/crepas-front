using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/authorization")]
public sealed class AuthorizationDemoController : ControllerBase
{
    [HttpGet("protected")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    [Authorize(Policy = AuthorizationPolicies.RequireScope)]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public IActionResult GetProtectedResource()
    {
        return Ok(new
        {
            Message = "Authorized access granted.",
            RequiredRole = "Admin",
            RequiredScope = AuthorizationPolicies.RequiredScopeValue
        });
    }
}
