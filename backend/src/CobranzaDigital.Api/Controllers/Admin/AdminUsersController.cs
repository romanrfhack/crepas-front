using Asp.Versioning;
using CobranzaDigital.Api.FeatureManagement;
using CobranzaDigital.Application.Contracts.Admin;
using CobranzaDigital.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace CobranzaDigital.Api.Controllers.Admin;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/users")]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Tags("Admin - Users")]
[FeatureFlag("Features:UserAdmin")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly IUserAdminService _userAdminService;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(IUserAdminService userAdminService, ILogger<AdminUsersController> logger)
    {
        _userAdminService = userAdminService;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<AdminUserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int? pageNumber = null,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var effectivePage = pageNumber ?? page;
        if (pageNumber.HasValue)
        {
            _logger.LogInformation("Using legacy pagination query parameter 'pageNumber' with value {PageNumber}.", pageNumber.Value);
        }

        if (effectivePage <= 0 || pageSize <= 0)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["pagination"] = ["page and pageSize must be greater than 0."]
            }));
        }

        var result = await _userAdminService.GetUsersAsync(search, effectivePage, pageSize, cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUserById(string id, CancellationToken cancellationToken)
    {
        var result = await _userAdminService.GetUserByIdAsync(id, cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    [HttpPut("{id}/roles")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ReplaceUserRoles(
        string id,
        [FromBody] UpdateUserRolesRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userAdminService.ReplaceUserRolesAsync(id, request.Roles, cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    [HttpPost("{id}/lock")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SetLock(
        string id,
        [FromBody] SetUserLockRequest request,
        CancellationToken cancellationToken)
    {
        return await SetLockInternal(id, request, cancellationToken).ConfigureAwait(false);
    }

    [HttpPut("{id}/lock")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SetLockCompatibility(
        string id,
        [FromBody] SetUserLockRequest request,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Using compatibility endpoint PUT /admin/users/{UserId}/lock.", id);
        return await SetLockInternal(id, request, cancellationToken).ConfigureAwait(false);
    }

    private async Task<IActionResult> SetLockInternal(
        string id,
        SetUserLockRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userAdminService.SetUserLockAsync(id, request.Lock, cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }
}

public sealed class UpdateUserRolesRequest
{
    [Required]
    [MinLength(1)]
    public string[] Roles { get; init; } = [];
}

public sealed class SetUserLockRequest
{
    public bool Lock { get; init; }
}
