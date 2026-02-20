using System.Security.Claims;

using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Infrastructure.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class TenantContextService : ITenantContext
{
    private const string TenantOverrideHeader = "X-Tenant-Id";

    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly Lazy<Task<TenantResolution>> _resolution;

    public TenantContextService(IHttpContextAccessor httpContextAccessor, UserManager<ApplicationUser> userManager)
    {
        _httpContextAccessor = httpContextAccessor;
        _userManager = userManager;
        _resolution = new Lazy<Task<TenantResolution>>(ResolveAsync);
    }

    public Guid? TenantId => _resolution.Value.GetAwaiter().GetResult().TenantId;

    public Guid? EffectiveTenantId => _resolution.Value.GetAwaiter().GetResult().EffectiveTenantId;

    public bool IsPlatformAdmin => _resolution.Value.GetAwaiter().GetResult().IsPlatformAdmin;

    public string? TenantSlug => _httpContextAccessor.HttpContext?.User.FindFirstValue("tenantSlug");

    private async Task<TenantResolution> ResolveAsync()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return new TenantResolution(false, null, null);
        }

        var tenantOverride = ResolveTenantOverride();

        if (user.IsInRole("SuperAdmin"))
        {
            return new TenantResolution(true, null, tenantOverride);
        }

        var tenantId = await ResolveTenantIdForUserAsync(user).ConfigureAwait(false);
        if (!tenantId.HasValue)
        {
            return new TenantResolution(false, null, null);
        }

        if (tenantOverride.HasValue && tenantOverride.Value != tenantId.Value)
        {
            throw new ForbiddenException("Tenant override is only available for SuperAdmin.");
        }

        return new TenantResolution(false, tenantId, tenantId);
    }

    private async Task<Guid?> ResolveTenantIdForUserAsync(ClaimsPrincipal user)
    {
        var claimValue = user.FindFirstValue("tenantId");
        if (Guid.TryParse(claimValue, out var tenantIdFromClaim))
        {
            return tenantIdFromClaim;
        }

        var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            return null;
        }

        var appUser = await _userManager.FindByIdAsync(userId.ToString()).ConfigureAwait(false);
        return appUser?.TenantId;
    }

    private Guid? ResolveTenantOverride()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        var headerValue = httpContext.Request.Headers[TenantOverrideHeader].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(headerValue))
        {
            if (!Guid.TryParse(headerValue, out var parsedHeaderTenantId))
            {
                throw new ValidationException(new Dictionary<string, string[]> { [TenantOverrideHeader] = ["X-Tenant-Id must be a valid guid."] });
            }

            return parsedHeaderTenantId;
        }

        var queryValue = httpContext.Request.Query["tenantId"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(queryValue))
        {
            return null;
        }

        if (!Guid.TryParse(queryValue, out var parsedQueryTenantId))
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["tenantId"] = ["tenantId must be a valid guid."] });
        }

        return parsedQueryTenantId;
    }

    private sealed record TenantResolution(bool IsPlatformAdmin, Guid? TenantId, Guid? EffectiveTenantId);
}
