namespace CobranzaDigital.Api;

public static class AuthorizationPolicies
{
    public const string AdminOnly = "AdminOnly";
    public const string RequireScope = "RequireScope";
    public const string PosAdmin = "PosAdmin";
    public const string PosOperator = "PosOperator";
    public const string PosReportViewer = "PosReportViewer";
    public const string PlatformOnly = "PlatformOnly";
    public const string TenantScoped = "TenantScoped";
    public const string RequiredScopeValue = "cobranza.read";
}
