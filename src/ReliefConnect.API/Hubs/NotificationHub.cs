using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.API.Hubs;

/// <summary>
/// SignalR hub for real-time notification badge updates.
/// Each user joins their own group so unread count changes can be pushed instantly.
/// </summary>
[Authorize]
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public static string GetUserGroup(string userId) => $"user_{userId}";

    public static string GetAnnouncementsGroup() => "announcements";

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GetUserGroup(userId));
            await Groups.AddToGroupAsync(Context.ConnectionId, GetAnnouncementsGroup());
            _logger.LogInformation("Notification hub connected: {ConnectionId}, User: {UserId}", Context.ConnectionId, userId);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetUserGroup(userId));
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetAnnouncementsGroup());
            _logger.LogInformation("Notification hub disconnected: {ConnectionId}, User: {UserId}", Context.ConnectionId, userId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}