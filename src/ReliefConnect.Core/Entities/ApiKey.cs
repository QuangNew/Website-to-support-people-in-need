using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Stores API keys from various AI providers for the chatbot pool.
/// </summary>
public class ApiKey
{
    public int Id { get; set; }

    /// <summary>AI provider: Gemini, Claude, GPT.</summary>
    public AiProvider Provider { get; set; }

    /// <summary>Display label (e.g. "Gemini Key #1").</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>The actual API key value (encrypted at rest recommended).</summary>
    public string KeyValue { get; set; } = string.Empty;

    /// <summary>Model to use with this key (e.g. "gemini-2.5-flash", "claude-sonnet-4-20250514", "gpt-4o").</summary>
    public string Model { get; set; } = string.Empty;

    /// <summary>Whether this key is currently active and available for rotation.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Number of requests made with this key (for load balancing).</summary>
    public int UsageCount { get; set; }

    /// <summary>When the key was last used.</summary>
    public DateTime? LastUsedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
