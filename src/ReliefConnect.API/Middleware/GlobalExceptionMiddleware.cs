using System.Net;
using System.Text.Json;
using ReliefConnect.Core.DTOs;

namespace ReliefConnect.API.Middleware;

/// <summary>
/// Global exception handling middleware.
/// Catches all unhandled exceptions and returns consistent JSON error responses.
/// Sprint 1 requirement.
/// </summary>
public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access: {Path}", context.Request.Path);
            await WriteErrorResponse(context, HttpStatusCode.Forbidden,
                "Bạn không có quyền thực hiện thao tác này.");
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Resource not found: {Path}", context.Request.Path);
            await WriteErrorResponse(context, HttpStatusCode.NotFound,
                "Không tìm thấy tài nguyên yêu cầu.");
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Bad request: {Path}", context.Request.Path);
            await WriteErrorResponse(context, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid operation: {Path}", context.Request.Path);
            await WriteErrorResponse(context, HttpStatusCode.Conflict, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception at {Path}", context.Request.Path);
            await WriteErrorResponse(context, HttpStatusCode.InternalServerError,
                "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.");
        }
    }

    private static async Task WriteErrorResponse(HttpContext context, HttpStatusCode statusCode, string message)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var response = new ApiErrorResponse
        {
            StatusCode = (int)statusCode,
            Message = message,
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });

        await context.Response.WriteAsync(json);
    }
}

/// <summary>
/// Extension method to register the middleware in the pipeline.
/// </summary>
public static class GlobalExceptionMiddlewareExtensions
{
    public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<GlobalExceptionMiddleware>();
    }
}
