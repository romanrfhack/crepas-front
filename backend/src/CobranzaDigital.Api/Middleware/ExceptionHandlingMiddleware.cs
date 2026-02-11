using CobranzaDigital.Application.Common.Exceptions;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;

using System.Diagnostics;

namespace CobranzaDigital.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;
    private readonly ProblemDetailsFactory _problemDetailsFactory;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment environment,
        ProblemDetailsFactory problemDetailsFactory)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
        _problemDetailsFactory = problemDetailsFactory;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            var correlationId = GetCorrelationId(context);

                LogUnhandledException(
                _logger,
                context.Request.Method,
                context.Request.Path.ToString(),
                correlationId,
                exception);

            var problemDetails = CreateProblemDetails(context, exception, correlationId);

            context.Response.StatusCode = problemDetails.Status ?? StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";

            await context.Response.WriteAsJsonAsync((object)problemDetails).ConfigureAwait(false);
        }
    }

    private ProblemDetails CreateProblemDetails(HttpContext context, Exception exception, string correlationId)
    {
        ProblemDetails problemDetails = exception switch
        {
            ValidationException validationException => CreateValidationProblemDetails(
                context,
                validationException),
            NotFoundException => CreateProblemDetails(context, StatusCodes.Status404NotFound, "Resource not found"),
            UnauthorizedException => CreateProblemDetails(context, StatusCodes.Status401Unauthorized, "Unauthorized"),
            UnauthorizedAccessException => CreateProblemDetails(context, StatusCodes.Status401Unauthorized, "Unauthorized"),
            ForbiddenException => CreateProblemDetails(context, StatusCodes.Status403Forbidden, "Forbidden"),
            ConflictException => CreateProblemDetails(context, StatusCodes.Status409Conflict, "Conflict"),
            DomainRuleException => CreateProblemDetails(context, StatusCodes.Status409Conflict, "Conflict"),
            _ => CreateProblemDetails(context, StatusCodes.Status500InternalServerError, "Unexpected error")
        };

        problemDetails.Extensions["traceId"] = Activity.Current?.Id ?? context.TraceIdentifier;
        problemDetails.Extensions["correlationId"] = correlationId;

        if (_environment.IsDevelopment())
        {
            problemDetails.Detail ??= exception.Message;
            problemDetails.Extensions["exception"] = exception.ToString();
        }
        else
        {
            problemDetails.Detail = problemDetails.Status switch
            {
                StatusCodes.Status400BadRequest => "Validation failed.",
                StatusCodes.Status401Unauthorized => "Authentication required.",
                StatusCodes.Status403Forbidden => "Access is forbidden.",
                StatusCodes.Status404NotFound => "Resource was not found.",
                StatusCodes.Status409Conflict => "A conflict occurred.",
                _ => "An unexpected error occurred."
            };
        }

        return problemDetails;
    }

    private ValidationProblemDetails CreateValidationProblemDetails(HttpContext context, ValidationException exception)
    {
        var modelState = new ModelStateDictionary();
        foreach (var error in exception.Errors)
        {
            foreach (var message in error.Value)
            {
                modelState.AddModelError(error.Key, message);
            }
        }

        var validationProblem = _problemDetailsFactory.CreateValidationProblemDetails(
            context,
            modelState,
            StatusCodes.Status400BadRequest,
            "Validation failed");

        return validationProblem;
    }

    private ProblemDetails CreateProblemDetails(HttpContext context, int statusCode, string title)
    {
        return _problemDetailsFactory.CreateProblemDetails(context, statusCode: statusCode, title: title);
    }

    private static string GetCorrelationId(HttpContext context)
    {
        return context.Items.TryGetValue(CorrelationIdMiddleware.ItemKey, out var value) && value is string id
            ? id
            : Activity.Current?.Id ?? context.TraceIdentifier;
    }

    private static readonly Action<ILogger, string, string, string, Exception> _logUnhandledException =
        LoggerMessage.Define<string, string, string>(
            LogLevel.Error,
            new EventId(1, nameof(LogUnhandledException)),
            "Unhandled exception for {Method} {Path} [CorrelationId: {CorrelationId}]");

    private static void LogUnhandledException(
        ILogger logger,
        string method,
        string path,
        string correlationId,
        Exception exception)
    {
        _logUnhandledException(logger, method, path, correlationId, exception);
    }
}
