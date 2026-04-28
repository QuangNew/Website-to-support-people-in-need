namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Service contract for Google Gemini AI chatbot integration (REQ-BOT-01/02/03).
/// </summary>
public record AiChatResponse(string Response, bool HasSafetyWarning, bool CountsTowardQuota);

public interface IGeminiService
{
    /// <summary>
    /// Send a message to Gemini and get a response.
    /// </summary>
    Task<AiChatResponse> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null);
}
