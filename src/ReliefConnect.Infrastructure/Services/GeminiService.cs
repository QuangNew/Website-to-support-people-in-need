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
                return (poolKey.KeyValue, poolKey.Model, poolKey.Id);
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

    public async Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
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
            return ("Unsupported image type. Please use JPEG, PNG, or WebP.", false);
        }

        // Check for emergency keywords
        var hasEmergencyKeyword = EmergencyKeywords.Any(keyword =>
            userMessage.Contains(keyword, StringComparison.OrdinalIgnoreCase));

        // Get API key from pool (with fallback to config)
        var (apiKey, model, poolKeyId) = await GetApiKeyAsync();

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

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
        currentParts.Add(new { text = userMessage });

        contents.Add(new
        {
            role = "user",
            parts = currentParts.ToArray()
        });

        var requestBody = new
        {
            systemInstruction = new
            {
                parts = new[] { new { text = SYSTEM_PROMPT } }
            },
            contents,
            safetySettings = new[]
            {
                new { category = "HARM_CATEGORY_HARASSMENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_HATE_SPEECH", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_DANGEROUS_CONTENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
            },
            generationConfig = new
            {
                maxOutputTokens = 1024,
                temperature = 0.7
            }
        };

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
                return ($"Xin lỗi, tôi đang gặp sự cố (HTTP {(int)response.StatusCode}). Vui lòng thử lại sau.", false);
            }

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Check for safety block
            if (root.TryGetProperty("promptFeedback", out var feedback) &&
                feedback.TryGetProperty("blockReason", out _))
            {
                _logger.LogWarning("Gemini safety block triggered");
                return ("Xin lỗi, tôi không thể trả lời câu hỏi này vì lý do an toàn.", true);
            }

            // Extract text response
            if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini returned no candidates. Response: {Json}", json);
                return ("Xin lỗi, tôi không nhận được phản hồi. Vui lòng thử lại.", false);
            }

            var text = candidates[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString() ?? "Xin lỗi, tôi không thể trả lời lúc này.";

            // Check for safety ratings
            var hasSafetyWarning = hasEmergencyKeyword;
            if (candidates[0].TryGetProperty("safetyRatings", out var ratings))
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

            return (text, hasSafetyWarning);
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException || !ex.CancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini API timeout after 30s");
            return ("Xin lỗi, phản hồi quá lâu. Vui lòng thử lại với câu hỏi ngắn hơn.", false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call Gemini API");
            return ("Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.", false);
        }
    }
}
