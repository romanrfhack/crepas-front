using Asp.Versioning;
using CobranzaDigital.Api.FeatureManagement;
using CobranzaDigital.Api.Observability;
using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Contracts.Admin;
using CobranzaDigital.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace CobranzaDigital.Api.Controllers.Admin;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/roles")]
[Authorize(Policy = AuthorizationPolicies.AdminOnly)]
[Tags("Admin - Roles")]
[FeatureFlag("Features:UserAdmin")]
public sealed class AdminRolesController : ControllerBase
{
    private readonly IUserAdminService _userAdminService;
    private readonly IAuditLogger _auditLogger;
    private readonly IAuditRequestContextAccessor _auditRequestContextAccessor;
    private readonly ILogger<AdminRolesController> _logger;

    public AdminRolesController(
        IUserAdminService userAdminService,
        IAuditLogger auditLogger,
        IAuditRequestContextAccessor auditRequestContextAccessor,
        ILogger<AdminRolesController> logger)
    {
        _userAdminService = userAdminService;
        _auditLogger = auditLogger;
        _auditRequestContextAccessor = auditRequestContextAccessor;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<AdminRoleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetRoles(CancellationToken cancellationToken)
    {
        IReadOnlyCollection<string> roles = await _userAdminService.GetRolesAsync(cancellationToken).ConfigureAwait(false);
        var roleDtos = roles.Select(roleName => new AdminRoleDto(roleName)).ToArray();
        return Ok(roleDtos);
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request, CancellationToken cancellationToken)
    {
        var roleName = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(roleName))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["name"] = ["Role name is required."]
            }));
        }

        await _userAdminService.CreateRoleAsync(roleName, cancellationToken).ConfigureAwait(false);

        var correlationId = _auditRequestContextAccessor.GetCorrelationId();
        var userId = _auditRequestContextAccessor.GetUserId();

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.CreateRole,
                userId,
                correlationId,
                EntityType: "Role",
                EntityId: roleName,
                Before: null,
                After: new { name = roleName },
                Source: "Api",
                Notes: null),
            cancellationToken).ConfigureAwait(false);

        _logger.LogInformation(
            "audit_log_written action={Action} entity={EntityType} entityId={EntityId} correlationId={CorrelationId} userId={UserId}",
            AuditActions.CreateRole,
            "Role",
            roleName,
            correlationId,
            userId);

        return CreatedAtAction(nameof(GetRoles), new { }, new { name = roleName });
    }

    [HttpDelete("{name}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteRole(string name, CancellationToken cancellationToken)
    {
        await _userAdminService.DeleteRoleAsync(name, cancellationToken).ConfigureAwait(false);

        var roleName = name.Trim();
        var correlationId = _auditRequestContextAccessor.GetCorrelationId();
        var userId = _auditRequestContextAccessor.GetUserId();

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.DeleteRole,
                userId,
                correlationId,
                EntityType: "Role",
                EntityId: roleName,
                Before: new { name = roleName },
                After: null,
                Source: "Api",
                Notes: null),
            cancellationToken).ConfigureAwait(false);

        _logger.LogInformation(
            "audit_log_written action={Action} entity={EntityType} entityId={EntityId} correlationId={CorrelationId} userId={UserId}",
            AuditActions.DeleteRole,
            "Role",
            roleName,
            correlationId,
            userId);

        return NoContent();
    }
}

public sealed class CreateRoleRequest
{
    [Required]
    [StringLength(64, MinimumLength = 2)]
    public string Name { get; init; } = string.Empty;
}
