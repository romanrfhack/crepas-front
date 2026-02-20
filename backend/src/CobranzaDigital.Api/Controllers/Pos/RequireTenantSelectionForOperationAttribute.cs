using CobranzaDigital.Application.Interfaces;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace CobranzaDigital.Api.Controllers.Pos;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
internal sealed class RequireTenantSelectionForOperationAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var tenantContext = context.HttpContext.RequestServices.GetRequiredService<ITenantContext>();
        var controller = (ControllerBase)context.Controller;
        var validation = PosTenantGuard.EnsureTenantSelectedForOperation(controller, tenantContext);
        if (validation is not null)
        {
            context.Result = validation;
        }
    }
}
