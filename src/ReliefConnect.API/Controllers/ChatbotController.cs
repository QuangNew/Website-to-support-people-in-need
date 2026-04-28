using System.Data;
using System.Data.Common;
using System.Security.Claims;
using Ganss.Xss;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatbotController : ControllerBase
{
    private const int ChatbotDailySuccessLimit = 5;

    private readonly AppDbContext _db;
    private readonly IGeminiService _gemini;
    private readonly ILogger<ChatbotController> _logger;
    private readonly HtmlSanitizer _sanitizer;

    public ChatbotController(AppDbContext db, IGeminiService gemini, ILogger<ChatbotController> logger, HtmlSanitizer sanitizer)
    {
        _db = db;
        _gemini = gemini;
        _logger = logger;
        _sanitizer = sanitizer;
    }

    private async Task<int> CountSuccessfulChatbotRepliesTodayAsync(string userId)
    {
        var todayUtc = DateTime.UtcNow.Date;
        return await _db.Set<Message>()
            .AsNoTracking()
            .CountAsync(m => m.IsBotMessage && m.SentAt >= todayUtc && m.Conversation.UserId == userId);
    }

    private static ActionResult DailyChatbotLimitExceeded() =>
        new ObjectResult(new { message = "Bạn đã đạt giới hạn 5 phản hồi chatbot thành công trong ngày. Vui lòng quay lại vào ngày mai." })
        {
            StatusCode = 429
        };

    private async Task<MessageResponseDto?> TrySaveSuccessfulChatbotReplyAsync(
        int conversationId,
        string userId,
        string userContent,
        AiChatResponse aiResponse,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var todayUtc = now.Date;
        var tomorrowUtc = todayUtc.AddDays(1);
        var quotaKey = $"chatbot-success:{userId}:{todayUtc:yyyyMMdd}";

        var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            WITH existing_success AS (
                SELECT COUNT(*)::integer AS success_count
                FROM "Messages" AS m
                INNER JOIN "Conversations" AS c ON c."Id" = m."ConversationId"
                WHERE m."IsBotMessage" = TRUE
                  AND m."SentAt" >= @todayUtc
                  AND c."UserId" = @userId
            ), quota AS (
                INSERT INTO "RateLimitCounters" ("Key", "Count", "WindowStartedAt", "ExpiresAt", "UpdatedAt")
                SELECT @quotaKey, existing_success.success_count + 1, @todayUtc, @tomorrowUtc, @now
                FROM existing_success
                WHERE existing_success.success_count < @limit
                ON CONFLICT ("Key") DO UPDATE
                SET
                    "Count" = CASE
                        WHEN "RateLimitCounters"."ExpiresAt" <= @now THEN (SELECT success_count FROM existing_success) + 1
                        ELSE GREATEST("RateLimitCounters"."Count", (SELECT success_count FROM existing_success)) + 1
                    END,
                    "WindowStartedAt" = CASE
                        WHEN "RateLimitCounters"."ExpiresAt" <= @now THEN @todayUtc
                        ELSE "RateLimitCounters"."WindowStartedAt"
                    END,
                    "ExpiresAt" = CASE
                        WHEN "RateLimitCounters"."ExpiresAt" <= @now THEN @tomorrowUtc
                        ELSE GREATEST("RateLimitCounters"."ExpiresAt", @tomorrowUtc)
                    END,
                    "UpdatedAt" = @now
                WHERE
                    ("RateLimitCounters"."ExpiresAt" <= @now AND (SELECT success_count FROM existing_success) < @limit)
                    OR (
                        "RateLimitCounters"."ExpiresAt" > @now
                        AND GREATEST("RateLimitCounters"."Count", (SELECT success_count FROM existing_success)) < @limit
                    )
                RETURNING "Count"
            ), insert_user AS (
                INSERT INTO "Messages" ("Content", "IsBotMessage", "HasSafetyWarning", "SentAt", "ConversationId", "SenderId")
                SELECT @userContent, FALSE, FALSE, @now, @conversationId, @userId
                FROM quota
                RETURNING "Id"
            ), insert_bot AS (
                INSERT INTO "Messages" ("Content", "IsBotMessage", "HasSafetyWarning", "SentAt", "ConversationId", "SenderId")
                SELECT @botContent, TRUE, @hasSafetyWarning, @now, @conversationId, NULL
                FROM insert_user
                RETURNING "Id", "Content", "IsBotMessage", "HasSafetyWarning", "SentAt"
            )
            SELECT "Id", "Content", "IsBotMessage", "HasSafetyWarning", "SentAt"
            FROM insert_bot;
            """;

        AddParameter(command, "quotaKey", quotaKey);
        AddParameter(command, "todayUtc", todayUtc);
        AddParameter(command, "tomorrowUtc", tomorrowUtc);
        AddParameter(command, "now", now);
        AddParameter(command, "limit", ChatbotDailySuccessLimit);
        AddParameter(command, "conversationId", conversationId);
        AddParameter(command, "userId", userId);
        AddParameter(command, "userContent", userContent);
        AddParameter(command, "botContent", aiResponse.Response);
        AddParameter(command, "hasSafetyWarning", aiResponse.HasSafetyWarning);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            return null;

        return new MessageResponseDto
        {
            Id = reader.GetInt32(0),
            Content = reader.GetString(1),
            IsBotMessage = reader.GetBoolean(2),
            HasSafetyWarning = reader.GetBoolean(3),
            SentAt = reader.GetDateTime(4)
        };
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    /// <summary>
    /// Create a new chatbot conversation.
    /// </summary>
    [HttpPost("conversations")]
    public async Task<ActionResult> CreateConversation()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var conversation = new Conversation
        {
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Set<Conversation>().Add(conversation);
        await _db.SaveChangesAsync();

        return Ok(new { id = conversation.Id });
    }

    /// <summary>
    /// Send a message to the chatbot and get an AI response.
    /// </summary>
    [HttpPost("conversations/{conversationId}/messages")]
    [RequestSizeLimit(6_000_000)] // 6MB to accommodate base64-encoded images
    public async Task<ActionResult<MessageResponseDto>> SendMessage(int conversationId, [FromBody] SendMessageDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        if (await CountSuccessfulChatbotRepliesTodayAsync(userId) >= ChatbotDailySuccessLimit)
            return DailyChatbotLimitExceeded();

        // Validate image fields: both must be present or both absent
        var hasBase64 = !string.IsNullOrEmpty(dto.ImageBase64);
        var hasMime = !string.IsNullOrEmpty(dto.ImageMimeType);
        if (hasBase64 != hasMime)
            return BadRequest(new { message = "ImageBase64 and ImageMimeType must both be provided or both omitted." });

        // Validate base64 is decodable and within binary size limit
        if (hasBase64)
        {
            try
            {
                var imageBytes = Convert.FromBase64String(dto.ImageBase64!);
                if (imageBytes.Length > 4 * 1024 * 1024)
                    return BadRequest(new { message = "Image exceeds 4 MB limit." });
            }
            catch (FormatException)
            {
                return BadRequest(new { message = "Invalid base64 image data." });
            }
        }

        // Verify ownership with a lightweight query (no Include)
        var conversationExists = await _db.Set<Conversation>()
            .AsNoTracking()
            .AnyAsync(c => c.Id == conversationId && c.UserId == userId);

        if (!conversationExists)
            return NotFound(new { message = "Conversation not found." });

        var history = await _db.Set<Message>()
            .AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderByDescending(m => m.SentAt)
            .Take(20)
            .ToListAsync();

        var historyTuples = history
            .OrderBy(m => m.SentAt)
            .Select(m => (m.IsBotMessage ? "model" : "user", m.Content))
            .ToList();

        var aiResponse = await _gemini.SendMessageAsync(
            dto.Content, historyTuples, dto.ImageBase64, dto.ImageMimeType);

        if (!aiResponse.CountsTowardQuota)
        {
            return Ok(new MessageResponseDto
            {
                Id = 0,
                Content = aiResponse.Response,
                IsBotMessage = true,
                HasSafetyWarning = aiResponse.HasSafetyWarning,
                SentAt = DateTime.UtcNow
            });
        }

        var savedBotMessage = await TrySaveSuccessfulChatbotReplyAsync(
            conversationId,
            userId,
            _sanitizer.Sanitize(dto.Content),
            aiResponse,
            HttpContext.RequestAborted);

        if (savedBotMessage == null)
            return DailyChatbotLimitExceeded();

        _logger.LogInformation("Chatbot response for conversation {ConversationId}", conversationId);

        return Ok(savedBotMessage);
    }

    /// <summary>
    /// Get all messages in a conversation.
    /// </summary>
    [HttpGet("conversations/{conversationId}/messages")]
    public async Task<ActionResult<IEnumerable<MessageResponseDto>>> GetMessages(int conversationId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        // Verify ownership with lightweight check
        var conversationExists = await _db.Set<Conversation>()
            .AsNoTracking()
            .AnyAsync(c => c.Id == conversationId && c.UserId == userId);

        if (!conversationExists)
            return NotFound(new { message = "Conversation not found." });

        var messages = await _db.Set<Message>()
            .AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.SentAt)
            .Select(m => new MessageResponseDto
            {
                Id = m.Id,
                Content = m.Content,
                IsBotMessage = m.IsBotMessage,
                HasSafetyWarning = m.HasSafetyWarning,
                SentAt = m.SentAt
            })
            .ToListAsync();

        return Ok(messages);
    }
}
