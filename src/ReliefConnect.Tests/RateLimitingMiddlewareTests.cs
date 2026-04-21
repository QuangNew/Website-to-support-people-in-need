using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using ReliefConnect.API.Middleware;
using ReliefConnect.API.Services;

namespace ReliefConnect.Tests;

public class RateLimitingMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_uses_processed_remote_ip_instead_of_forwarded_for_header()
    {
        var store = new CapturingRateLimitStore(true);
        var nextCalled = false;
        var middleware = new RateLimitingMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = CreateContext("/api/chatbot/send", remoteIp: "10.0.0.9");
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.50";

        await middleware.InvokeAsync(context, store);

        Assert.True(nextCalled);
        Assert.Equal("10.0.0.9:/api/chatbot/send", store.LastKey);
    }

    [Fact]
    public async Task InvokeAsync_uses_normalized_email_for_auth_rate_limit_key_and_resets_request_body()
    {
        var store = new CapturingRateLimitStore(true);
        var middleware = new RateLimitingMiddleware(_ => Task.CompletedTask);
        var context = CreateContext(
            "/api/auth/login",
            remoteIp: "10.0.0.9",
            body: "{\"email\":\"User@Example.com\"}");

        await middleware.InvokeAsync(context, store);

        Assert.Equal("10.0.0.9:/api/auth/login:user@example.com", store.LastKey);
        Assert.Equal(0, context.Request.Body.Position);
    }

    [Fact]
    public async Task InvokeAsync_returns_429_when_rate_limit_store_blocks_request()
    {
        var store = new CapturingRateLimitStore(false);
        var nextCalled = false;
        var middleware = new RateLimitingMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        var context = CreateContext("/api/chatbot/message", remoteIp: "10.0.0.9");

        await middleware.InvokeAsync(context, store);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
    }

    private static DefaultHttpContext CreateContext(string path, string remoteIp, string? body = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = HttpMethods.Post;
        context.Connection.RemoteIpAddress = IPAddress.Parse(remoteIp);
        context.Response.Body = new MemoryStream();

        if (body != null)
        {
            var bytes = Encoding.UTF8.GetBytes(body);
            context.Request.ContentType = "application/json";
            context.Request.Body = new MemoryStream(bytes);
            context.Request.ContentLength = bytes.Length;
        }

        return context;
    }

    private sealed class CapturingRateLimitStore : IRateLimitStore
    {
        private readonly bool _result;

        public CapturingRateLimitStore(bool result)
        {
            _result = result;
        }

        public string? LastKey { get; private set; }

        public Task<bool> CheckRateLimitAsync(string key, int maxAttempts, TimeSpan window, CancellationToken cancellationToken = default)
        {
            LastKey = key;
            return Task.FromResult(_result);
        }
    }
}