using System.Text;
using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core;

public sealed record AiModelDefinition(
    string Value,
    string Label,
    bool SupportsImages,
    IReadOnlyList<string>? Aliases = null);

public sealed record AiProviderDefinition(
    AiProvider Provider,
    string Value,
    string Label,
    string DefaultModel,
    IReadOnlyList<AiModelDefinition> Models);

public static class AiImagePolicy
{
    public const string AllowedMimeTypesPattern = @"^(image/jpeg|image/png|image/webp)$";

    public static readonly IReadOnlySet<string> AllowedMimeTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    };
}

public static class AiProviderCatalog
{
    private static readonly IReadOnlyList<AiProviderDefinition> ProviderDefinitions =
    [
        new(
            AiProvider.Gemini,
            nameof(AiProvider.Gemini),
            "Gemini",
            "gemini-2.5-flash",
            [
                new("gemini-2.5-flash", "Gemini 2.5 Flash", true, ["models/gemini-2.5-flash"]),
                new("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite", true, ["models/gemini-2.5-flash-lite", "gemini-3-flash", "models/gemini-3-flash", "gemini-3-flash-preview"]),
                new("gemini-2.5-pro", "Gemini 2.5 Pro", true, ["models/gemini-2.5-pro"]),
            ]),
        new(
            AiProvider.OpenAI,
            nameof(AiProvider.OpenAI),
            "OpenAI",
            "gpt-5.1",
            [
                new("gpt-5.1", "GPT-5.1", true, ["GPT-5.1", "gpt-5-1", "GPT-5-1", "gpt-5.4", "GPT-5.4", "gpt-5-4", "GPT-5-4", "gpt-5.5", "GPT-5.5", "gpt-5-5", "GPT-5-5"]),
                new("gpt-5-mini", "GPT-5 Mini", true, ["GPT-5 Mini", "GPT-5-mini", "GPT-5-Mini", "gpt-5 mini"]),
                new("gpt-4.1-mini", "GPT-4.1 Mini", true, ["GPT-4.1 Mini", "GPT-4.1-mini", "gpt-4.1 mini"]),
                new("gpt-4o-mini", "GPT-4o Mini", true, ["GPT-4o Mini", "GPT-4o-mini", "gpt-4o mini"]),
            ]),
        new(
            AiProvider.Anthropic,
            nameof(AiProvider.Anthropic),
            "Anthropic",
            "claude-sonnet-4-20250514",
            [
                new("claude-sonnet-4-20250514", "Claude Sonnet 4", true, ["claude-sonnet-4-0", "claude-sonnet-4", "Claude Sonnet 4", "claude-sonnet-4-6", "claude-sonnet-4.6", "Claude Sonnet 4.6"]),
                new("claude-opus-4-20250514", "Claude Opus 4", true, ["claude-opus-4-0", "claude-opus-4", "Claude Opus 4", "claude-opus-4-7", "claude-opus-4.7", "Claude Opus 4.7"]),
                new("claude-3-5-haiku-20241022", "Claude Haiku 3.5", false, ["claude-3-5-haiku-latest", "claude-haiku-4-5", "claude-haiku-4.5", "Claude Haiku 4.5"]),
            ]),
        new(
            AiProvider.NvidiaNim,
            nameof(AiProvider.NvidiaNim),
            "NVIDIA NIM",
            "meta/llama-3.1-8b-instruct",
            [
                new("meta/llama-3.1-8b-instruct", "Llama 3.1 8B Instruct", false, ["llama-3.1-8b-instruct", "meta / llama-3.1-8b-instruct", "minimaxai/minimax-m2.7", "minimax-m2.7", "minimaxai / minimax-m2.7"]),
                new("meta/llama-3.1-70b-instruct", "Llama 3.1 70B Instruct", false, ["llama-3.1-70b-instruct", "meta / llama-3.1-70b-instruct"]),
                new("meta/llama-4-maverick-17b-128e-instruct", "Llama 4 Maverick 17B 128E Instruct", false, ["llama-4-maverick-17b-128e-instruct", "meta / llama-4-maverick-17b-128e-instruct"]),
            ]),
    ];

