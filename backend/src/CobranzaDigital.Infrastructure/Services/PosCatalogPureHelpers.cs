using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

using CobranzaDigital.Application.Contracts.PosCatalog;

namespace CobranzaDigital.Infrastructure.Services;

internal static class PosCatalogPureHelpers
{
    public static string NormalizeCategoryCode(string? code, string name)
    {
        if (!string.IsNullOrWhiteSpace(code))
        {
            return code.Trim();
        }

        var normalized = new string(name.Trim().ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
        while (normalized.Contains("--", StringComparison.Ordinal))
        {
            normalized = normalized.Replace("--", "-", StringComparison.Ordinal);
        }

        return normalized.Trim('-');
    }

    public static Guid DeriveLineClientOperationId(Guid batchClientOperationId, int lineNo)
    {
        var input = Encoding.UTF8.GetBytes($"{batchClientOperationId:D}:{lineNo}");
        var hash = SHA256.HashData(input);
        Span<byte> bytes = stackalloc byte[16];
        hash[..16].CopyTo(bytes);
        return new Guid(bytes);
    }

    public static string ComputeInventoryBatchRequestHash(CreateInventoryAdjustmentV2BatchRequest request)
    {
        var normalized = new
        {
            request.StoreId,
            ReasonCode = request.ReasonCode.Trim(),
            request.ReferenceType,
            request.ReferenceId,
            request.Note,
            request.BatchClientOperationId,
            Lines = request.Lines.OrderBy(x => x.LineNo).Select(x => new
            {
                x.LineNo,
                ItemType = x.ItemType?.Trim(),
                x.ExternalCode,
                x.ItemId,
                DeltaQty = decimal.Round(x.DeltaQty, 3, MidpointRounding.AwayFromZero),
                x.LineClientOperationId
            }).ToArray()
        };

        return ComputeHash(JsonSerializer.Serialize(normalized));
    }

    public static string ComputeCatalogBatchRequestHash<TLine>(
        Guid batchClientOperationId,
        string importType,
        IReadOnlyList<TLine> lines)
    {
        var normalized = new { BatchClientOperationId = batchClientOperationId, ImportType = importType, Lines = lines };
        return ComputeHash(JsonSerializer.Serialize(normalized));
    }

    public static string ComputeWeakEtag(string stamp, Guid tenantId, Guid templateId, Guid storeId)
    {
        var input = $"{stamp}|{tenantId:N}|{templateId:N}|{storeId:N}";
        return $"W/\"{ComputeHash(input)}\"";
    }

    public static string ComputeWeakEtagFromSeed(string seed) => $"W/\"{ComputeHash(seed)}\"";

    public static string ComputeVersionStamp(params object[] sections)
    {
        var input = string.Join('|', sections.Select(x => x.ToString()));
        return ComputeHash(input);
    }

    private static string ComputeHash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }
}
