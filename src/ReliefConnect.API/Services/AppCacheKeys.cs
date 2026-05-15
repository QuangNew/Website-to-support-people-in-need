using ReliefConnect.Core.Enums;

namespace ReliefConnect.API.Services;

public sealed record AuthUserStateCacheEntry(
    string UserId,
    RoleEnum Role,
    bool IsSuspended,
    DateTime? SuspendedUntil,
    string SecurityStamp);

public static class AuthValidationCacheKeys
{
    public static string UserState(string userId) => $"auth:user-state:{userId}";
}

public static class AnnouncementCacheKeys
{
    public static string Active(int limit) => $"announcements:active:{limit}";

    public static readonly int[] CommonActiveLimits = [10, 20, 50];
}
