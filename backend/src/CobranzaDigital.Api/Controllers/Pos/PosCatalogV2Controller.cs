using System.Globalization;
using System.Text;

using Asp.Versioning;

using CobranzaDigital.Application.Contracts.PosCatalog;
using CobranzaDigital.Application.Interfaces.PosCatalog;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

[ApiController]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/pos/catalog")]
[Authorize(Policy = AuthorizationPolicies.TenantOrPlatform)]
[RequireTenantSelectionForOperation]
[Authorize(Policy = AuthorizationPolicies.PosAdmin)]
public sealed class PosCatalogV2Controller : ControllerBase
{
    private readonly IPosCatalogService _service;

    public PosCatalogV2Controller(IPosCatalogService service)
    {
        _service = service;
    }

    [HttpGet("categories/export")]
    public async Task<IActionResult> ExportCategories(CancellationToken ct)
    {
        const int maxRows = 50000;
        var rows = await _service.GetCategoriesExportAsync(maxRows + 1, ct);
        if (rows.Count > maxRows)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new ProblemDetails { Status = 413, Title = "Payload too large", Detail = "Refina filtros" });
        }

        var csv = new StringBuilder();
        csv.AppendLine("categoryCode,name,sortOrder,updatedAtUtc");
        foreach (var row in rows)
        {
            csv.Append(EscapeCsv(row.CategoryCode)).Append(',')
                .Append(EscapeCsv(row.Name)).Append(',')
                .Append(row.SortOrder.ToString(CultureInfo.InvariantCulture)).Append(',')
                .Append(EscapeCsv(row.UpdatedAtUtc.ToString("O", CultureInfo.InvariantCulture))).AppendLine();
        }

        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8", "categories-export.csv");
    }

    [HttpGet("products/export")]
    public async Task<IActionResult> ExportProducts(CancellationToken ct)
    {
        const int maxRows = 50000;
        var rows = await _service.GetProductsExportAsync(maxRows + 1, ct);
        if (rows.Count > maxRows)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new ProblemDetails { Status = 413, Title = "Payload too large", Detail = "Refina filtros" });
        }

        var csv = new StringBuilder();
        csv.AppendLine("externalCode,name,categoryCode,basePrice,isActive,isAvailable,isInventoryTracked,subcategoryName,updatedAtUtc");
        foreach (var row in rows)
        {
            csv.Append(EscapeCsv(row.ExternalCode)).Append(',')
                .Append(EscapeCsv(row.Name)).Append(',')
                .Append(EscapeCsv(row.CategoryCode)).Append(',')
                .Append(row.BasePrice.ToString("0.00", CultureInfo.InvariantCulture)).Append(',')
                .Append(row.IsActive ? "true" : "false").Append(',')
                .Append(row.IsAvailable ? "true" : "false").Append(',')
                .Append(row.IsInventoryTracked ? "true" : "false").Append(',')
                .Append(EscapeCsv(row.SubcategoryName)).Append(',')
                .Append(EscapeCsv(row.UpdatedAtUtc.ToString("O", CultureInfo.InvariantCulture))).AppendLine();
        }

        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8", "products-export.csv");
    }

    [HttpPost("categories/import/validate")]
    public Task<CatalogImportValidationResultDto> ValidateCategories([FromBody] CatalogCategoryImportValidateRequest request, CancellationToken ct) =>
        _service.ValidateCategoryImportAsync(request, ct);

    [HttpPost("categories/import/apply")]
    public Task<CatalogImportApplyResultDto> ApplyCategories([FromBody] CatalogCategoryImportApplyRequest request, CancellationToken ct) =>
        _service.ApplyCategoryImportAsync(request, ct);

    [HttpPost("products/import/validate")]
    public Task<CatalogImportValidationResultDto> ValidateProducts([FromBody] CatalogProductImportValidateRequest request, CancellationToken ct) =>
        _service.ValidateProductImportAsync(request, ct);

    [HttpPost("products/import/apply")]
    public Task<CatalogImportApplyResultDto> ApplyProducts([FromBody] CatalogProductImportApplyRequest request, CancellationToken ct) =>
        _service.ApplyProductImportAsync(request, ct);

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (!value.Contains(',') && !value.Contains('"') && !value.Contains('\n') && !value.Contains('\r')) return value;
        return $"\"{value.Replace("\"", "\"\"")}\"";
    }
}
