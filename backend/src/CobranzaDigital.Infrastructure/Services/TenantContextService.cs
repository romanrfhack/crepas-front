using System.Security.Claims;

using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Infrastructure.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class TenantContextService : ITenantContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly Lazy<Task<(bool IsPlatformAdmin, Guid? TenantId)>> _resolution;

    public TenantContextService(IHttpContextAccessor httpContextAccessor, UserManager<ApplicationUser> userManager)
    {
        _httpContextAccessor = httpContextAccessor;
        _userManager = userManager;
        _resolution = new Lazy<Task<(bool IsPlatformAdmin, Guid? TenantId)>>(ResolveAsync);
    }

    public Guid? TenantId => _resolution.Value.GetAwaiter().GetResult().TenantId;

    public bool IsPlatformAdmin => _resolution.Value.GetAwaiter().GetResult().IsPlatformAdmin;

    public string? TenantSlug => _httpContextAccessor.HttpContext?.User.FindFirstValue("tenantSlug");

    private async Task<(bool IsPlatformAdmin, Guid? TenantId)> ResolveAsync()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return (false, null);
        }

        if (user.IsInRole("SuperAdmin"))
        {
            return (true, null);
        }

        var claimValue = user.FindFirstValue("tenantId");
        if (Guid.TryParse(claimValue, out var tenantIdFromClaim))
        {
            return (false, tenantIdFromClaim);
        }

        var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            return (false, null);
        }

        var appUser = await _userManager.FindByIdAsync(userId.ToString()).ConfigureAwait(false);
        return (false, appUser?.TenantId);
    }
}
