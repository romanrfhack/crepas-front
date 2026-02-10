using System.ComponentModel.DataAnnotations;

namespace CobranzaDigital.Infrastructure.Options;

public sealed class DatabaseOptions
{
    public const string SectionName = "DatabaseOptions";

    public string Provider { get; init; } = "SqlServer";

    [Required]
    public string ConnectionStringName { get; init; } = "SqlServer";

    public bool EnableSensitiveDataLogging { get; init; }
}
