namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Service contract for Google Gemini AI chatbot integration (REQ-BOT-01/02/03).
/// </summary>
public interface IGeminiService
{
    /// <summary>
    /// Send a message to Gemini and get a response.
    /// Returns (responseText, hasSafetyWarning).
    /// </summary>
    Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(string userMessage, IEnumerable<(string Role, string Content)>? conversationHistory = null);
}
