using System.Diagnostics;
using System.Security.Claims;

using CobranzaDigital.Api.Middleware;

namespace CobranzaDigital.Api.Observability;

public sealed class HttpAuditRequestContextAccessor : IAuditRequestContextAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpAuditRequestContextAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string GetCorrelationId()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null)
        {
            return Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("D");
        }

        if (context.Items.TryGetValue(CorrelationIdMiddleware.ItemKey, out var value)
            && value is string correlationId
            && !string.IsNullOrWhiteSpace(correlationId))
        {
            return correlationId;
        }

        if (context.Request.Headers.TryGetValue(CorrelationIdMiddleware.HeaderName, out var requestCorrelationId)
            && !string.IsNullOrWhiteSpace(requestCorrelationId))
        {
            return requestCorrelationId.ToString();
        }

        return Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
    }

    public Guid? GetUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        var raw = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? user?.FindFirst("sub")?.Value;

        return Guid.TryParse(raw, out var userId) ? userId : null;
    }
}
