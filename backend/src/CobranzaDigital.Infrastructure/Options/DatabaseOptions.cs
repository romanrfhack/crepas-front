using System.ComponentModel.DataAnnotations;

namespace CobranzaDigital.Infrastructure.Options;

public sealed class DatabaseOptions
{
    public const string SectionName = "DatabaseOptions";

    [Required]
    public string ConnectionStringName { get; init; } = "DefaultConnection";

    public bool EnableSensitiveDataLogging { get; init; }
}
