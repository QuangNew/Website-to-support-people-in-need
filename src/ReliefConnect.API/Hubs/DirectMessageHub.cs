using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ReliefConnect.API.Hubs;

/// <summary>
/// SignalR hub for real-time direct messaging between users.
/// Each user joins their own group (user_{userId}) on connect.
/// </summary>
[Authorize]
public class DirectMessageHub : Hub
{
    private readonly ILogger<DirectMessageHub> _logger;

    public DirectMessageHub(ILogger<DirectMessageHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
            _logger.LogInformation("DM hub connected: {ConnectionId}, User: {UserId}", Context.ConnectionId, userId);
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
            _logger.LogInformation("DM hub disconnected: {ConnectionId}, User: {UserId}", Context.ConnectionId, userId);
        }
        await base.OnDisconnectedAsync(exception);
    }
}
