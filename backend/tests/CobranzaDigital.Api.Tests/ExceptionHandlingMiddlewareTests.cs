using System.Text.Json;
using CobranzaDigital.Api.Middleware;
using CobranzaDigital.Application.Common.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.Logging.Abstractions;

namespace CobranzaDigital.Api.Tests;

public sealed class ExceptionHandlingMiddlewareTests
{
    [Fact]
    public async Task ValidationException_DoesNotThrowSecondaryException_AndReturnsValidationProblem()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Response.Body = new MemoryStream();
        httpContext.Items[CorrelationIdMiddleware.ItemKey] = "test-correlation-id";

        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new ValidationException(new Dictionary<string, string[]>
            {
                ["roles"] = ["At least one role is required."]
            }),
            NullLogger<ExceptionHandlingMiddleware>.Instance,
            new TestHostEnvironment(),
            new TestProblemDetailsFactory());

        await middleware.InvokeAsync(httpContext).ConfigureAwait(false);

        Assert.Equal(StatusCodes.Status400BadRequest, httpContext.Response.StatusCode);

        httpContext.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(httpContext.Response.Body).ConfigureAwait(false);

        Assert.Equal("Validation failed", json.RootElement.GetProperty("title").GetString());
        Assert.True(json.RootElement.TryGetProperty("errors", out var errors));
        Assert.True(errors.TryGetProperty("roles", out var roleErrors));
        Assert.Equal("At least one role is required.", roleErrors[0].GetString());
        Assert.Equal("test-correlation-id", json.RootElement.GetProperty("correlationId").GetString());
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "CobranzaDigital.Api.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private sealed class TestProblemDetailsFactory : ProblemDetailsFactory
    {
        public override ProblemDetails CreateProblemDetails(
            HttpContext httpContext,
            int? statusCode = null,
            string? title = null,
            string? type = null,
            string? detail = null,
            string? instance = null)
        {
            return new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Type = type,
                Detail = detail,
                Instance = instance
            };
        }

        public override ValidationProblemDetails CreateValidationProblemDetails(
            HttpContext httpContext,
            ModelStateDictionary modelStateDictionary,
            int? statusCode = null,
            string? title = null,
            string? type = null,
            string? detail = null,
            string? instance = null)
        {
            return new ValidationProblemDetails(modelStateDictionary)
            {
                Status = statusCode,
                Title = title,
                Type = type,
                Detail = detail,
                Instance = instance
            };
        }
    }
}
