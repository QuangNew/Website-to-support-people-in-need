using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Services;

/// <summary>
/// Centralized notification creation service.
/// Queries users by <see cref="RoleEnum"/> stored on <see cref="ApplicationUser.Role"/>.
/// </summary>
public class NotificationService : INotificationService
{
    private readonly AppDbContext _db;
    private readonly INotificationRealtimeDispatcher _realtimeDispatcher;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        AppDbContext db,
        INotificationRealtimeDispatcher realtimeDispatcher,
        ILogger<NotificationService> logger)
    {
        _db = db;
        _realtimeDispatcher = realtimeDispatcher;
        _logger = logger;
    }

    private async Task InsertNotificationsAsync(IReadOnlyCollection<string> userIds, string message)
    {
        var createdAt = DateTime.UtcNow;
        var notifications = userIds.Select(userId => new Notification
        {
            UserId = userId,
            MessageText = message,
            IsRead = false,
            CreatedAt = createdAt,
        });

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync();
    }

    private async Task PublishUnreadCountsChangedAsync(IReadOnlyCollection<string> userIds)
    {
        var unreadCounts = await _db.Notifications
            .AsNoTracking()
            .Where(n => userIds.Contains(n.UserId) && !n.IsRead)
            .GroupBy(n => n.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(item => item.UserId, item => item.Count);

        await Task.WhenAll(userIds.Select(userId =>
            _realtimeDispatcher.PublishUnreadCountChangedAsync(
                userId,
                unreadCounts.GetValueOrDefault(userId))));
    }

    /// <inheritdoc />
    public async Task SendAsync(string userId, string message)
    {
        var ids = new[] { userId };
        await InsertNotificationsAsync(ids, message);
        await PublishUnreadCountsChangedAsync(ids);
        _logger.LogDebug("Notification sent to user {UserId}", userId);
    }

    /// <inheritdoc />
    public async Task SendToManyAsync(IEnumerable<string> userIds, string message)
    {
        var ids = userIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (ids.Count == 0) return;

        await InsertNotificationsAsync(ids, message);
        await PublishUnreadCountsChangedAsync(ids);
        _logger.LogDebug("Notification sent to {Count} users", ids.Count);
    }

    /// <inheritdoc />
    public async Task SendToRoleAsync(int role, string message)
    {
        var roleEnum = (RoleEnum)role;
        var userIds = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == roleEnum && !u.IsSuspended)
            .Select(u => u.Id)
            .ToListAsync();

        if (userIds.Count == 0) return;

        await SendToManyAsync(userIds, message);
        _logger.LogDebug("Notification sent to {Count} users with role {Role}", userIds.Count, roleEnum);
    }
}
