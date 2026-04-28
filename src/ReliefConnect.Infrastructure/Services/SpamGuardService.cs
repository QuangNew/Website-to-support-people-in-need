using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Services;

public class SpamGuardService : ISpamGuardService
{
    private readonly AppDbContext _db;
    private readonly INotificationService _notifications;
    private readonly ILogger<SpamGuardService> _logger;

    // ── Thresholds ──
    // Posts: 2/hour warn, 4/hour suspend
    private const int PostWarnLimit = 2;
    private const int PostSuspendLimit = 4;

    // Comments: 6/min warn, 10/min suspend
    private const int CommentWarnLimit = 6;
    private const int CommentSuspendLimit = 10;

    // Pings: 2/hour warn, 4/hour suspend
    private const int PingWarnLimit = 2;
    private const int PingSuspendLimit = 4;

    // Messages: 15/min warn, 20/min suspend
    private const int MessageWarnLimit = 15;
    private const int MessageSuspendLimit = 20;

    public SpamGuardService(AppDbContext db, INotificationService notifications, ILogger<SpamGuardService> logger)
    {
        _db = db;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<SpamCheckResult> CheckPostAsync(string userId)
    {
        if (await IsAdminAsync(userId))
            return new SpamCheckResult(SpamVerdict.Ok);

        var since = DateTime.UtcNow.AddHours(-1);
        var count = await _db.Posts
            .AsNoTracking()
            .CountAsync(p => p.AuthorId == userId && !p.IsDeleted && p.CreatedAt >= since);

        return Evaluate(count, PostWarnLimit, PostSuspendLimit,
            "Vui lòng đăng bài chậm lại hoặc đợi một thời gian trước khi đăng bài mới.");
    }

    public async Task<SpamCheckResult> CheckCommentAsync(string userId)
    {
        if (await IsAdminAsync(userId))
            return new SpamCheckResult(SpamVerdict.Ok);

        var since = DateTime.UtcNow.AddMinutes(-1);
        var count = await _db.Comments
            .AsNoTracking()
            .CountAsync(c => c.UserId == userId && !c.IsHidden && c.CreatedAt >= since);

        return Evaluate(count, CommentWarnLimit, CommentSuspendLimit,
            "Bạn đang bình luận quá nhanh. Vui lòng chờ một chút trước khi bình luận tiếp.");
    }

    public async Task<SpamCheckResult> CheckPingAsync(string userId)
    {
        if (await IsAdminAsync(userId))
            return new SpamCheckResult(SpamVerdict.Ok);

        var since = DateTime.UtcNow.AddHours(-1);
        var count = await _db.Pings
            .AsNoTracking()
            .CountAsync(p => p.UserId == userId && p.CreatedAt >= since);

        return Evaluate(count, PingWarnLimit, PingSuspendLimit,
            "Bạn đang tạo SOS quá nhiều. Vui lòng đợi trước khi tạo SOS mới.");
    }

    public async Task<SpamCheckResult> CheckMessageAsync(string userId)
    {
        if (await IsAdminAsync(userId))
            return new SpamCheckResult(SpamVerdict.Ok);

        var since = DateTime.UtcNow.AddMinutes(-1);
        var count = await _db.DirectMessages
            .AsNoTracking()
            .CountAsync(m => m.SenderId == userId && m.DeletedAt == null && m.SentAt >= since);

        return Evaluate(count, MessageWarnLimit, MessageSuspendLimit,
            "Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ một chút.");
    }

    public async Task SuspendForSpamAsync(string userId, string reason)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return;

        user.IsSuspended = true;
        user.SuspendedUntil = DateTime.UtcNow.AddHours(24); // 24-hour temp ban
        user.BanReason = reason;
        await _db.SaveChangesAsync();

        _logger.LogWarning("User {UserId} auto-suspended for spam: {Reason}", userId, reason);

        try
        {
            await _notifications.SendAsync(userId,
                $"⛔ Tài khoản của bạn đã bị tạm khóa 24 giờ do spam. Lý do: {reason}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send spam suspension notification to {UserId}", userId);
        }
    }

    private async Task<bool> IsAdminAsync(string userId)
    {
        return await _db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == userId && u.Role == RoleEnum.Admin);
    }

    private static SpamCheckResult Evaluate(int count, int warnLimit, int suspendLimit, string warningMessage)
    {
        if (count >= suspendLimit)
            return new SpamCheckResult(SpamVerdict.Suspend);

        if (count >= warnLimit)
            return new SpamCheckResult(SpamVerdict.Warning, warningMessage);

        return new SpamCheckResult(SpamVerdict.Ok);
    }
}
