using System.Collections.Concurrent;
using System.Net;

namespace ReliefConnect.API.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ConcurrentDictionary<string, (int Count, DateTime Window)> _requests = new();

    public RateLimitingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLower() ?? "";

        if (path.StartsWith("/api/auth/login") ||
            path.StartsWith("/api/auth/register") ||
            path.StartsWith("/api/auth/verify-email"))
        {
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var key = $"{ip}:{path}";

            var now = DateTime.UtcNow;
            var (count, window) = _requests.GetOrAdd(key, _ => (0, now));

            if (now - window > TimeSpan.FromMinutes(15))
            {
                _requests[key] = (1, now);
            }
            else if (count >= 5)
            {
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                await context.Response.WriteAsJsonAsync(new { message = "Too many attempts. Try again in 15 minutes." });
                return;
            }
            else
            {
                _requests[key] = (count + 1, window);
            }

            CleanupExpired();
        }

        await _next(context);
    }

    private void CleanupExpired()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _requests.Where(x => now - x.Value.Window > TimeSpan.FromMinutes(15)))
            _requests.TryRemove(kvp.Key, out _);
    }
}
