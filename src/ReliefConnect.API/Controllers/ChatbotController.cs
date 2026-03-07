using System.Security.Claims;
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

    public ChatbotController(AppDbContext db, IGeminiService gemini, ILogger<ChatbotController> logger)
    {
        _db = db;
        _gemini = gemini;
        _logger = logger;
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
    public async Task<ActionResult<MessageResponseDto>> SendMessage(int conversationId, [FromBody] SendMessageDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var conversation = await _db.Set<Conversation>()
            .Include(c => c.Messages.OrderBy(m => m.SentAt).Take(20))
            .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId);

        if (conversation == null)
            return NotFound(new { message = "Conversation not found." });

        // Save user message
        var userMessage = new Message
        {
            ConversationId = conversationId,
            SenderId = userId,
            Content = dto.Content,
            IsBotMessage = false,
            SentAt = DateTime.UtcNow
        };
        _db.Set<Message>().Add(userMessage);

        // Build conversation history for context
        var history = conversation.Messages
            .Select(m => (m.IsBotMessage ? "model" : "user", m.Content))
            .ToList();

        // Call Gemini
        var (response, hasSafetyWarning) = await _gemini.SendMessageAsync(dto.Content, history);

        // Save bot response
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

        var conversation = await _db.Set<Conversation>()
            .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId);

        if (conversation == null)
            return NotFound(new { message = "Conversation not found." });

        var messages = await _db.Set<Message>()
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
