using Microsoft.AspNetCore.SignalR;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.API.Hubs;

/// <summary>
/// Sends notification unread-count changes to connected users over SignalR.
/// </summary>
public class NotificationRealtimeDispatcher : INotificationRealtimeDispatcher
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<NotificationRealtimeDispatcher> _logger;

    public NotificationRealtimeDispatcher(IHubContext<NotificationHub> hubContext, ILogger<NotificationRealtimeDispatcher> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task PublishUnreadCountChangedAsync(string userId, int unreadCount)
    {
        await _hubContext.Clients.Group(NotificationHub.GetUserGroup(userId)).SendAsync("UnreadCountChanged", new
        {
            totalUnread = unreadCount,
        });

        _logger.LogDebug("Published notification unread count {UnreadCount} to user {UserId}", unreadCount, userId);
    }

    public async Task PublishAnnouncementsChangedAsync(int announcementId, string changeType)
    {
        await _hubContext.Clients.Group(NotificationHub.GetAnnouncementsGroup()).SendAsync("AnnouncementsChanged", new
        {
            announcementId,
            changeType,
        });

        _logger.LogDebug("Published announcement change {ChangeType} for announcement {AnnouncementId}", changeType, announcementId);
    }
}