using ReliefConnect.Core;
using ReliefConnect.Core.Enums;

namespace ReliefConnect.Tests;

public class AiProviderCatalogTests
{
    [Theory]
    [InlineData("0", AiProvider.Gemini)]
    [InlineData("1", AiProvider.Anthropic)]
    [InlineData("2", AiProvider.OpenAI)]
    [InlineData("Claude", AiProvider.Anthropic)]
    [InlineData("GPT", AiProvider.OpenAI)]
    [InlineData("NVIDIA NIM", AiProvider.NvidiaNim)]
    public void TryNormalizeProvider_accepts_legacy_and_canonical_values(string input, AiProvider expected)
    {
        var ok = AiProviderCatalog.TryNormalizeProvider(input, out var provider);

        Assert.True(ok);
        Assert.Equal(expected, provider);
    }

    [Theory]
    [InlineData(AiProvider.OpenAI, "gpt-5.4", "gpt-5.1")]
    [InlineData(AiProvider.OpenAI, "GPT-5-5", "gpt-5.1")]
    [InlineData(AiProvider.Anthropic, "claude-sonnet-4-6", "claude-sonnet-4-20250514")]
    [InlineData(AiProvider.Anthropic, "Claude Haiku 4.5", "claude-3-5-haiku-20241022")]
    [InlineData(AiProvider.Gemini, "models/gemini-2.5-flash", "gemini-2.5-flash")]
    [InlineData(AiProvider.NvidiaNim, "minimaxai/minimax-m2.7", "meta/llama-3.1-8b-instruct")]
    public void NormalizeModel_maps_old_suggestions_to_provider_api_ids(AiProvider provider, string input, string expected)
    {
        var model = AiProviderCatalog.NormalizeModel(provider, input);

        Assert.Equal(expected, model);
    }
}
