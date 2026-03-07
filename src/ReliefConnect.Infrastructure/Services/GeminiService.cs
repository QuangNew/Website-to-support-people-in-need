using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

public class GeminiService : IGeminiService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly ILogger<GeminiService> _logger;

    private const string SYSTEM_PROMPT =
        """
        Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam.
        Nhiệm vụ: giúp người dùng tìm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, trả lời câu hỏi về tình hình thiên tai.
        Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt. Nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh.
        Không trả lời các nội dung nhạy cảm, chính trị, vi phạm pháp luật.
        """;

    public GeminiService(IConfiguration config, ILogger<GeminiService> logger)
    {
        _http = new HttpClient();
        _apiKey = config["Gemini:ApiKey"] ?? throw new InvalidOperationException("Gemini:ApiKey not configured");
        _model = config["Gemini:Model"] ?? "gemini-2.0-flash";
        _logger = logger;
    }

    public async Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null)
    {
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}";

        var contents = new List<object>();

        // System instruction as first user turn
        contents.Add(new
        {
            role = "user",
            parts = new[] { new { text = SYSTEM_PROMPT } }
        });
        contents.Add(new
        {
            role = "model",
            parts = new[] { new { text = "Xin chào! Tôi là trợ lý AI của ReliefConnect. Tôi sẵn sàng hỗ trợ bạn." } }
        });

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

        // Add current message
        contents.Add(new
        {
            role = "user",
            parts = new[] { new { text = userMessage } }
        });

        var requestBody = new
        {
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
            var response = await _http.PostAsJsonAsync(url, requestBody);
            var json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini API error {StatusCode}: {Body}", response.StatusCode, json);
                return ("Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau.", false);
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
            var candidates = root.GetProperty("candidates");
            var text = candidates[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString() ?? "Xin lỗi, tôi không thể trả lời lúc này.";

            // Check for safety ratings
            var hasSafetyWarning = false;
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

            return (text, hasSafetyWarning);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call Gemini API");
            return ("Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.", false);
        }
    }
}
