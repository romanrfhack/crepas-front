using System.ComponentModel.DataAnnotations;

using Asp.Versioning;

using CobranzaDigital.Api.FeatureManagement;
using CobranzaDigital.Api.Observability;
using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Contracts.Admin;
using CobranzaDigital.Application.Interfaces;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Admin;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/users")]
[Authorize(Policy = AuthorizationPolicies.UserAdminAccess)]
[Tags("Admin - Users")]
[FeatureFlag("Features:UserAdmin")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly IUserAdminService _userAdminService;
    private readonly IAuditLogger _auditLogger;
    private readonly IAuditRequestContextAccessor _auditRequestContextAccessor;
    private readonly ILogger<AdminUsersController> _logger;
    private static readonly Action<ILogger, int, Exception?> _logLegacyPaginationUsage =
        LoggerMessage.Define<int>(
            LogLevel.Information,
            new EventId(1, nameof(LogLegacyPaginationUsage)),
            "Using legacy pagination query parameter 'pageNumber' with value {PageNumber}.");

    private static readonly Action<ILogger, string, Exception?> _logCompatibilityEndpointUsage =
        LoggerMessage.Define<string>(
            LogLevel.Information,
            new EventId(2, nameof(LogCompatibilityEndpointUsage)),
            "Using compatibility endpoint PUT /admin/users/{UserId}/lock.");

    private static readonly Action<ILogger, string, string, string, string?, Guid?, Exception?> _logAuditWritten =
        LoggerMessage.Define<string, string, string, string?, Guid?>(
            LogLevel.Information,
            new EventId(3, nameof(LogAuditWritten)),
            "audit_log_written action={Action} entity={EntityType} entityId={EntityId} correlationId={CorrelationId} userId={UserId}");

    public AdminUsersController(
        IUserAdminService userAdminService,
        IAuditLogger auditLogger,
        IAuditRequestContextAccessor auditRequestContextAccessor,
        ILogger<AdminUsersController> logger)
    {
        _userAdminService = userAdminService;
        _auditLogger = auditLogger;
        _auditRequestContextAccessor = auditRequestContextAccessor;
        _logger = logger;
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateAdminUserResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateUser(
        [FromBody] CreateAdminUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userAdminService.CreateUserAsync(
            new CreateAdminUserRequestDto(
                request.Email,
                request.UserName,
                request.Role,
                request.TenantId,
                request.StoreId,
                request.TemporaryPassword),
            cancellationToken).ConfigureAwait(false);

        var correlationId = _auditRequestContextAccessor.GetCorrelationId();
        var userId = _auditRequestContextAccessor.GetUserId();

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.CreateUser,
                userId,
                correlationId,
                EntityType: "User",
                EntityId: result.Id,
                Before: null,
                After: new
                {
                    result.Email,
                    result.UserName,
                    result.TenantId,
                    result.StoreId,
                    role = result.Roles.FirstOrDefault()
                },
                Source: "Api",
                Notes: null),
            cancellationToken).ConfigureAwait(false);

        LogAuditWritten(_logger, AuditActions.CreateUser, "User", result.Id, correlationId, userId);

        return CreatedAtAction(nameof(GetUserById), new { id = result.Id, version = "1" }, result);
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
        [FromQuery] Guid? tenantId = null,
        [FromQuery] Guid? storeId = null,
        CancellationToken cancellationToken = default)
    {
        var effectivePage = pageNumber ?? page;
        if (pageNumber.HasValue)
        {
            LogLegacyPaginationUsage(_logger, pageNumber.Value);
        }

        if (effectivePage <= 0 || pageSize <= 0)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["pagination"] = ["page and pageSize must be greater than 0."]
            }));
        }

        var result = await _userAdminService.GetUsersAsync(search, tenantId, storeId, effectivePage, pageSize, cancellationToken).ConfigureAwait(false);
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

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateUser(
        string id,
        [FromBody] UpdateAdminUserRequest request,
        CancellationToken cancellationToken)
    {
        var before = await _userAdminService.GetUserByIdAsync(id, cancellationToken).ConfigureAwait(false);
        var result = await _userAdminService.UpdateUserAsync(
            id,
            new UpdateAdminUserRequestDto(request.UserName, request.TenantId, request.StoreId),
            cancellationToken).ConfigureAwait(false);

        var correlationId = _auditRequestContextAccessor.GetCorrelationId();
        var actorUserId = _auditRequestContextAccessor.GetUserId();

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.UpdateUser,
                actorUserId,
                correlationId,
                EntityType: "User",
                EntityId: result.Id,
                Before: new
                {
                    before.UserName,
                    before.TenantId,
                    before.StoreId
                },
                After: new
                {
                    result.UserName,
                    result.TenantId,
                    result.StoreId,
                    roles = before.Roles
                },
                Source: "Api",
                Notes: null),
            cancellationToken).ConfigureAwait(false);

        LogAuditWritten(_logger, AuditActions.UpdateUser, "User", result.Id, correlationId, actorUserId);

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

    [HttpPost("{id}/temporary-password")]
    [ProducesResponseType(typeof(SetTemporaryPasswordResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SetTemporaryPassword(
        string id,
        [FromBody] SetTemporaryPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userAdminService.SetTemporaryPasswordAsync(
            id,
            new SetTemporaryPasswordRequestDto(request.TemporaryPassword),
            cancellationToken).ConfigureAwait(false);

        var correlationId = _auditRequestContextAccessor.GetCorrelationId();
        var actorUserId = _auditRequestContextAccessor.GetUserId();

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.ResetUserPassword,
                actorUserId,
                correlationId,
                EntityType: "User",
                EntityId: result.Id,
                Before: null,
                After: new
                {
                    action = "temporary password reset",
                    result.Email,
                    result.UserName,
                    roles = result.Roles,
                    result.TenantId,
                    result.StoreId
                },
                Source: "Api",
                Notes: null),
            cancellationToken).ConfigureAwait(false);

        LogAuditWritten(_logger, AuditActions.ResetUserPassword, "User", result.Id, correlationId, actorUserId);
        return Ok(result);
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
        LogCompatibilityEndpointUsage(_logger, id);
        return await SetLockInternal(id, request, cancellationToken).ConfigureAwait(false);
    }

    private async Task<IActionResult> SetLockInternal(
        string id,
        SetUserLockRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _userAdminService.SetUserLockAsync(id, request.Lock, cancellationToken).ConfigureAwait(false);

        var action = request.Lock ? AuditActions.LockUser : AuditActions.UnlockUser;
        var correlationId = _auditRequestContextAccessor.GetCorrelationId();
        var userId = _auditRequestContextAccessor.GetUserId();

        await _auditLogger.LogAsync(new AuditEntry(
                action,
                userId,
                correlationId,
                EntityType: "User",
                EntityId: id,
                Before: new { locked = !request.Lock },
                After: new { locked = request.Lock },
                Source: "Api",
                Notes: null),
            cancellationToken).ConfigureAwait(false);

        LogAuditWritten(_logger, action, "User", id, correlationId, userId);

        return Ok(result);
    }
    private static void LogLegacyPaginationUsage(ILogger logger, int pageNumber)
    {
        _logLegacyPaginationUsage(logger, pageNumber, null);
    }

    private static void LogCompatibilityEndpointUsage(ILogger logger, string userId)
    {
        _logCompatibilityEndpointUsage(logger, userId, null);
    }

    private static void LogAuditWritten(
        ILogger logger,
        string action,
        string entityType,
        string entityId,
        string? correlationId,
        Guid? userId)
    {
        _logAuditWritten(logger, action, entityType, entityId, correlationId, userId, null);
    }

}

public sealed class UpdateUserRolesRequest
{
    [Required]
    [MinLength(1)]
    public string[] Roles { get; init; } = [];
}

public sealed class CreateAdminUserRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    public string UserName { get; init; } = string.Empty;

    [Required]
    public string Role { get; init; } = string.Empty;

    public Guid? TenantId { get; init; }

    public Guid? StoreId { get; init; }

    [Required]
    public string TemporaryPassword { get; init; } = string.Empty;
}

public sealed class SetUserLockRequest
{
    public bool Lock { get; init; }
}

public sealed class UpdateAdminUserRequest
{
    [Required]
    public string UserName { get; init; } = string.Empty;

    public Guid? TenantId { get; init; }

    public Guid? StoreId { get; init; }
}

public sealed class SetTemporaryPasswordRequest
{
    [Required]
    [MinLength(8)]
    public string TemporaryPassword { get; init; } = string.Empty;
}
