using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Services;

public sealed class AiChatService : IAiChatService
{
    private readonly string _fallbackApiKey;
    private readonly string _fallbackModel;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AiChatService> _logger;
    private readonly IReadOnlyDictionary<AiProvider, IAiProviderClient> _clients;

    private static readonly string[] EmergencyKeywords =
    {
        "đau tim", "ngộ độc", "chảy máu", "ngừng thở", "tai nạn", "cấp cứu",
        "heart attack", "poisoning", "bleeding", "emergency", "stopped breathing", "accident"
    };

    public AiChatService(
        IConfiguration config,
        IServiceScopeFactory scopeFactory,
        IEnumerable<IAiProviderClient> clients,
        ILogger<AiChatService> logger)
    {
        _fallbackApiKey = config["Gemini:ApiKey"] ?? "";
        _fallbackModel = AiProviderCatalog.NormalizeModel(AiProvider.Gemini, config["Gemini:Model"] ?? AiProviderCatalog.GetDefaultModel(AiProvider.Gemini));
        _scopeFactory = scopeFactory;
        _logger = logger;
        _clients = clients.ToDictionary(c => c.Provider);

        _logger.LogInformation("AI chat service initialized with Gemini fallback model: {Model}", _fallbackModel);
    }

    public async Task<AiChatResponse> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null,
        CancellationToken cancellationToken = default)
    {
        var hasImage = !string.IsNullOrEmpty(imageBase64) && !string.IsNullOrEmpty(imageMimeType);
        if (hasImage && !AiImagePolicy.AllowedMimeTypes.Contains(imageMimeType!))
            return new AiChatResponse("Ảnh chưa đúng định dạng hỗ trợ. Vui lòng dùng JPEG, PNG hoặc WebP.", false, false);

        var candidates = await GetCandidateKeysAsync(hasImage, cancellationToken);
        if (candidates.Count == 0)
        {
            var message = hasImage
                ? "Hiện chưa có API key hoặc model AI nào đang hoạt động hỗ trợ ảnh. Vui lòng thử lại bằng câu hỏi văn bản hoặc liên hệ quản trị viên."
                : "Trợ lý AI đang tạm thời bảo trì cấu hình dịch vụ. Vui lòng thử lại sau.";
            return new AiChatResponse(message, false, false);
        }

        var hasEmergencyKeyword = EmergencyKeywords.Any(keyword =>
            userMessage.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        AiProviderFailure? lastFailure = null;

        foreach (var poolKey in candidates)
        {
            if (!_clients.TryGetValue(poolKey.Provider, out var client))
            {
                lastFailure = new AiProviderFailure("CLIENT_NOT_REGISTERED", "Provider client is not registered.", false, TimeSpan.FromMinutes(30));
                if (poolKey.PoolKeyId.HasValue)
                    await TrackFailureAsync(poolKey.PoolKeyId.Value, lastFailure, cancellationToken);
                continue;
            }

            var request = new AiProviderChatRequest(
                poolKey.ApiKey,
                poolKey.Model,
                userMessage,
                (conversationHistory ?? []).ToList(),
                imageBase64,
                imageMimeType,
                hasEmergencyKeyword);

            _logger.LogInformation(
                "Calling AI provider: provider={Provider}, model={Model}, msgLen={Length}, poolKey={PoolKeyId}",
                poolKey.Provider,
                poolKey.Model,
                userMessage.Length,
                poolKey.PoolKeyId);

            var result = await SendWithProviderAsync(client, request, poolKey, cancellationToken);
            if (result.Success)
            {
                if (poolKey.PoolKeyId.HasValue)
                    await TrackSuccessAsync(poolKey.PoolKeyId.Value, incrementUsage: true, cancellationToken);

                return new AiChatResponse(result.Response ?? string.Empty, result.HasSafetyWarning, result.CountsTowardQuota);
            }

            lastFailure = result.Failure;
            if (poolKey.PoolKeyId.HasValue && lastFailure != null)
                await TrackFailureAsync(poolKey.PoolKeyId.Value, lastFailure, cancellationToken);
        }

        return new AiChatResponse(AiProviderErrors.GetUserMessage(lastFailure), false, false);
    }

    public async Task<ApiKeyTestResult> TestApiKeyAsync(int apiKeyId, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var key = await db.ApiKeys.AsNoTracking().FirstOrDefaultAsync(k => k.Id == apiKeyId, cancellationToken);
        if (key == null)
            return new ApiKeyTestResult(false, "API key not found.", "NOT_FOUND", null);

        var provider = AiProviderCatalog.NormalizeProvider(key.Provider);
        var model = string.IsNullOrWhiteSpace(key.Model)
            ? AiProviderCatalog.GetDefaultModel(provider)
            : AiProviderCatalog.NormalizeModel(provider, key.Model);

        if (!AiProviderCatalog.IsModelAllowed(provider, model))
        {
            var failure = new AiProviderFailure("INVALID_MODEL", $"Model '{key.Model}' is not allowed for {AiProviderCatalog.GetProviderLabel(provider)}.", false, TimeSpan.FromHours(12));
            await TrackFailureAsync(key.Id, failure, cancellationToken);
            return new ApiKeyTestResult(false, failure.Message, failure.Code, DateTime.UtcNow.Add(failure.Cooldown));
        }

        if (!_clients.TryGetValue(provider, out var client))
        {
            var failure = new AiProviderFailure("CLIENT_NOT_REGISTERED", "Provider client is not registered.", false, TimeSpan.FromMinutes(30));
            await TrackFailureAsync(key.Id, failure, cancellationToken);
            return new ApiKeyTestResult(false, failure.Message, failure.Code, DateTime.UtcNow.Add(failure.Cooldown));
        }

        var request = new AiProviderChatRequest(
            key.KeyValue,
            model,
            "Reply with OK only.",
            [],
            null,
            null,
            false);

        var result = await SendWithProviderAsync(client, request, new AiPoolKey(provider, key.KeyValue, model, key.Id), cancellationToken);
        if (result.Success)
        {
            await TrackSuccessAsync(key.Id, incrementUsage: false, cancellationToken);
            return new ApiKeyTestResult(true, "Connection test succeeded.", null, null);
        }

        var providerFailure = result.Failure ?? new AiProviderFailure("UNKNOWN", "Connection test failed.", true, TimeSpan.FromMinutes(5));
        await TrackFailureAsync(key.Id, providerFailure, cancellationToken);
        return new ApiKeyTestResult(false, providerFailure.Message, providerFailure.Code, DateTime.UtcNow.Add(providerFailure.Cooldown));
    }

    private async Task<AiProviderResult> SendWithProviderAsync(
        IAiProviderClient client,
        AiProviderChatRequest request,
        AiPoolKey poolKey,
        CancellationToken cancellationToken)
    {
        try
        {
            return await client.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException || !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("AI provider timeout: provider={Provider}, model={Model}, poolKey={PoolKeyId}", poolKey.Provider, poolKey.Model, poolKey.PoolKeyId);
            return AiProviderResult.Failed(new AiProviderFailure("TIMEOUT", "Provider request timed out.", true, TimeSpan.FromMinutes(3)));
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "AI provider network failure: provider={Provider}, model={Model}, poolKey={PoolKeyId}", poolKey.Provider, poolKey.Model, poolKey.PoolKeyId);
            return AiProviderResult.Failed(new AiProviderFailure("NETWORK", "Provider network request failed.", true, TimeSpan.FromMinutes(3)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI provider unexpected failure: provider={Provider}, model={Model}, poolKey={PoolKeyId}", poolKey.Provider, poolKey.Model, poolKey.PoolKeyId);
            return AiProviderResult.Failed(new AiProviderFailure("UNEXPECTED", "Provider request failed unexpectedly.", true, TimeSpan.FromMinutes(5)));
        }
    }

    private async Task<IReadOnlyList<AiPoolKey>> GetCandidateKeysAsync(bool requiresImage, CancellationToken cancellationToken)
    {
        var candidates = new List<AiPoolKey>();
        var now = DateTime.UtcNow;

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var poolKeys = await db.ApiKeys
                .AsNoTracking()
                .Where(k => k.IsActive && (k.CooldownUntil == null || k.CooldownUntil <= now))
                .OrderBy(k => k.LastUsedAt ?? DateTime.MinValue)
                .ThenBy(k => k.FailureCount)
                .ThenBy(k => k.UsageCount)
                .ThenBy(k => k.Id)
                .ToListAsync(cancellationToken);

            foreach (var key in poolKeys)
            {
                var provider = AiProviderCatalog.NormalizeProvider(key.Provider);
                var model = string.IsNullOrWhiteSpace(key.Model)
                    ? AiProviderCatalog.GetDefaultModel(provider)
                    : AiProviderCatalog.NormalizeModel(provider, key.Model);

                if (!_clients.ContainsKey(provider)) continue;
                if (!AiProviderCatalog.IsModelAllowed(provider, model)) continue;
                if (requiresImage && !AiProviderCatalog.SupportsImages(provider, model)) continue;

                candidates.Add(new AiPoolKey(provider, key.KeyValue, model, key.Id));
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch API keys from pool with health fields; trying legacy ApiKeys schema before fallback");
            candidates.AddRange(await GetLegacyCandidateKeysAsync(requiresImage, cancellationToken));
        }

        if (!string.IsNullOrWhiteSpace(_fallbackApiKey)
            && (!requiresImage || AiProviderCatalog.SupportsImages(AiProvider.Gemini, _fallbackModel))
            && _clients.ContainsKey(AiProvider.Gemini))
        {
            candidates.Add(new AiPoolKey(AiProvider.Gemini, _fallbackApiKey, _fallbackModel, null));
        }

        return candidates;
    }

    private async Task<IReadOnlyList<AiPoolKey>> GetLegacyCandidateKeysAsync(bool requiresImage, CancellationToken cancellationToken)
    {
        var candidates = new List<AiPoolKey>();

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var connection = db.Database.GetDbConnection();

            if (connection.State != ConnectionState.Open)
                await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "Id", "Provider", "KeyValue", "Model"
                FROM "ApiKeys"
                WHERE "IsActive" = TRUE
                ORDER BY "UsageCount" ASC, "Id" ASC
                LIMIT 20
                """;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (!TryReadProvider(reader.GetValue(1), out var provider))
                    continue;

                provider = AiProviderCatalog.NormalizeProvider(provider);
                var model = reader.IsDBNull(3)
                    ? AiProviderCatalog.GetDefaultModel(provider)
                    : AiProviderCatalog.NormalizeModel(provider, reader.GetString(3));

                if (!_clients.ContainsKey(provider)) continue;
                if (!AiProviderCatalog.IsModelAllowed(provider, model)) continue;
                if (requiresImage && !AiProviderCatalog.SupportsImages(provider, model)) continue;

                candidates.Add(new AiPoolKey(provider, reader.GetString(2), model, reader.GetInt32(0)));
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch API keys from legacy ApiKeys schema");
        }

        return candidates;
    }

    private static bool TryReadProvider(object value, out AiProvider provider)
    {
        provider = default;
        if (value is int intValue && Enum.IsDefined(typeof(AiProvider), intValue))
        {
            provider = AiProviderCatalog.NormalizeProvider((AiProvider)intValue);
            return true;
        }

        return AiProviderCatalog.TryNormalizeProvider(Convert.ToString(value), out provider);
    }

    private async Task TrackSuccessAsync(int keyId, bool incrementUsage, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;

            await db.ApiKeys
                .Where(k => k.Id == keyId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(k => k.UsageCount, k => incrementUsage ? k.UsageCount + 1 : k.UsageCount)
                    .SetProperty(k => k.LastUsedAt, k => incrementUsage ? now : k.LastUsedAt)
                    .SetProperty(k => k.FailureCount, 0)
                    .SetProperty(k => k.LastFailedAt, (DateTime?)null)
                    .SetProperty(k => k.CooldownUntil, (DateTime?)null)
                    .SetProperty(k => k.LastErrorCode, (string?)null)
                    .SetProperty(k => k.LastErrorMessage, (string?)null),
                    cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to track successful API key usage for key {KeyId}", keyId);
        }
    }

    private async Task TrackFailureAsync(int keyId, AiProviderFailure failure, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var cooldownUntil = now.Add(failure.Cooldown);
            var message = TrimForStorage(failure.Message, 240);

            await db.ApiKeys
                .Where(k => k.Id == keyId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(k => k.FailureCount, k => k.FailureCount + 1)
                    .SetProperty(k => k.LastFailedAt, now)
                    .SetProperty(k => k.CooldownUntil, cooldownUntil)
                    .SetProperty(k => k.LastErrorCode, TrimForStorage(failure.Code, 80))
                    .SetProperty(k => k.LastErrorMessage, message),
                    cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to track API key failure for key {KeyId}", keyId);
        }
    }

    private static string TrimForStorage(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}

public sealed record AiProviderChatRequest(
    string ApiKey,
    string Model,
    string UserMessage,
    IReadOnlyList<(string Role, string Content)> ConversationHistory,
    string? ImageBase64,
    string? ImageMimeType,
    bool HasEmergencyKeyword)
{
    public bool HasImage => !string.IsNullOrEmpty(ImageBase64) && !string.IsNullOrEmpty(ImageMimeType);
}

public sealed record AiProviderFailure(string Code, string Message, bool Retryable, TimeSpan Cooldown);

public sealed record AiProviderResult(
    string? Response,
    bool HasSafetyWarning,
    bool CountsTowardQuota,
    AiProviderFailure? Failure)
{
    public bool Success => Failure == null;

    public static AiProviderResult Succeeded(string response, bool hasSafetyWarning, bool countsTowardQuota = true) =>
        new(response, hasSafetyWarning, countsTowardQuota, null);

    public static AiProviderResult Failed(AiProviderFailure failure) =>
        new(null, false, false, failure);
}

public interface IAiProviderClient
{
    AiProvider Provider { get; }

    Task<AiProviderResult> SendAsync(AiProviderChatRequest request, CancellationToken cancellationToken);
}

public sealed class GeminiProviderClient : IAiProviderClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GeminiProviderClient> _logger;

    public AiProvider Provider => AiProvider.Gemini;

    public GeminiProviderClient(IHttpClientFactory httpClientFactory, ILogger<GeminiProviderClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<AiProviderResult> SendAsync(AiProviderChatRequest request, CancellationToken cancellationToken)
    {
        var model = AiProviderCatalog.NormalizeModel(AiProvider.Gemini, request.Model);
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
        var supportsNativeGeminiControls = SupportsNativeGeminiControls(model);
        var contents = new List<object>();

        foreach (var (role, content) in request.ConversationHistory)
        {
            contents.Add(new
            {
                role = role == "user" ? "user" : "model",
                parts = new[] { new { text = content } }
            });
        }

        var currentParts = new List<object>();
        if (request.HasImage)
        {
            currentParts.Add(new
            {
                inline_data = new
                {
                    mime_type = request.ImageMimeType!,
                    data = request.ImageBase64!
                }
            });
        }

        currentParts.Add(new { text = BuildPromptForModel(model, request.UserMessage) });
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
                parts = new[] { new { text = AiProviderPrompts.SystemPrompt } }
            };
            requestBody["safetySettings"] = new[]
            {
                new { category = "HARM_CATEGORY_HARASSMENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_HATE_SPEECH", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
                new { category = "HARM_CATEGORY_DANGEROUS_CONTENT", threshold = "BLOCK_MEDIUM_AND_ABOVE" },
            };
        }

        var http = _httpClientFactory.CreateClient("AiProviders");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Add("x-goog-api-key", request.ApiKey);
        httpRequest.Content = JsonContent.Create(requestBody);

        using var response = await http.SendAsync(httpRequest, cancellationToken);
        var json = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Gemini API error {StatusCode} for model {Model}", response.StatusCode, model);
            return AiProviderResult.Failed(AiProviderErrors.CreateFailure(response.StatusCode, json));
        }

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("promptFeedback", out var feedback) &&
            feedback.TryGetProperty("blockReason", out _))
        {
            _logger.LogWarning("Gemini safety block triggered for model {Model}", model);
            return AiProviderResult.Succeeded("Xin lỗi, tôi không thể trả lời câu hỏi này vì lý do an toàn.", true);
        }

        var text = ExtractGeneratedText(root);
        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogWarning("Gemini returned no text content for model {Model}", model);
            return AiProviderResult.Failed(new AiProviderFailure("EMPTY_RESPONSE", "Provider returned no text content.", true, TimeSpan.FromMinutes(3)));
        }

        text = CleanGeneratedText(text, request.UserMessage, model);
        var hasSafetyWarning = request.HasEmergencyKeyword || HasGeminiSafetyWarning(root);
        _logger.LogInformation("Gemini responded successfully, length={Length}", text.Length);
        return AiProviderResult.Succeeded(text, hasSafetyWarning);
    }

    private static bool SupportsNativeGeminiControls(string model) =>
        model.StartsWith("gemini-", StringComparison.OrdinalIgnoreCase);

    private static string BuildPromptForModel(string model, string userMessage)
    {
        if (SupportsNativeGeminiControls(model)) return userMessage;

        return $"""
               {AiProviderPrompts.SystemPrompt}

               Trả lời trực tiếp cho người dùng bằng câu trả lời cuối cùng. Không nhắc lại câu hỏi, không nhắc lại hướng dẫn, không viết các nhãn như "System Prompt", "User question", "Role", "Mission" hoặc "Constraint".

               {userMessage}
               """;
    }

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
                    builder.Append(partText.GetString());
            }
        }

        var text = builder.ToString().Trim();
        return text.Length > 0 ? text : null;
    }

    private static bool HasGeminiSafetyWarning(JsonElement root)
    {
        if (!root.TryGetProperty("candidates", out var candidates)
            || candidates.ValueKind != JsonValueKind.Array
            || candidates.GetArrayLength() == 0
            || !candidates[0].TryGetProperty("safetyRatings", out var ratings))
            return false;

        foreach (var rating in ratings.EnumerateArray())
        {
            var probability = rating.GetProperty("probability").GetString();
            if (probability is "HIGH" or "MEDIUM") return true;
        }

        return false;
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
}

public sealed class OpenAiProviderClient : OpenAiCompatibleProviderClient
{
    public OpenAiProviderClient(IHttpClientFactory httpClientFactory, ILogger<OpenAiProviderClient> logger)
        : base(httpClientFactory, logger, AiProvider.OpenAI, "https://api.openai.com/v1/chat/completions")
    {
    }
}

public sealed class NvidiaNimProviderClient : OpenAiCompatibleProviderClient
{
    public NvidiaNimProviderClient(IHttpClientFactory httpClientFactory, ILogger<NvidiaNimProviderClient> logger)
        : base(httpClientFactory, logger, AiProvider.NvidiaNim, "https://integrate.api.nvidia.com/v1/chat/completions")
    {
    }
}

public abstract class OpenAiCompatibleProviderClient : IAiProviderClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger _logger;
    private readonly string _endpoint;

    public AiProvider Provider { get; }

    protected OpenAiCompatibleProviderClient(
        IHttpClientFactory httpClientFactory,
        ILogger logger,
        AiProvider provider,
        string endpoint)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        Provider = provider;
        _endpoint = endpoint;
    }

    public async Task<AiProviderResult> SendAsync(AiProviderChatRequest request, CancellationToken cancellationToken)
    {
        if (request.HasImage && !AiProviderCatalog.SupportsImages(Provider, request.Model))
        {
            return AiProviderResult.Failed(new AiProviderFailure("IMAGE_UNSUPPORTED", "This provider/model does not support image input.", false, TimeSpan.Zero));
        }

        var messages = new List<object>
        {
            new { role = "system", content = AiProviderPrompts.SystemPrompt }
        };

        foreach (var (role, content) in request.ConversationHistory)
        {
            messages.Add(new
            {
                role = role == "user" ? "user" : "assistant",
                content
            });
        }

        if (request.HasImage)
        {
            messages.Add(new
            {
                role = "user",
                content = new object[]
                {
                    new { type = "image_url", image_url = new { url = $"data:{request.ImageMimeType};base64,{request.ImageBase64}" } },
                    new { type = "text", text = request.UserMessage }
                }
            });
        }
        else
        {
            messages.Add(new { role = "user", content = request.UserMessage });
        }

        var requestBody = new Dictionary<string, object?>
        {
            ["model"] = request.Model,
            ["messages"] = messages,
            ["stream"] = false,
            [Provider == AiProvider.OpenAI ? "max_completion_tokens" : "max_tokens"] = 1024,
        };

        var http = _httpClientFactory.CreateClient("AiProviders");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, _endpoint);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ApiKey);
        httpRequest.Content = JsonContent.Create(requestBody);

        using var response = await http.SendAsync(httpRequest, cancellationToken);
        var json = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("{Provider} API error {StatusCode} for model {Model}", Provider, response.StatusCode, request.Model);
            return AiProviderResult.Failed(AiProviderErrors.CreateFailure(response.StatusCode, json));
        }

        var text = ExtractChatCompletionText(json);
        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogWarning("{Provider} returned no text content for model {Model}", Provider, request.Model);
            return AiProviderResult.Failed(new AiProviderFailure("EMPTY_RESPONSE", "Provider returned no text content.", true, TimeSpan.FromMinutes(3)));
        }

        _logger.LogInformation("{Provider} responded successfully, length={Length}", Provider, text.Length);
        return AiProviderResult.Succeeded(text.Trim(), request.HasEmergencyKeyword);
    }

    private static string? ExtractChatCompletionText(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array || choices.GetArrayLength() == 0)
            return null;

        var firstChoice = choices[0];
        if (!firstChoice.TryGetProperty("message", out var message)) return null;
        if (!message.TryGetProperty("content", out var content)) return null;

        if (content.ValueKind == JsonValueKind.String)
            return content.GetString();

        if (content.ValueKind != JsonValueKind.Array) return null;

        var builder = new StringBuilder();
        foreach (var item in content.EnumerateArray())
        {
            if (item.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
                builder.Append(text.GetString());
        }

        var result = builder.ToString().Trim();
        return result.Length > 0 ? result : null;
    }
}

public sealed class AnthropicProviderClient : IAiProviderClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AnthropicProviderClient> _logger;

    public AiProvider Provider => AiProvider.Anthropic;

    public AnthropicProviderClient(IHttpClientFactory httpClientFactory, ILogger<AnthropicProviderClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<AiProviderResult> SendAsync(AiProviderChatRequest request, CancellationToken cancellationToken)
    {
        var messages = new List<object>();
        foreach (var (role, content) in request.ConversationHistory)
        {
            messages.Add(new
            {
                role = role == "user" ? "user" : "assistant",
                content
            });
        }

        if (request.HasImage)
        {
            messages.Add(new
            {
                role = "user",
                content = new object[]
                {
                    new
                    {
                        type = "image",
                        source = new
                        {
                            type = "base64",
                            media_type = request.ImageMimeType,
                            data = request.ImageBase64
                        }
                    },
                    new { type = "text", text = request.UserMessage }
                }
            });
        }
        else
        {
            messages.Add(new { role = "user", content = request.UserMessage });
        }

        var requestBody = new
        {
            model = request.Model,
            max_tokens = 1024,
            system = AiProviderPrompts.SystemPrompt,
            messages
        };

        var http = _httpClientFactory.CreateClient("AiProviders");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        httpRequest.Headers.Add("x-api-key", request.ApiKey);
        httpRequest.Headers.Add("anthropic-version", "2023-06-01");
        httpRequest.Content = JsonContent.Create(requestBody);

        using var response = await http.SendAsync(httpRequest, cancellationToken);
        var json = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Anthropic API error {StatusCode} for model {Model}", response.StatusCode, request.Model);
            return AiProviderResult.Failed(AiProviderErrors.CreateFailure(response.StatusCode, json));
        }

        var text = ExtractAnthropicText(json);
        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogWarning("Anthropic returned no text content for model {Model}", request.Model);
            return AiProviderResult.Failed(new AiProviderFailure("EMPTY_RESPONSE", "Provider returned no text content.", true, TimeSpan.FromMinutes(3)));
        }

        _logger.LogInformation("Anthropic responded successfully, length={Length}", text.Length);
        return AiProviderResult.Succeeded(text.Trim(), request.HasEmergencyKeyword);
    }

    private static string? ExtractAnthropicText(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            return null;

        var builder = new StringBuilder();
        foreach (var block in content.EnumerateArray())
        {
            if (block.TryGetProperty("type", out var type)
                && type.GetString() == "text"
                && block.TryGetProperty("text", out var text)
                && text.ValueKind == JsonValueKind.String)
            {
                builder.Append(text.GetString());
            }
        }

        var result = builder.ToString().Trim();
        return result.Length > 0 ? result : null;
    }
}

public static class AiProviderPrompts
{
    public const string SystemPrompt =
        """
        Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam.
        Nhiệm vụ: giúp người dùng tìm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, trả lời câu hỏi về tình hình thiên tai.
        Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt. Nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh.
        Không trả lời các nội dung nhạy cảm, chính trị, vi phạm pháp luật.
        """;
}

public static class AiProviderErrors
{
    public static AiProviderFailure CreateFailure(HttpStatusCode statusCode, string? responseBody = null)
    {
        var failure = CreateBaseFailure(statusCode);
        var providerMessage = ExtractProviderErrorMessage(responseBody);
        if (string.IsNullOrWhiteSpace(providerMessage))
            return failure;

        return failure with { Message = $"{failure.Message} Provider detail: {Trim(providerMessage, 180)}" };
    }

    private static AiProviderFailure CreateBaseFailure(HttpStatusCode statusCode) => statusCode switch
    {
        HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
            new("AUTH", "Provider rejected the API key or account permissions.", false, TimeSpan.FromHours(12)),
        HttpStatusCode.NotFound =>
            new("MODEL_NOT_FOUND", "Provider could not find the configured model.", false, TimeSpan.FromHours(12)),
        HttpStatusCode.BadRequest or HttpStatusCode.RequestEntityTooLarge =>
            new("BAD_REQUEST", "Provider rejected the request or model configuration.", false, TimeSpan.FromHours(6)),
        (HttpStatusCode)429 =>
            new("RATE_LIMIT", "Provider rate limit was reached.", true, TimeSpan.FromMinutes(5)),
        HttpStatusCode.ServiceUnavailable or HttpStatusCode.BadGateway or HttpStatusCode.GatewayTimeout =>
            new("PROVIDER_UNAVAILABLE", "Provider is temporarily unavailable.", true, TimeSpan.FromMinutes(3)),
        _ when (int)statusCode >= 500 =>
            new("PROVIDER_ERROR", "Provider returned a server error.", true, TimeSpan.FromMinutes(3)),
        _ =>
            new($"HTTP_{(int)statusCode}", "Provider request failed.", true, TimeSpan.FromMinutes(5))
    };

    private static string? ExtractProviderErrorMessage(string? responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            if (root.TryGetProperty("error", out var error))
            {
                if (error.ValueKind == JsonValueKind.String)
                    return error.GetString();

                if (error.ValueKind == JsonValueKind.Object)
                {
                    if (TryReadString(error, "message", out var errorMessage))
                        return errorMessage;
                    if (TryReadString(error, "type", out var errorType))
                        return errorType;
                }
            }

            if (TryReadString(root, "message", out var message))
                return message;
            if (TryReadString(root, "detail", out var detail))
                return detail;
        }
        catch (JsonException)
        {
            var trimmed = responseBody.Trim();
            if (trimmed.Length > 0 && !trimmed.StartsWith("<", StringComparison.Ordinal))
                return trimmed;
        }

        return null;
    }

    private static bool TryReadString(JsonElement element, string propertyName, out string value)
    {
        value = string.Empty;
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String)
            return false;

        var text = property.GetString();
        if (string.IsNullOrWhiteSpace(text))
            return false;

        value = text.Trim();
        return true;
    }

    private static string Trim(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    public static string GetUserMessage(AiProviderFailure? failure) => failure?.Code switch
    {
        "RATE_LIMIT" => "Trợ lý AI đang bị giới hạn lưu lượng do nhu cầu cao. Vui lòng thử lại sau ít phút.",
        "PROVIDER_UNAVAILABLE" or "PROVIDER_ERROR" or "TIMEOUT" or "NETWORK" =>
            "Trợ lý AI đang quá tải do dịch vụ bên thứ ba tạm thời không sẵn sàng. Vui lòng thử lại sau ít phút.",
        "AUTH" or "MODEL_NOT_FOUND" or "BAD_REQUEST" or "INVALID_MODEL" or "CLIENT_NOT_REGISTERED" =>
            "Trợ lý AI đang tạm thời bảo trì kết nối với dịch vụ bên thứ ba. Vui lòng thử lại sau.",
        _ => "Hiện chưa thể kết nối tới dịch vụ AI bên thứ ba. Vui lòng thử lại sau."
    };
}

internal sealed record AiPoolKey(AiProvider Provider, string ApiKey, string Model, int? PoolKeyId);
