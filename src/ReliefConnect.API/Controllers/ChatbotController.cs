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

        // Save user message IMMEDIATELY (before the long Gemini call)
        // This prevents ObjectDisposedException when Npgsql connection idles during the API call
        var userMessage = new Message
        {
            ConversationId = conversationId,
            SenderId = userId,
            Content = _sanitizer.Sanitize(dto.Content),
            IsBotMessage = false,
            SentAt = DateTime.UtcNow
        };
        _db.Set<Message>().Add(userMessage);
        await _db.SaveChangesAsync();

        // Fetch last 20 messages for Gemini context
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

        // Call Gemini (can take 5-30 seconds)
        var (response, hasSafetyWarning) = await _gemini.SendMessageAsync(
            dto.Content, historyTuples, dto.ImageBase64, dto.ImageMimeType);

        // Save bot response in a separate DB round-trip (fresh connection from pool)
        var botMessage = new Message
        {
            ConversationId = conversationId,
            Content = response,
            IsBotMessage = true,
            HasSafetyWarning = hasSafetyWarning,
            SentAt = DateTime.UtcNow
        };
        _db.Set<Message>().Add(botMessage);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Chatbot response for conversation {ConversationId}", conversationId);

        return Ok(new MessageResponseDto
        {
            Id = botMessage.Id,
            Content = botMessage.Content,
            IsBotMessage = true,
            HasSafetyWarning = hasSafetyWarning,
            SentAt = botMessage.SentAt
        });
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
