namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Centralized service for creating user notifications.
/// Decouples notification logic from individual controllers.
/// </summary>
public interface INotificationService
{
    /// <summary>Send notification to a single user.</summary>
    Task SendAsync(string userId, string message);

    /// <summary>Send notification to multiple users.</summary>
    Task SendToManyAsync(IEnumerable<string> userIds, string message);

    /// <summary>Send notification to all users with a specific role (enum value as int).</summary>
    Task SendToRoleAsync(int role, string message);
}
