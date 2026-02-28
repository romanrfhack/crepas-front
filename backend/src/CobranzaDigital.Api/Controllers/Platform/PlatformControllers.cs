using Asp.Versioning;

using CobranzaDigital.Api.Observability;
using CobranzaDigital.Application.Auditing;
using CobranzaDigital.Application.Contracts.Platform;
using CobranzaDigital.Application.Interfaces.Platform;
using CobranzaDigital.Application.Contracts.PosCatalog;
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
    private readonly IPlatformTenantService _platformTenantService;
    private readonly IAuditLogger _auditLogger;
    private readonly IAuditRequestContextAccessor _auditRequestContextAccessor;

    public PlatformTenantsController(
        CobranzaDigitalDbContext db,
        IPlatformTenantService platformTenantService,
        IAuditLogger auditLogger,
        IAuditRequestContextAccessor auditRequestContextAccessor)
    {
        _db = db;
        _platformTenantService = platformTenantService;
        _auditLogger = auditLogger;
        _auditRequestContextAccessor = auditRequestContextAccessor;
    }

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

        var templateId = await _db.CatalogTemplates.AsNoTracking()
            .Where(x => x.VerticalId == tenant.VerticalId && x.IsActive)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(ct);

        if (templateId.HasValue)
        {
            _db.TenantCatalogTemplates.Add(new TenantCatalogTemplate
            {
                TenantId = tenant.Id,
                CatalogTemplateId = templateId.Value,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            });
        }

        await _db.SaveChangesAsync(ct);

        return tenant;
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PlatformTenantDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<PlatformTenantDetailsDto> GetById(Guid id, CancellationToken ct) =>
        _platformTenantService.GetTenantDetailsAsync(id, ct);

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PlatformTenantDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PlatformTenantDetailsDto>> Update(Guid id, [FromBody] UpdatePlatformTenantRequestDto request, CancellationToken ct)
    {
        var before = await _platformTenantService.GetTenantDetailsAsync(id, ct).ConfigureAwait(false);
        var updated = await _platformTenantService.UpdateTenantAsync(id, request, ct).ConfigureAwait(false);

        await _auditLogger.LogAsync(new AuditEntry(
                AuditActions.UpdateTenant,
                _auditRequestContextAccessor.GetUserId(),
                _auditRequestContextAccessor.GetCorrelationId(),
                EntityType: "Tenant",
                EntityId: id.ToString(),
                Before: new
                {
                    before.Name,
                    before.Slug,
                    before.VerticalId,
                    before.IsActive
                },
                After: new
                {
                    updated.Name,
                    updated.Slug,
                    updated.VerticalId,
                    updated.IsActive
                },
                Source: "Api",
                Notes: null),
            ct).ConfigureAwait(false);

        return updated;
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

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/platform/catalog-templates")]
[Authorize(Policy = AuthorizationPolicies.PlatformOnly)]
public sealed class PlatformCatalogTemplatesController : ControllerBase
{
    private readonly CobranzaDigitalDbContext _db;

    public PlatformCatalogTemplatesController(CobranzaDigitalDbContext db) => _db = db;

    [HttpGet]
    public async Task<IReadOnlyList<CatalogTemplate>> List([FromQuery] Guid? verticalId, CancellationToken ct)
    {
        var query = _db.CatalogTemplates.AsNoTracking();
        if (verticalId.HasValue)
        {
            query = query.Where(x => x.VerticalId == verticalId.Value);
        }

        return await query.OrderBy(x => x.Name).ToListAsync(ct);
    }

    [HttpPost]
    public async Task<CatalogTemplate> Create([FromBody] UpsertCatalogTemplateRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var item = new CatalogTemplate
        {
            Id = Guid.NewGuid(),
            VerticalId = request.VerticalId,
            Name = request.Name,
            Version = request.Version,
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        _db.CatalogTemplates.Add(item);
        await _db.SaveChangesAsync(ct);
        return item;
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CatalogTemplate>> Update(Guid id, [FromBody] UpsertCatalogTemplateRequest request, CancellationToken ct)
    {
        var item = await _db.CatalogTemplates.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        item.VerticalId = request.VerticalId;
        item.Name = request.Name;
        item.Version = request.Version;
        item.IsActive = request.IsActive;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return item;
    }

    [HttpPut("tenants/{tenantId:guid}")]
    public async Task<IActionResult> AssignTemplate(Guid tenantId, [FromBody] AssignTenantCatalogTemplateRequest request, CancellationToken ct)
    {
        var mapping = await _db.TenantCatalogTemplates.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (mapping is null)
        {
            _db.TenantCatalogTemplates.Add(new TenantCatalogTemplate
            {
                TenantId = tenantId,
                CatalogTemplateId = request.CatalogTemplateId,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            });
        }
        else
        {
            mapping.CatalogTemplateId = request.CatalogTemplateId;
            mapping.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
