namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Publishes real-time notification state changes to connected clients.
/// </summary>
public interface INotificationRealtimeDispatcher
{
    /// <summary>
    /// Broadcast the latest unread notification count for a specific user.
    /// </summary>
    Task PublishUnreadCountChangedAsync(string userId, int unreadCount);

    /// <summary>
    /// Broadcast that the shared announcement feed changed for all authenticated users.
    /// </summary>
    Task PublishAnnouncementsChangedAsync(int announcementId, string changeType);
}