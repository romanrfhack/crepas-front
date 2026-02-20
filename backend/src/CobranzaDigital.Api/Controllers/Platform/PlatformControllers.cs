using Asp.Versioning;

using CobranzaDigital.Domain.Entities;
using CobranzaDigital.Infrastructure.Persistence;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CobranzaDigital.Api.Controllers.Platform;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/platform/verticals")]
[Authorize(Policy = AuthorizationPolicies.PlatformOnly)]
public sealed class PlatformVerticalsController : ControllerBase
{
    private readonly CobranzaDigitalDbContext _db;

    public PlatformVerticalsController(CobranzaDigitalDbContext db) => _db = db;

    [HttpGet]
    public async Task<IReadOnlyList<Vertical>> List(CancellationToken ct) => await _db.Verticals.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);

    [HttpPost]
    public async Task<Vertical> Create([FromBody] UpsertVerticalRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var item = new Vertical { Id = Guid.NewGuid(), Name = request.Name, Description = request.Description, IsActive = true, CreatedAtUtc = now, UpdatedAtUtc = now };
        _db.Verticals.Add(item);
        await _db.SaveChangesAsync(ct);
        return item;
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Vertical>> Update(Guid id, [FromBody] UpsertVerticalRequest request, CancellationToken ct)
    {
        var item = await _db.Verticals.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        item.Name = request.Name;
        item.Description = request.Description;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return item;
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Disable(Guid id, CancellationToken ct)
    {
        var item = await _db.Verticals.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        item.IsActive = false;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/platform/tenants")]
[Authorize(Policy = AuthorizationPolicies.PlatformOnly)]
public sealed class PlatformTenantsController : ControllerBase
{
    private readonly CobranzaDigitalDbContext _db;

    public PlatformTenantsController(CobranzaDigitalDbContext db) => _db = db;

    [HttpGet]
    public async Task<IReadOnlyList<Tenant>> List(CancellationToken ct) => await _db.Tenants.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<Tenant>> Create([FromBody] CreateTenantRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            VerticalId = request.VerticalId,
            Name = request.Name,
            Slug = request.Slug,
            IsActive = true,
            DefaultStoreId = null,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync(ct);

        var store = new Store
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Name = $"{request.Name} Matriz",
            TimeZoneId = request.TimeZoneId,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _db.Stores.Add(store);
        await _db.SaveChangesAsync(ct);

        tenant.DefaultStoreId = store.Id;
        tenant.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return tenant;
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Tenant>> Update(Guid id, [FromBody] UpdateTenantRequest request, CancellationToken ct)
    {
        var item = await _db.Tenants.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        item.Name = request.Name;
        item.Slug = request.Slug;
        item.VerticalId = request.VerticalId;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return item;
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Disable(Guid id, CancellationToken ct)
    {
        var item = await _db.Tenants.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        item.IsActive = false;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public sealed record UpsertVerticalRequest(string Name, string? Description);
public sealed record CreateTenantRequest(Guid VerticalId, string Name, string Slug, string TimeZoneId = "America/Mexico_City");
public sealed record UpdateTenantRequest(Guid VerticalId, string Name, string Slug);
