using System.Globalization;
using System.Text;

using Asp.Versioning;

using CobranzaDigital.Api.FeatureManagement;
using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces.PosCatalog;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/pos/inventory")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[RequireTenantSelectionForOperation]
[Authorize(Policy = AuthorizationPolicies.PosAdmin)]
[FeatureFlag("inventory.v2.enabled")]
public sealed class PosInventoryV2Controller : ControllerBase
{
    private readonly IPosCatalogService _service;

    public PosInventoryV2Controller(IPosCatalogService service)
    {
        _service = service;
    }

    [HttpGet("balances")]
    public Task<PagedInventoryBalancesDto> GetBalances(
        [FromQuery] Guid storeId,
        [FromQuery] string? q,
        [FromQuery] Guid? categoryId,
        [FromQuery] bool? tracked,
        [FromQuery] decimal? onHandMin,
        [FromQuery] decimal? onHandMax,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        _service.GetInventoryBalancesV2Async(storeId, q, categoryId, tracked, onHandMin, onHandMax, page, pageSize, ct);

    [HttpGet("balances/export")]
    public async Task<IActionResult> ExportBalancesCsv(
        [FromQuery] Guid storeId,
        [FromQuery] string? q,
        [FromQuery] Guid? categoryId,
        [FromQuery] bool? tracked,
        [FromQuery] decimal? onHandMin,
        [FromQuery] decimal? onHandMax,
        CancellationToken ct = default)
    {
        const int maxRows = 50000;
        var rows = await _service.GetInventoryBalancesV2ExportAsync(storeId, q, categoryId, tracked, onHandMin, onHandMax, maxRows + 1, ct);
        if (rows.Count > maxRows)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new ProblemDetails
            {
                Status = StatusCodes.Status413PayloadTooLarge,
                Title = "Payload too large",
                Detail = "Refina filtros"
            });
        }

        var csv = new StringBuilder();
        csv.AppendLine("ItemType,ExternalCode,Name,CategoryName,IsInventoryTracked,OnHandQty,UpdatedAtUtc");
        foreach (var row in rows)
        {
            var externalCode = row.ItemType == "Product" ? row.Sku : row.ItemId.ToString("D");
            csv.Append(EscapeCsv(row.ItemType)).Append(',')
                .Append(EscapeCsv(externalCode)).Append(',')
                .Append(EscapeCsv(row.Name)).Append(',')
                .Append(EscapeCsv(row.CategoryName)).Append(',')
                .Append(row.IsInventoryTracked ? "true" : "false").Append(',')
                .Append(row.OnHandQty.ToString("0.000", CultureInfo.InvariantCulture)).Append(',')
                .Append(EscapeCsv(row.UpdatedAtUtc?.ToString("O", CultureInfo.InvariantCulture)))
                .AppendLine();
        }

        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"inventory-balances-{storeId:D}.csv");
    }

    [HttpGet("movements")]
    public Task<PagedInventoryMovementsDto> GetMovements(
        [FromQuery] Guid storeId,
        [FromQuery] string itemType,
        [FromQuery] Guid itemId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? reason,
        [FromQuery] string? referenceType,
        [FromQuery] string? referenceId,
        [FromQuery] Guid? createdByUserId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        _service.GetInventoryMovementsV2Async(storeId, itemType, itemId, from, to, reason, referenceType, referenceId, createdByUserId, page, pageSize, ct);

    [HttpPost("adjustments/batch")]
    public Task<InventoryAdjustmentV2BatchResultDto> CreateAdjustmentBatch(
        [FromBody] CreateInventoryAdjustmentV2BatchRequest request,
        CancellationToken ct = default) =>
        _service.CreateInventoryAdjustmentBatchV2Async(request, ct);

    [HttpPost("adjustments/batch/validate")]
    public Task<InventoryBatchValidationResultDto> ValidateAdjustmentBatch(
        [FromBody] CreateInventoryAdjustmentV2BatchRequest request,
        CancellationToken ct = default) =>
        _service.ValidateInventoryAdjustmentBatchV2Async(request, ct);

    [HttpPost("adjustments")]
    public Task<InventoryAdjustmentV2ResultDto> CreateAdjustment(
        [FromBody] CreateInventoryAdjustmentV2Request request,
        CancellationToken ct = default) =>
        _service.CreateInventoryAdjustmentV2Async(request, ct);

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (!value.Contains(',') && !value.Contains('"') && !value.Contains('\n') && !value.Contains('\r')) return value;
        return $"\"{value.Replace("\"", "\"\"")}\"";
    }
}
