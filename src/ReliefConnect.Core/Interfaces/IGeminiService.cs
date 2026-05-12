namespace ReliefConnect.Core.Interfaces;

public record AiChatResponse(string Response, bool HasSafetyWarning, bool CountsTowardQuota);

public record ApiKeyTestResult(bool Success, string Message, string? ErrorCode, DateTime? CooldownUntil);

public interface IAiChatService
{
    Task<AiChatResponse> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null,
        CancellationToken cancellationToken = default);

    Task<ApiKeyTestResult> TestApiKeyAsync(int apiKeyId, CancellationToken cancellationToken = default);
}
