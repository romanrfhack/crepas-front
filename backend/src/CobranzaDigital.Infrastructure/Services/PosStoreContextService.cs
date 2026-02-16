using CobranzaDigital.Application.Common.Exceptions;
using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Infrastructure.Services;

internal sealed class PosStoreContextService
{
    private readonly CobranzaDigitalDbContext _db;

    public PosStoreContextService(CobranzaDigitalDbContext db)
    {
        _db = db;
    }

    public async Task<(Guid StoreId, PosSettings Settings)> ResolveStoreAsync(Guid? requestedStoreId, CancellationToken ct)
    {
        var settings = await _db.PosSettings.FirstOrDefaultAsync(ct).ConfigureAwait(false)
            ?? throw new ConflictException("POS settings are not configured.");

        var storeId = settings.MultiStoreEnabled && requestedStoreId.HasValue
            ? requestedStoreId.Value
            : settings.DefaultStoreId;

        var storeExists = await _db.Stores.AsNoTracking()
            .AnyAsync(x => x.Id == storeId && x.IsActive, ct)
            .ConfigureAwait(false);

        if (!storeExists)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["Store was not found or is inactive."] });
        }

        if (!settings.MultiStoreEnabled && requestedStoreId.HasValue && requestedStoreId.Value != settings.DefaultStoreId)
        {
            throw new ValidationException(new Dictionary<string, string[]> { ["storeId"] = ["Multi-store is disabled."] });
        }

        return (storeId, settings);
    }
}
