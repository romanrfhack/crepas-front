using System.Diagnostics;
using System.Security.Claims;


namespace CobranzaDigital.Api.Middleware;

public sealed partial class RequestLoggingMiddleware
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

        LogMessages.RequestStarted(_logger, method, path, userId ?? "anonymous");

        try
        {
            await _next(context).ConfigureAwait(false);
        }
        finally
        {
            stopwatch.Stop();
            var statusCode = context.Response?.StatusCode;

            userId = GetUserId(context.User);

            LogMessages.RequestFinished(_logger, method, path, statusCode, stopwatch.ElapsedMilliseconds, userId ?? "anonymous");
        }
    }

    private static string? GetUserId(ClaimsPrincipal? user)
    {
        return user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user?.FindFirst("sub")?.Value;
    }

    private static partial class LogMessages
    {
        [LoggerMessage(Level = LogLevel.Information, Message = "Request started {Method} {Path} UserId={UserId}")]
        public static partial void RequestStarted(ILogger logger, string method, string? path, string userId);

        [LoggerMessage(Level = LogLevel.Information, Message = "Request finished {Method} {Path} StatusCode={StatusCode} DurationMs={DurationMs} UserId={UserId}")]
        public static partial void RequestFinished(ILogger logger, string method, string? path, int? statusCode, long durationMs, string userId);
    }
}
