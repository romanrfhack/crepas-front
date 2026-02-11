using System.Diagnostics;
using System.Security.Claims;

using Microsoft.Extensions.Logging;

namespace CobranzaDigital.Api.Middleware;

public sealed class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var method = context.Request.Method;
        var path = context.Request.Path.HasValue ? context.Request.Path.Value : "/";
        var userId = GetUserId(context.User);

        _logger.LogInformation(
            "Request started {Method} {Path} UserId={UserId}",
            method,
            path,
            userId ?? "anonymous");

        try
        {
            await _next(context).ConfigureAwait(false);
        }
        finally
        {
            stopwatch.Stop();
            var statusCode = context.Response?.StatusCode;

            userId = GetUserId(context.User);

            _logger.LogInformation(
                "Request finished {Method} {Path} StatusCode={StatusCode} DurationMs={DurationMs} UserId={UserId}",
                method,
                path,
                statusCode,
                stopwatch.ElapsedMilliseconds,
                userId ?? "anonymous");
        }
    }

    private static string? GetUserId(ClaimsPrincipal? user)
    {
        return user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user?.FindFirst("sub")?.Value;
    }
}
