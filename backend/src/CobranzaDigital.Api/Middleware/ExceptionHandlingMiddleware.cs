using System.Diagnostics;

using CobranzaDigital.Application.Common.Exceptions;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace CobranzaDigital.Api.Middleware;

public sealed partial class ExceptionHandlingMiddleware
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
            var statusCode = GetStatusCode(exception);

            LogException(_logger, context, correlationId, exception, statusCode);

            var problemDetails = CreateProblemDetails(context, exception, correlationId);

            context.Response.StatusCode = problemDetails.Status ?? StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";

            await context.Response.WriteAsJsonAsync((object)problemDetails).ConfigureAwait(false);
        }
    }

    private static int GetStatusCode(Exception exception)
    {
        return exception switch
        {
            ValidationException => StatusCodes.Status400BadRequest,
            UnauthorizedException => StatusCodes.Status401Unauthorized,
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            ForbiddenException => StatusCodes.Status403Forbidden,
            NotFoundException => StatusCodes.Status404NotFound,
            ConflictException => StatusCodes.Status409Conflict,
            DomainRuleException => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError
        };
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

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Handled {ExceptionType} for {Method} {Path} [CorrelationId: {CorrelationId}] (StatusCode: {StatusCode}, ErrorCount: {ErrorCount})")]
    private static partial void LogValidationException(
        ILogger logger,
        string exceptionType,
        string method,
        string path,
        string correlationId,
        int statusCode,
        int errorCount);

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "Handled {ExceptionType} for {Method} {Path} [CorrelationId: {CorrelationId}] (StatusCode: {StatusCode})")]
    private static partial void LogWarningException(
        ILogger logger,
        string exceptionType,
        string method,
        string path,
        string correlationId,
        int statusCode);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Handled {ExceptionType} for {Method} {Path} [CorrelationId: {CorrelationId}] (StatusCode: {StatusCode})")]
    private static partial void LogInformationException(
        ILogger logger,
        string exceptionType,
        string method,
        string path,
        string correlationId,
        int statusCode);

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Unhandled exception for {Method} {Path} [CorrelationId: {CorrelationId}]")]
    private static partial void LogUnhandledException(
        ILogger logger,
        Exception exception,
        string method,
        string path,
        string correlationId);

    private static void LogException(
        ILogger logger,
        HttpContext context,
        string correlationId,
        Exception exception,
        int statusCode)
    {
        var method = context.Request.Method;
        var path = context.Request.Path.ToString();
        var exceptionType = exception.GetType().Name;

        switch (exception)
        {
            case ValidationException validationException:
                LogValidationException(
                    logger,
                    exceptionType,
                    method,
                    path,
                    correlationId,
                    statusCode,
                    validationException.Errors.Count);
                return;
            case ForbiddenException:
            case ConflictException:
            case DomainRuleException:
                LogWarningException(
                    logger,
                    exceptionType,
                    method,
                    path,
                    correlationId,
                    statusCode);
                return;
            case NotFoundException:
            case UnauthorizedException:
            case UnauthorizedAccessException:
                LogInformationException(
                    logger,
                    exceptionType,
                    method,
                    path,
                    correlationId,
                    statusCode);
                return;
            default:
                LogUnhandledException(
                    logger,
                    exception,
                    method,
                    path,
                    correlationId);
                return;
        }
    }
}
