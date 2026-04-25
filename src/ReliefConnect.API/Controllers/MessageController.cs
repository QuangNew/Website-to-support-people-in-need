using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.API.Hubs;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize(Policy = "RequireVerified")]
public class MessageController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<DirectMessageHub> _hubContext;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly Ganss.Xss.HtmlSanitizer _sanitizer;
    private readonly ILogger<MessageController> _logger;
    private readonly ISpamGuardService _spamGuard;

    public MessageController(
        AppDbContext db,
        IHubContext<DirectMessageHub> hubContext,
        IServiceScopeFactory scopeFactory,
        Ganss.Xss.HtmlSanitizer sanitizer,
        ILogger<MessageController> logger,
        ISpamGuardService spamGuard)
    {
        _db = db;
        _hubContext = hubContext;
        _scopeFactory = scopeFactory;
        _sanitizer = sanitizer;
        _logger = logger;
        _spamGuard = spamGuard;
    }

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private string GetSenderName() =>
        User.FindFirstValue("FullName")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? "Unknown user";

    /// <summary>
    /// Get all conversations for the current user, sorted by LastMessageAt DESC.
    /// </summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var conversations = await _db.DirectConversations
            .AsNoTracking()
            .Where(c => c.User1Id == userId || c.User2Id == userId)
            .OrderByDescending(c => c.LastMessageAt)
            .ThenByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.User1Id,
                c.User2Id,
                c.LastMessageAt,
                LastMessage = c.Messages
                    .Where(m => m.DeletedAt == null)
                    .OrderByDescending(m => m.SentAt)
                    .Select(m => m.Content)
                    .FirstOrDefault(),
                UnreadCount = c.Messages
                    .Count(m => m.SenderId != userId && !m.IsRead && m.DeletedAt == null),
                User1 = new { c.User1.Id, c.User1.FullName, c.User1.AvatarUrl },
                User2 = new { c.User2.Id, c.User2.FullName, c.User2.AvatarUrl }
            })
            .ToListAsync();

        var result = conversations.Select(c =>
        {
            var isUser1 = c.User1Id == userId;
            var partner = isUser1 ? c.User2 : c.User1;
            return new DirectConversationDto
            {
                Id = c.Id,
                PartnerId = partner.Id,
                PartnerName = partner.FullName,
                PartnerAvatar = partner.AvatarUrl,
                LastMessage = c.LastMessage != null && c.LastMessage.Length > 100
                    ? c.LastMessage[..100] + "..."
                    : c.LastMessage,
                LastMessageAt = c.LastMessageAt,
                UnreadCount = c.UnreadCount
            };
        });

        return Ok(result);
    }

    /// <summary>
    /// Get messages for a specific conversation (cursor-based, newest first).
    /// </summary>
    [HttpGet("conversations/{id:int}/messages")]
    public async Task<IActionResult> GetMessages(int id, [FromQuery] int? before = null, [FromQuery] int? after = null, [FromQuery] int limit = 30)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        // Verify participation
        var conversation = await _db.DirectConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && (c.User1Id == userId || c.User2Id == userId));

        if (conversation == null)
            return NotFound(new { message = "Conversation not found" });

        var query = _db.DirectMessages
            .AsNoTracking()
            .Where(m => m.ConversationId == id && m.DeletedAt == null)
            .OrderByDescending(m => m.SentAt)
            .ThenByDescending(m => m.Id)
            .AsQueryable();

        if (before.HasValue)
            query = query.Where(m => m.Id < before.Value);
        else if (after.HasValue)
            query = query.Where(m => m.Id > after.Value);

        var messages = await query
            .Take(limit + 1)
            .Join(_db.Users,
                m => m.SenderId,
                u => u.Id,
                (m, u) => new { Message = m, SenderName = u.FullName })
            .ToListAsync();

        string? nextCursor = null;
        if (messages.Count > limit)
        {
            nextCursor = messages[limit].Message.Id.ToString();
            messages = messages.Take(limit).ToList();
        }

        var items = messages.Select(x => new DirectMessageResponseDto
        {
            Id = x.Message.Id,
            SenderId = x.Message.SenderId,
            SenderName = x.SenderName,
            Content = x.Message.Content,
            SentAt = x.Message.SentAt,
            IsRead = x.Message.IsRead,
            IsMine = x.Message.SenderId == userId
        });

        return Ok(new { items, nextCursor });
    }

    /// <summary>
    /// Start or find an existing conversation with a target user.
    /// </summary>
    [HttpPost("conversations")]
    public async Task<IActionResult> StartConversation([FromBody] StartConversationDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (userId == dto.TargetUserId)
            return BadRequest(new { message = "Cannot start a conversation with yourself" });

        var target = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == dto.TargetUserId);
        if (target == null)
            return NotFound(new { message = "User not found" });

        if (target.IsSuspended)
            return BadRequest(new { message = "Target user is suspended" });

        // Normalize pair order: User1Id < User2Id
        var minId = string.Compare(userId, dto.TargetUserId, StringComparison.Ordinal) < 0 ? userId : dto.TargetUserId;
        var maxId = minId == userId ? dto.TargetUserId : userId;

        // Try find existing
        var existing = await _db.DirectConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.User1Id == minId && c.User2Id == maxId);

        if (existing != null)
            return Ok(new { conversationId = existing.Id });

        // Create new
        var conv = new DirectConversation
        {
            User1Id = minId,
            User2Id = maxId,
            CreatedAt = DateTime.UtcNow
        };

        _db.DirectConversations.Add(conv);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23505")
        {
            // Race condition: conversation was just created by the other user
            existing = await _db.DirectConversations
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.User1Id == minId && c.User2Id == maxId);

            if (existing != null)
                return Ok(new { conversationId = existing.Id });

            throw;
        }

        return Ok(new { conversationId = conv.Id });
    }

    /// <summary>
    /// Send a message in a conversation.
    /// </summary>
    [HttpPost("conversations/{id:int}/messages")]
    public async Task<IActionResult> SendMessage(int id, [FromBody] SendDirectMessageDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var conversation = await _db.DirectConversations
            .AsNoTracking()
            .Where(c => c.Id == id && (c.User1Id == userId || c.User2Id == userId))
            .Select(c => new
            {
                SenderIsSuspended = c.User1Id == userId ? c.User1.IsSuspended : c.User2.IsSuspended,
                ReceiverId = c.User1Id == userId ? c.User2Id : c.User1Id,
                ReceiverIsSuspended = c.User1Id == userId ? c.User2.IsSuspended : c.User1.IsSuspended
            })
            .FirstOrDefaultAsync();

        if (conversation == null)
            return NotFound(new { message = "Conversation not found" });

        if (conversation.SenderIsSuspended)
            return StatusCode(403, new { message = "Your account is suspended" });

        // ── Spam Guard ──
        var spamCheck = await _spamGuard.CheckMessageAsync(userId);
        if (spamCheck.Verdict == SpamVerdict.Suspend)
        {
            await _spamGuard.SuspendForSpamAsync(userId, "Gửi tin nhắn quá nhiều (>50 tin/phút)");
            return StatusCode(429, new { message = "Tài khoản của bạn đã bị tạm khóa do gửi tin nhắn quá nhiều.", suspended = true });
        }

        if (conversation.ReceiverIsSuspended)
            return BadRequest(new { message = "Cannot send message to a suspended user" });

        var sanitizedContent = _sanitizer.Sanitize(dto.Content);
        if (string.IsNullOrWhiteSpace(sanitizedContent))
            return BadRequest(new { message = "Message content is empty after sanitization" });

        var senderName = GetSenderName();
        var receiverId = conversation.ReceiverId;
        var clientMessageId = string.IsNullOrWhiteSpace(dto.ClientMessageId)
            ? null
            : dto.ClientMessageId.Trim();
        var now = DateTime.UtcNow;
        var message = new DirectMessage
        {
            ConversationId = id,
            SenderId = userId,
            Content = sanitizedContent,
            SentAt = now,
            IsRead = false
        };

        _db.DirectMessages.Add(message);

        // Persist first so optimistic UI can confirm delivery as soon as the DB write succeeds.
        await _db.SaveChangesAsync();

        // Await background work instead of fire-and-forget to prevent connection pool exhaustion.
        // Each fire-and-forget creates a new DbContext scope that competes for limited Supabase pool slots.
        await PostSendBackgroundWorkAsync(id, now, userId, senderName, receiverId, message.Id, null, sanitizedContent);

        return Ok(new DirectMessageResponseDto
        {
            Id = message.Id,
            SenderId = userId,
            SenderName = senderName,
            Content = sanitizedContent,
            SentAt = now,
            IsRead = false,
            IsMine = true,
            ClientMessageId = clientMessageId,
            SpamWarning = spamCheck.Verdict == SpamVerdict.Warning ? spamCheck.WarningMessage : null
        });
    }

    /// <summary>
    /// Mark all messages in a conversation as read.
    /// </summary>
    [HttpPut("conversations/{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        // Verify participation and get the other user's ID
        var conversation = await _db.DirectConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && (c.User1Id == userId || c.User2Id == userId));

        if (conversation == null)
            return NotFound(new { message = "Conversation not found" });

        var targetUserId = conversation.User1Id == userId ? conversation.User2Id : conversation.User1Id;

        var count = await _db.DirectMessages
            .Where(m => m.ConversationId == id && m.SenderId != userId && !m.IsRead && m.DeletedAt == null)
            .ExecuteUpdateAsync(m => m.SetProperty(x => x.IsRead, true));

        if (count > 0)
        {
            // Broadcast to the sender that their messages were read
            await _hubContext.Clients.User(targetUserId).SendAsync("ConversationRead", new
            {
                conversationId = id,
                readerId = userId,
                readAt = DateTime.UtcNow
            });
        }

        return Ok(new { markedRead = count });
    }

    /// <summary>
    /// Get total unread message count (for badge).
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var total = await _db.DirectMessages
            .AsNoTracking()
            .Where(m => (m.Conversation.User1Id == userId || m.Conversation.User2Id == userId)
                && m.SenderId != userId
                && !m.IsRead
                && m.DeletedAt == null)
            .CountAsync();

        return Ok(new { totalUnread = total });
    }

    /// <summary>
    /// Search for users to start a conversation with.
    /// Returns verified users (Volunteer, Sponsor, Admin) matching name or phone.
    /// </summary>
    [HttpGet("search-users")]
    public async Task<IActionResult> SearchUsers([FromQuery] string q)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(Array.Empty<SearchUserDto>());

        var query = q.Trim().ToLower();

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id != userId
                && !u.IsSuspended
                && (u.Role == RoleEnum.Volunteer || u.Role == RoleEnum.Sponsor || u.Role == RoleEnum.Admin || u.Role == RoleEnum.PersonInNeed)
                && u.VerificationStatus == VerificationStatus.Approved
                && (u.FullName.ToLower().Contains(query) || (u.PhoneNumber != null && u.PhoneNumber.Contains(query))))
            .Take(20)
            .Select(u => new SearchUserDto
            {
                Id = u.Id,
                FullName = u.FullName,
                AvatarUrl = u.AvatarUrl,
                Role = u.Role.ToString()
            })
            .ToListAsync();

        return Ok(users);
    }

    /// <summary>
    /// Consolidated post-send work: update conversation timestamp, write audit log (single DB scope),
    /// then broadcast via SignalR. Awaited instead of fire-and-forget to prevent connection pool exhaustion.
    /// </summary>
    private async Task PostSendBackgroundWorkAsync(
        int conversationId,
        DateTime now,
        string senderId,
        string senderName,
        string receiverId,
        int messageId,
        string? senderAvatar,
        string content)
    {
        // 1. Single DB scope for both update + audit (halves connection usage)
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Update conversation last message timestamp
            await db.DirectConversations
                .Where(c => c.Id == conversationId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.LastMessageAt, now));

            // Write audit log
            db.SystemLogs.Add(new SystemLog
            {
                Action = "DirectMessage",
                Details = $"User {senderId} -> {receiverId} in conv {conversationId}",
                UserId = senderId,
                UserName = senderName,
                CreatedAt = now
            });

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed post-send DB work for conversation {ConversationId}", conversationId);
        }

        // 2. Broadcast via SignalR to BOTH sender and receiver.
        // The sender's tab that initiated the API call already has the message via optimistic UI,
        // but broadcasting to both ensures: (a) multi-tab/multi-device support for the sender,
        // and (b) the receiver gets real-time delivery. The frontend deduplicates using senderId
        // comparison — incoming messages with senderId === current user are ignored if already present.
        try
        {
            var payload = new
            {
                messageId,
                conversationId,
                senderId,
                senderName,
                senderAvatar,
                content,
                sentAt = now
            };

            // Broadcast to receiver
            await _hubContext.Clients.Group($"user_{receiverId}")
                .SendAsync("ReceiveDirectMessage", payload);

            // Also broadcast to sender (for other tabs/devices)
            await _hubContext.Clients.Group($"user_{senderId}")
                .SendAsync("ReceiveDirectMessage", payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast message via SignalR");
        }
    }
}