    public static IReadOnlyList<AiProviderDefinition> Providers => ProviderDefinitions;

    public static AiProvider NormalizeProvider(AiProvider provider) => provider switch
    {
        AiProvider.GPT => AiProvider.OpenAI,
        AiProvider.Claude => AiProvider.Anthropic,
        _ => provider,
    };

    public static bool TryNormalizeProvider(string? value, out AiProvider provider)
    {
        provider = default;
        if (string.IsNullOrWhiteSpace(value)) return false;

        var key = NormalizeProviderKey(value);
        provider = key switch
        {
            "0" or "gemini" => AiProvider.Gemini,
            "2" or "3" or "openai" or "gpt" => AiProvider.OpenAI,
            "1" or "4" or "anthropic" or "claude" => AiProvider.Anthropic,
            "5" or "nvidia" or "nim" or "nvidianim" => AiProvider.NvidiaNim,
            _ => default,
        };

        return provider is AiProvider.Gemini or AiProvider.OpenAI or AiProvider.Anthropic or AiProvider.NvidiaNim;
    }

    public static AiProviderDefinition? GetProvider(AiProvider provider)
    {
        var normalized = NormalizeProvider(provider);
        return ProviderDefinitions.FirstOrDefault(p => p.Provider == normalized);
    }

    public static string GetProviderValue(AiProvider provider) =>
        GetProvider(provider)?.Value ?? NormalizeProvider(provider).ToString();

    public static string GetProviderLabel(AiProvider provider) =>
        GetProvider(provider)?.Label ?? GetProviderValue(provider);

    public static string GetDefaultModel(AiProvider provider) =>
        GetProvider(provider)?.DefaultModel ?? string.Empty;

    public static string NormalizeModel(AiProvider provider, string model)
    {
        var normalizedProvider = NormalizeProvider(provider);
        var trimmed = model.Trim();

        if (normalizedProvider == AiProvider.Gemini && trimmed.StartsWith("models/", StringComparison.OrdinalIgnoreCase))
            trimmed = trimmed["models/".Length..];

        var definition = GetProvider(normalizedProvider);
        var knownModel = definition?.Models.FirstOrDefault(m =>
            string.Equals(m.Value, trimmed, StringComparison.OrdinalIgnoreCase)
            || m.Aliases?.Any(alias => string.Equals(alias, trimmed, StringComparison.OrdinalIgnoreCase)) == true);

        return knownModel?.Value ?? trimmed;
    }

    public static bool IsModelAllowed(AiProvider provider, string model)
    {
        var normalizedProvider = NormalizeProvider(provider);
        return GetProvider(normalizedProvider) != null && IsValidModelId(NormalizeModel(normalizedProvider, model));
    }

    public static bool IsKnownModel(AiProvider provider, string model) =>
        GetModelDefinition(provider, model) != null;

    public static bool SupportsImages(AiProvider provider, string model) =>
        GetModelDefinition(provider, model)?.SupportsImages == true;

    private static AiModelDefinition? GetModelDefinition(AiProvider provider, string model)
    {
        var normalizedProvider = NormalizeProvider(provider);
        var normalizedModel = NormalizeModel(normalizedProvider, model);
        var definition = GetProvider(normalizedProvider);
        return definition?.Models.FirstOrDefault(m => string.Equals(m.Value, normalizedModel, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsValidModelId(string model)
    {
        if (string.IsNullOrWhiteSpace(model) || model.Length > 100) return false;

        foreach (var c in model)
        {
            if (!char.IsLetterOrDigit(c) && c is not '-' and not '_' and not '.' and not '/' and not ':')
                return false;
        }

        return true;
    }

    private static string NormalizeProviderKey(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var c in value)
        {
            if (char.IsLetterOrDigit(c))
                builder.Append(char.ToLowerInvariant(c));
        }

        return builder.ToString();
    }
}
