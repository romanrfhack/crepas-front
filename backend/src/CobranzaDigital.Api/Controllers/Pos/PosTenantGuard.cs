using CobranzaDigital.Application.Interfaces;

using Microsoft.AspNetCore.Mvc;

namespace CobranzaDigital.Api.Controllers.Pos;

internal static class PosTenantGuard
{
    private const string TenantRequiredMessage = "tenantId required for this endpoint in platform mode";

    public static ActionResult? EnsureTenantSelectedForOperation(ControllerBase controller, ITenantContext tenantContext)
    {
        if (tenantContext.IsPlatformAdmin && !tenantContext.EffectiveTenantId.HasValue)
        {
            return controller.BadRequest(new ProblemDetails { Title = TenantRequiredMessage, Detail = TenantRequiredMessage });
        }

        return null;
    }
}
