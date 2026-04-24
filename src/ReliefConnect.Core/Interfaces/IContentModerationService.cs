namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Content moderation service for detecting community guideline violations.
/// Checks text content against profanity lists and community standards.
/// </summary>
public interface IContentModerationService
{
    /// <summary>
    /// Checks if content violates community guidelines.
    /// Returns null if content is clean, or a violation reason string if it violates.
    /// </summary>
    string? CheckContent(string content);
}
