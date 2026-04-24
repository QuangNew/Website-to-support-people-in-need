namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Result of a spam check — indicates whether the action should proceed, warn, or be blocked.
/// </summary>
public record SpamCheckResult(SpamVerdict Verdict, string? WarningMessage = null);

public enum SpamVerdict
{
    /// <summary>Action is within acceptable limits.</summary>
    Ok,
    /// <summary>User is approaching the limit — show a warning but allow the action.</summary>
    Warning,
    /// <summary>User exceeded the limit — block and auto-suspend.</summary>
    Suspend
}

/// <summary>
/// Checks recent activity counts to detect spam behavior.
/// Admin users are always exempt.
/// </summary>
public interface ISpamGuardService
{
    /// <summary>Check post creation rate (window: 1 hour).</summary>
    Task<SpamCheckResult> CheckPostAsync(string userId);

    /// <summary>Check comment creation rate (window: 1 minute).</summary>
    Task<SpamCheckResult> CheckCommentAsync(string userId);

    /// <summary>Check SOS ping creation rate (window: 1 hour).</summary>
    Task<SpamCheckResult> CheckPingAsync(string userId);

    /// <summary>Check direct message send rate (window: 1 minute).</summary>
    Task<SpamCheckResult> CheckMessageAsync(string userId);

    /// <summary>Auto-suspend a user for spamming.</summary>
    Task SuspendForSpamAsync(string userId, string reason);
}
