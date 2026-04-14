using System.Collections.Concurrent;
using System.Net;

namespace ReliefConnect.API.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ConcurrentDictionary<string, (int Count, DateTime Window)> _requests = new();
    private DateTime _lastCleanup = DateTime.MinValue;

    public RateLimitingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLower() ?? "";

        // Use X-Forwarded-For behind reverse proxy (Vercel, Cloudflare, etc.)
        var ip = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        if (path.StartsWith("/api/auth/login") ||
            path.StartsWith("/api/auth/register") ||
            path.StartsWith("/api/auth/verify-email") ||
            path.StartsWith("/api/auth/reset-password") ||
            path.StartsWith("/api/auth/forgot-password"))
        {
            if (!CheckRateLimit(ip, path, 5, 15))
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsJsonAsync(new { message = "Too many attempts. Try again in 15 minutes." });
                return;
            }
        }
        else if (path.StartsWith("/api/social/upload-image"))
        {
            if (!CheckRateLimit(ip, path, 20, 5))
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsJsonAsync(new { message = "Too many uploads. Try again in 5 minutes." });
                return;
            }
        }
        else if (path.StartsWith("/api/chatbot/"))
        {
            if (!CheckRateLimit(ip, path, 30, 5))
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsJsonAsync(new { message = "Too many requests. Try again in 5 minutes." });
                return;
            }
        }

        await _next(context);
    }

    private bool CheckRateLimit(string ip, string path, int maxAttempts, int windowMinutes)
    {
        var key = $"{ip}:{path}";
        var now = DateTime.UtcNow;
        var (count, window) = _requests.GetOrAdd(key, _ => (0, now));

        if (now - window > TimeSpan.FromMinutes(windowMinutes))
        {
            _requests[key] = (1, now);
            TryCleanupExpired(now);
            return true;
        }

        if (count >= maxAttempts)
            return false;

        _requests[key] = (count + 1, window);
        return true;
    }

    private void TryCleanupExpired(DateTime now)
    {
        // Run cleanup at most once per minute to keep it off the hot path.
        if (now - _lastCleanup < TimeSpan.FromMinutes(1))
            return;

        _lastCleanup = now;
        foreach (var kvp in _requests.Where(x => now - x.Value.Window > TimeSpan.FromMinutes(30)))
            _requests.TryRemove(kvp.Key, out _);
    }
}
