using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Application.Interfaces;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

public sealed class PosStoreContextService
{
    private readonly CobranzaDigitalDbContext _db;
    private readonly ITenantContext _tenantContext;

    public PosStoreContextService(CobranzaDigitalDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<(Guid StoreId, PosSettings Settings)> ResolveStoreAsync(Guid? requestedStoreId, CancellationToken ct)
    {
        var settings = await _db.PosSettings.OrderBy(x => x.Id).FirstOrDefaultAsync(ct).ConfigureAwait(false)
            ?? throw new ConflictException("POS settings are not configured.");

        var tenantId = _tenantContext.TenantId;
        if (!tenantId.HasValue)
        {
            throw new ForbiddenException("Tenant context is required.");
        }

        var storeId = settings.MultiStoreEnabled && requestedStoreId.HasValue
            ? requestedStoreId.Value
            : settings.DefaultStoreId;

        var storeExists = await _db.Stores.AsNoTracking()
            .AnyAsync(x => x.Id == storeId && x.TenantId == tenantId.Value && x.IsActive, ct)
            .ConfigureAwait(false);

        if (!storeExists)
        {
            throw new NotFoundException("Store was not found for current tenant.");
        }

        if (!settings.MultiStoreEnabled && requestedStoreId.HasValue && requestedStoreId.Value != settings.DefaultStoreId)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["Multi-store is disabled."] });
        }

        return (storeId, settings);
    }
}
