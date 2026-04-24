using System.Net;
using System.Text.Json;
using ReliefConnect.API.Services;

namespace ReliefConnect.API.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;

    public RateLimitingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IRateLimitStore rateLimitStore)
    {
        var path = context.Request.Path.Value?.ToLower() ?? "";
        var ip = NormalizeIpAddress(context.Connection.RemoteIpAddress) ?? "unknown";

        if (path.StartsWith("/api/auth/login") ||
            path.StartsWith("/api/auth/register") ||
            path.StartsWith("/api/auth/verify-email") ||
            path.StartsWith("/api/auth/reset-password") ||
            path.StartsWith("/api/auth/forgot-password"))
        {
            var authKey = await BuildAuthRateLimitKeyAsync(context, ip, path);
            if (!await rateLimitStore.CheckRateLimitAsync(authKey, 5, TimeSpan.FromMinutes(15), context.RequestAborted))
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsJsonAsync(new { message = "Too many attempts. Try again in 15 minutes." });
                return;
            }
        }
        else if (path.StartsWith("/api/social/upload-image"))
        {
            if (!await rateLimitStore.CheckRateLimitAsync($"{ip}:{path}", 20, TimeSpan.FromMinutes(5), context.RequestAborted))
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsJsonAsync(new { message = "Too many uploads. Try again in 5 minutes." });
                return;
            }
        }
        else if (path.StartsWith("/api/chatbot/"))
        {
            if (!await rateLimitStore.CheckRateLimitAsync($"{ip}:{path}", 30, TimeSpan.FromMinutes(5), context.RequestAborted))
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsJsonAsync(new { message = "Too many requests. Try again in 5 minutes." });
                return;
            }
        }

        await _next(context);
    }

    private static async Task<string> BuildAuthRateLimitKeyAsync(HttpContext context, string ip, string path)
    {
        var identifier = await TryGetAuthRequestIdentifierAsync(context);
        return string.IsNullOrWhiteSpace(identifier)
            ? $"{ip}:{path}"
            : $"{ip}:{path}:{identifier}";
    }

    private static async Task<string?> TryGetAuthRequestIdentifierAsync(HttpContext context)
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authorization))
            return authorization.Trim();

        var contentType = context.Request.ContentType;
        if (string.IsNullOrWhiteSpace(contentType) || !contentType.Contains("application/json", StringComparison.OrdinalIgnoreCase))
            return null;

        context.Request.EnableBuffering();

        using var reader = new StreamReader(context.Request.Body, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        context.Request.Body.Position = 0;

        if (string.IsNullOrWhiteSpace(body))
            return null;

        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                return null;

            if (document.RootElement.TryGetProperty("email", out var emailElement)
                && emailElement.ValueKind == JsonValueKind.String)
            {
                var email = emailElement.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(email))
                    return email.ToLowerInvariant();
            }

            if (document.RootElement.TryGetProperty("username", out var usernameElement)
                && usernameElement.ValueKind == JsonValueKind.String)
            {
                var username = usernameElement.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(username))
                    return username.ToLowerInvariant();
            }
        }
        catch (JsonException)
        {
        }

        return null;
    }

    private static string? NormalizeIpAddress(IPAddress? address)
    {
        if (address == null)
            return null;

        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        return address.ToString();
    }
}
