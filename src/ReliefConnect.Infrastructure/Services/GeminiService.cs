using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Services;

public class GeminiService : IGeminiService
{
    private readonly HttpClient _http;
    private readonly string _fallbackApiKey;
    private readonly string _fallbackModel;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<GeminiService> _logger;

    private const string SYSTEM_PROMPT =
        """
        Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam.
        Nhiệm vụ: giúp người dùng tìm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, trả lời câu hỏi về tình hình thiên tai.
        Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt. Nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh.
        Không trả lời các nội dung nhạy cảm, chính trị, vi phạm pháp luật.
        """;

    private static string NormalizeModelName(string model)
    {
        var trimmed = model.Trim();
        return trimmed.StartsWith("models/", StringComparison.OrdinalIgnoreCase)
            ? trimmed["models/".Length..]
            : trimmed;
    }

    private static bool SupportsNativeGeminiControls(string model) =>
        NormalizeModelName(model).StartsWith("gemini-", StringComparison.OrdinalIgnoreCase);

    private static string BuildGenerateContentUrl(string model)
    {
        var normalizedModel = NormalizeModelName(model);
        return $"https://generativelanguage.googleapis.com/v1beta/models/{normalizedModel}:generateContent";
    }

    private static string BuildPromptForModel(string model, string userMessage)
    {
        if (SupportsNativeGeminiControls(model)) return userMessage;

        return $"""
               {SYSTEM_PROMPT}

               Trả lời trực tiếp cho người dùng bằng câu trả lời cuối cùng. Không nhắc lại câu hỏi, không nhắc lại hướng dẫn, không viết các nhãn như "System Prompt", "User question", "Role", "Mission" hoặc "Constraint".

               {userMessage}
               """;
    }

    private static readonly string[] PromptLeakageLinePrefixes =
    {
        "System Prompt:", "System Prompt", "SYSTEM_PROMPT:", "User's question:", "User’s question:", "User question:", "Câu hỏi người dùng:",
        "Role:", "Mission:", "Constraint:", "Constraints:", "Identity:",
        "<start_of_turn>user", "<start_of_turn>model", "<end_of_turn>"
    };

    private static readonly string[] SystemPromptFragments =
    {
        "Bạn là trợ lý AI của ReliefConnect",
        "Nhiệm vụ: giúp người dùng",
        "Trả lời ngắn gọn, chính xác",
        "Không trả lời các nội dung nhạy cảm"
    };

