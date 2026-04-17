using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(AppDbContext db, ILogger<NotificationService> logger)
    {
        _db = db;
        _logger = logger;
    }

    private Task InsertNotificationAsync(string userId, string message)
    {
        var createdAt = DateTime.UtcNow;
        return _db.Database.ExecuteSqlInterpolatedAsync(
            $@"INSERT INTO ""Notifications"" (""CreatedAt"", ""IsRead"", ""MessageText"", ""UserId"")
               VALUES ({createdAt}, {false}, {message}, {userId})");
    }

    /// <inheritdoc />
    public async Task SendAsync(string userId, string message)
    {
        await InsertNotificationAsync(userId, message);
        _logger.LogDebug("Notification sent to user {UserId}", userId);
    }

    /// <inheritdoc />
    public async Task SendToManyAsync(IEnumerable<string> userIds, string message)
    {
        var ids = userIds.ToList();
        if (ids.Count == 0) return;

        foreach (var userId in ids)
        {
            await InsertNotificationAsync(userId, message);
        }
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
