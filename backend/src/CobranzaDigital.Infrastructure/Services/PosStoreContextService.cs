using System.Security.Claims;

using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Identity;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PosStoreContextService
{
    private readonly CobranzaDigitalDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly UserManager<ApplicationUser> _userManager;

    public PosStoreContextService(
        CobranzaDigitalDbContext db,
        ITenantContext tenantContext,
        IHttpContextAccessor httpContextAccessor,
        UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _tenantContext = tenantContext;
        _httpContextAccessor = httpContextAccessor;
        _userManager = userManager;
    }

    public async Task<(Guid StoreId, PosSettings Settings)> ResolveStoreAsync(Guid? requestedStoreId, CancellationToken ct)
    {
        var settings = await _db.PosSettings.OrderBy(x => x.Id).FirstOrDefaultAsync(ct).ConfigureAwait(false)
            ?? throw new ConflictException("POS settings are not configured.");

        var tenantId = _tenantContext.EffectiveTenantId;
        if (!tenantId.HasValue)
        {
            throw new ForbiddenException("Tenant context is required.");
        }

        var tenantDefaultStoreId = await _db.Tenants.AsNoTracking()
            .Where(x => x.Id == tenantId.Value)
            .Select(x => x.DefaultStoreId)
            .SingleOrDefaultAsync(ct)
            .ConfigureAwait(false);

        var contextualStoreId = await ResolveContextStoreIdAsync(ct).ConfigureAwait(false);

        var candidates = new List<Guid>();
        if (requestedStoreId.HasValue)
        {
            candidates.Add(requestedStoreId.Value);
        }
        else
        {
            if (contextualStoreId.HasValue)
            {
                candidates.Add(contextualStoreId.Value);
            }

            // Contained release mode resolves the implicit store only from the tenant-scoped default.
            if (tenantDefaultStoreId.HasValue && !candidates.Contains(tenantDefaultStoreId.Value))
            {
                candidates.Add(tenantDefaultStoreId.Value);
            }
        }

        foreach (var candidateStoreId in candidates)
        {
            var storeExists = await _db.Stores.AsNoTracking()
                .AnyAsync(x => x.Id == candidateStoreId && x.TenantId == tenantId.Value && x.IsActive, ct)
                .ConfigureAwait(false);
            if (storeExists)
            {
                return (candidateStoreId, settings);
            }
        }

        throw new NotFoundException("Store was not found for current tenant.");
    }

    private async Task<Guid?> ResolveContextStoreIdAsync(CancellationToken ct)
    {
        var user = _httpContextAccessor.HttpContext?.User;
        var claimValue = user?.FindFirstValue("storeId");
        if (Guid.TryParse(claimValue, out var storeIdFromClaim))
        {
            return storeIdFromClaim;
        }

        var userIdRaw = user?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdRaw, out var userId))
        {
            return null;
        }

        var appUser = await _userManager.FindByIdAsync(userId.ToString()).ConfigureAwait(false);
        ct.ThrowIfCancellationRequested();
        return appUser?.StoreId;
    }
}