    private static string? ExtractGeneratedText(JsonElement root)
    {
        if (root.TryGetProperty("text", out var topLevelText) && topLevelText.ValueKind == JsonValueKind.String)
            return topLevelText.GetString();

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
            return null;

        var builder = new StringBuilder();
        foreach (var candidate in candidates.EnumerateArray())
        {
            if (!candidate.TryGetProperty("content", out var content)) continue;
            if (!content.TryGetProperty("parts", out var parts) || parts.ValueKind != JsonValueKind.Array) continue;

            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var partText) && partText.ValueKind == JsonValueKind.String)
                {
                    builder.Append(partText.GetString());
                }
            }
        }

        var text = builder.ToString().Trim();
        return text.Length > 0 ? text : null;
    }

    private static bool ContainsPromptLeakage(string text) =>
        PromptLeakageLinePrefixes.Any(marker => text.Contains(marker, StringComparison.OrdinalIgnoreCase))
        || SystemPromptFragments.Any(fragment => text.Contains(fragment, StringComparison.OrdinalIgnoreCase));

    private static string ExtractAfterAnswerMarker(string text)
    {
        var markers = new[] { "Final answer:", "Answer:", "Assistant:", "Trả lời:", "Câu trả lời:" };
        var bestIndex = -1;
        var bestMarker = "";

        foreach (var marker in markers)
        {
            var index = text.LastIndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (index > bestIndex)
            {
                bestIndex = index;
                bestMarker = marker;
            }
        }

        return bestIndex >= 0 ? text[(bestIndex + bestMarker.Length)..].Trim() : text;
    }

    private static bool IsPromptLeakageLine(string line, string userMessage)
    {
        var trimmed = line.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return false;

        var normalized = trimmed.TrimStart('-', '*', ' ', '\t');
        if (PromptLeakageLinePrefixes.Any(prefix => normalized.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
            return true;

        if (SystemPromptFragments.Any(fragment => normalized.Contains(fragment, StringComparison.OrdinalIgnoreCase)))
            return true;

        var quoted = normalized.Trim('"', '\'', '“', '”');
        return string.Equals(quoted, userMessage.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string CleanGeneratedText(string text, string userMessage, string model)
    {
        if (SupportsNativeGeminiControls(model)) return text.Trim();

        var cleaned = text
            .Replace("<start_of_turn>model", "", StringComparison.OrdinalIgnoreCase)
            .Replace("<start_of_turn>user", "", StringComparison.OrdinalIgnoreCase)
            .Replace("<end_of_turn>", "", StringComparison.OrdinalIgnoreCase)
            .Trim();

        if (ContainsPromptLeakage(cleaned))
            cleaned = ExtractAfterAnswerMarker(cleaned);

        var lines = cleaned.Replace("\r\n", "\n").Split('\n');
        var keptLines = lines.Where(line => !IsPromptLeakageLine(line, userMessage));
        cleaned = string.Join("\n", keptLines).Trim();

        while (cleaned.Contains("\n\n\n", StringComparison.Ordinal))
            cleaned = cleaned.Replace("\n\n\n", "\n\n", StringComparison.Ordinal);

        return string.IsNullOrWhiteSpace(cleaned)
            ? "Mô hình hiện tại chưa trả về câu trả lời rõ ràng. Vui lòng thử lại."
            : cleaned;
    }

    public GeminiService(IConfiguration config, IServiceScopeFactory scopeFactory, ILogger<GeminiService> logger)
    {
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        _fallbackApiKey = config["Gemini:ApiKey"] ?? "";
        _fallbackModel = config["Gemini:Model"] ?? "gemini-2.5-flash";
        _scopeFactory = scopeFactory;
        _logger = logger;

        _logger.LogInformation("GeminiService initialized with fallback model: {Model}", _fallbackModel);
    }

    /// <summary>
    /// Get the best available API key from the pool (least-used active Gemini key).
    /// Falls back to config key if pool is empty.
    /// </summary>
    private async Task<(string ApiKey, string Model, int? PoolKeyId)> GetApiKeyAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var poolKey = await db.ApiKeys
                .Where(k => k.Provider == AiProvider.Gemini && k.IsActive)
                .OrderBy(k => k.UsageCount)
                .FirstOrDefaultAsync();

            if (poolKey != null)
            {
                var model = string.IsNullOrWhiteSpace(poolKey.Model) ? _fallbackModel : poolKey.Model.Trim();
                return (poolKey.KeyValue, model, poolKey.Id);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch API key from pool, using fallback");
        }

        if (string.IsNullOrEmpty(_fallbackApiKey))
            throw new InvalidOperationException("No API key available (pool empty and Gemini:ApiKey not configured)");

        return (_fallbackApiKey, _fallbackModel, null);
    }

    /// <summary>Track usage of a pool key after successful API call.</summary>
    private async Task TrackUsageAsync(int keyId)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.ApiKeys
                .Where(k => k.Id == keyId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(k => k.UsageCount, k => k.UsageCount + 1)
                    .SetProperty(k => k.LastUsedAt, DateTime.UtcNow));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to track API key usage for key {KeyId}", keyId);
        }
    }

    private static readonly string[] EmergencyKeywords =
    {
        "đau tim", "ngộ độc", "chảy máu", "ngừng thở", "tai nạn", "cấp cứu",
        "heart attack", "poisoning", "bleeding", "emergency", "stopped breathing", "accident"
    };

    private static string MapProviderFailureMessage(HttpStatusCode statusCode)
    {
        return statusCode switch
        {
            HttpStatusCode.ServiceUnavailable or HttpStatusCode.BadGateway or HttpStatusCode.GatewayTimeout =>
                "Trợ lý AI đang quá tải do dịch vụ bên thứ ba tạm thời không sẵn sàng. Vui lòng thử lại sau ít phút.",
            (HttpStatusCode)429 =>
                "Trợ lý AI đang bị giới hạn lưu lượng do nhu cầu cao. Vui lòng thử lại sau ít phút.",
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                "Trợ lý AI đang tạm thời bảo trì kết nối với dịch vụ bên thứ ba. Vui lòng thử lại sau.",
            HttpStatusCode.BadRequest or HttpStatusCode.RequestEntityTooLarge =>
                "Yêu cầu gửi tới trợ lý AI chưa phù hợp. Hãy rút gọn câu hỏi hoặc kiểm tra lại ảnh rồi thử lại.",
            _ when (int)statusCode >= 500 =>
                "Dịch vụ AI bên thứ ba đang gặp sự cố tạm thời. Vui lòng thử lại sau.",
            _ =>
                "Hiện chưa thể kết nối tới dịch vụ AI bên thứ ba. Vui lòng thử lại sau."
        };
    }

    public async Task<AiChatResponse> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null)
    {
        // Validate image params
        var hasImage = !string.IsNullOrEmpty(imageBase64) && !string.IsNullOrEmpty(imageMimeType);
        var allowedImageTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        if (hasImage && !allowedImageTypes.Contains(imageMimeType))
        {
            return new AiChatResponse("Ảnh chưa đúng định dạng hỗ trợ. Vui lòng dùng JPEG, PNG hoặc WebP.", false, false);
        }

        // Check for emergency keywords
        var hasEmergencyKeyword = EmergencyKeywords.Any(keyword =>
            userMessage.Contains(keyword, StringComparison.OrdinalIgnoreCase));

        // Get API key from pool (with fallback to config)
        var (apiKey, model, poolKeyId) = await GetApiKeyAsync();

        var url = BuildGenerateContentUrl(model);
        var effectiveUserMessage = BuildPromptForModel(model, userMessage);
        var supportsNativeGeminiControls = SupportsNativeGeminiControls(model);

        var contents = new List<object>();

        // Add conversation history
        if (conversationHistory != null)
        {
            foreach (var (role, content) in conversationHistory)
            {
                contents.Add(new
                {
                    role = role == "user" ? "user" : "model",
                    parts = new[] { new { text = content } }
                });
            }
        }

        // Add current message (with optional image)
        var currentParts = new List<object>();
        if (hasImage)
        {
            currentParts.Add(new
            {
                inline_data = new
                {
                    mime_type = imageMimeType!,
                    data = imageBase64!
                }
            });
        }
        currentParts.Add(new { text = effectiveUserMessage });

        contents.Add(new
        {
            role = "user",
            parts = currentParts.ToArray()
        });

        var requestBody = new Dictionary<string, object?>
        {
            ["contents"] = contents,
            ["generationConfig"] = new
            {
                maxOutputTokens = 1024,
                temperature = 0.7
            }
        };

        if (supportsNativeGeminiControls)
        {
            requestBody["systemInstruction"] = new
            {
                parts = new[] { new { text = SYSTEM_PROMPT } }
            };
            requestBody["safetySettings"] = new[]
            {
                new { category = "HARM_CATEGORY_HARASSMENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_HATE_SPEECH", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_DANGEROUS_CONTENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
            };
        }

        try
        {
            _logger.LogInformation("Calling Gemini API: model={Model}, msgLen={Length}, poolKey={PoolKeyId}", model, userMessage.Length, poolKeyId);

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("x-goog-api-key", apiKey);
            request.Content = JsonContent.Create(requestBody);

            var response = await _http.SendAsync(request);
            var json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini API error {StatusCode}: {Body}", response.StatusCode, json);
                return new AiChatResponse(MapProviderFailureMessage(response.StatusCode), false, false);
            }

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Check for safety block
            if (root.TryGetProperty("promptFeedback", out var feedback) &&
                feedback.TryGetProperty("blockReason", out _))
            {
                _logger.LogWarning("Gemini safety block triggered");
                return new AiChatResponse("Xin lỗi, tôi không thể trả lời câu hỏi này vì lý do an toàn.", true, false);
            }

            // Extract text response
            var text = ExtractGeneratedText(root);
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("Gemini returned no text content. Response: {Json}", json);
                return new AiChatResponse("Mô hình AI hiện tại chưa trả về nội dung văn bản phù hợp cho chatbot. Vui lòng thử lại hoặc chọn model hỗ trợ phản hồi văn bản.", false, false);
            }

            text = CleanGeneratedText(text, userMessage, model);

            // Check for safety ratings
            var hasSafetyWarning = hasEmergencyKeyword;
            if (root.TryGetProperty("candidates", out var candidates)
                && candidates.ValueKind == JsonValueKind.Array
                && candidates.GetArrayLength() > 0
                && candidates[0].TryGetProperty("safetyRatings", out var ratings))
            {
                foreach (var rating in ratings.EnumerateArray())
                {
                    var probability = rating.GetProperty("probability").GetString();
                    if (probability is "HIGH" or "MEDIUM")
                    {
                        hasSafetyWarning = true;
                        break;
                    }
                }
            }

            _logger.LogInformation("Gemini responded successfully, length={Length}", text.Length);

            // Track pool key usage
            if (poolKeyId.HasValue)
                _ = TrackUsageAsync(poolKeyId.Value);

            return new AiChatResponse(text, hasSafetyWarning, true);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Gemini API is not configured correctly");
            return new AiChatResponse("Trợ lý AI đang tạm thời bảo trì cấu hình dịch vụ. Vui lòng thử lại sau.", false, false);
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException || !ex.CancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini API timeout after 30s");
            return new AiChatResponse("Xin lỗi, phản hồi quá lâu. Vui lòng thử lại với câu hỏi ngắn hơn.", false, false);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Gemini API network failure");
            return new AiChatResponse("Không thể kết nối tới dịch vụ AI bên thứ ba. Vui lòng kiểm tra mạng và thử lại sau.", false, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call Gemini API");
            return new AiChatResponse("Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.", false, false);
        }
    }
}
