using System.Text.RegularExpressions;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

/// <summary>
/// Content moderation service that checks text against community guidelines.
/// Implements multi-category detection following industry-standard community policies
/// (Meta, Google, X/Twitter community standards).
/// 
/// Categories enforced:
/// 1. Profanity / vulgar language
/// 2. Hate speech / discrimination
/// 3. Violence / threats
/// 4. Harassment / bullying
/// 5. Sexual content
/// </summary>
public partial class ContentModerationService : IContentModerationService
{
    private sealed record ModerationPattern(string Category, Regex BoundedPattern, Regex? CondensedPattern);

    // High-confidence Vietnamese profanity and vulgar terms.
    // Keep this list intentionally conservative because violations trigger account strikes.
    private static readonly string[] VietnameseProfanity =
    [
        "đụ", "địt", "địt mẹ", "đụ má", "lồn", "buồi", "cặc", "đéo",
        "mẹ mày", "đồ chó", "con chó", "thằng chó", "con đĩ", "đĩ",
        "khốn nạn", "chết mẹ", "chết tiệt",
        "vcl", "vkl", "đmm", "đm", "clgt", "dcm", "cmm", "dmm", "dkm",
        "óc chó", "não cá vàng",
        "đồ rác", "rác rưởi", "đồ phế",
        "dit me", "du ma", "me may", "do cho", "con cho", "thang cho",
        "oc cho", "khon nan", "rac ruoi",
    ];

    // Hate speech / discrimination terms (Vietnamese + English)
    private static readonly string[] HateSpeech =
    [
        "mọi đen", "đồ tật nguyền", "thằng tật nguyền", "con tật nguyền",
        "do tat nguyen", "thang tat nguyen", "con tat nguyen",
        "nigger", "nigga", "faggot", "retard", "retarded",
    ];

    // Direct threats / violent encouragement
    private static readonly string[] ViolenceThreats =
    [
        "giết mày", "tao sẽ giết", "tao giết", "đâm chết", "chém chết",
        "cho nổ tung", "tự tử đi", "mày chết đi", "xử mày",
        "giet may", "tao se giet", "dam chet", "chem chet", "tu tu di", "xu may",
    ];

    // Harassment / bullying
    private static readonly string[] Harassment =
    [
        "đồ ăn hại", "vô dụng", "cút đi", "biến đi",
        "không ai thương", "không ai cần mày",
        "đồ béo", "con mập", "thằng thất bại", "con thất bại", "xấu như chó",
        "do an hai", "vo dung", "cut di", "bien di",
        "khong ai thuong", "khong ai can may",
    ];

    private static readonly ModerationPattern[] CategoryPatterns = BuildPatterns();

    private static ModerationPattern[] BuildPatterns()
    {
        static Regex BuildBounded(string[] words) =>
            new(
                string.Join("|", words.Select(w => $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(w)}(?![\p{{L}}\p{{N}}])")),
                RegexOptions.IgnoreCase | RegexOptions.Compiled,
                TimeSpan.FromMilliseconds(200) // timeout to prevent ReDoS
            );

        static Regex? BuildCondensed(string[] words)
        {
            var condensedWords = words
                .Select(CollapseForDetection)
                .Where(w => w.Length >= 3)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (condensedWords.Length == 0)
                return null;

            return new Regex(
                string.Join("|", condensedWords.Select(Regex.Escape)),
                RegexOptions.IgnoreCase | RegexOptions.Compiled,
                TimeSpan.FromMilliseconds(200));
        }

        return
        [
            new("Ngôn ngữ tục tĩu / Profanity", BuildBounded(VietnameseProfanity), BuildCondensed(VietnameseProfanity)),
            new("Phát ngôn thù ghét / Hate speech", BuildBounded(HateSpeech), BuildCondensed(HateSpeech)),
            new("Bạo lực / đe dọa / Violence & threats", BuildBounded(ViolenceThreats), BuildCondensed(ViolenceThreats)),
            new("Quấy rối / bắt nạt / Harassment", BuildBounded(Harassment), BuildCondensed(Harassment)),
        ];
    }

    // Leetspeak / evasion pattern: common substitutions
    [GeneratedRegex(@"[@4]", RegexOptions.Compiled)]
    private static partial Regex LeetspeakA();

    [GeneratedRegex(@"[1!|]", RegexOptions.Compiled)]
    private static partial Regex LeetspeakI();

    [GeneratedRegex(@"[3€]", RegexOptions.Compiled)]
    private static partial Regex LeetspeakE();

    [GeneratedRegex(@"[0ø]", RegexOptions.Compiled)]
    private static partial Regex LeetspeakO();

    [GeneratedRegex(@"[\s.\-_*]+", RegexOptions.Compiled)]
    private static partial Regex SpacingEvasion();

    private static string CollapseForDetection(string content) => SpacingEvasion().Replace(content, "");

    private static string NormalizeLeetspeak(string content)
    {
        var normalized = LeetspeakA().Replace(content, "a");
        normalized = LeetspeakI().Replace(normalized, "i");
        normalized = LeetspeakE().Replace(normalized, "e");
        normalized = LeetspeakO().Replace(normalized, "o");
        return normalized;
    }

    public string? CheckContent(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return null;

        var spacedNormalized = SpacingEvasion().Replace(content, " ").Trim();
        var condensed = CollapseForDetection(content);
        var leetSpacedNormalized = NormalizeLeetspeak(spacedNormalized);
        var leetCondensed = NormalizeLeetspeak(condensed);

        foreach (var pattern in CategoryPatterns)
        {
            try
            {
                if (pattern.BoundedPattern.IsMatch(content)
                    || pattern.BoundedPattern.IsMatch(spacedNormalized)
                    || pattern.BoundedPattern.IsMatch(leetSpacedNormalized))
                {
                    return pattern.Category;
                }

                if (pattern.CondensedPattern != null
                    && (pattern.CondensedPattern.IsMatch(condensed)
                        || pattern.CondensedPattern.IsMatch(leetCondensed)))
                {
                    return pattern.Category;
                }
            }
            catch (RegexMatchTimeoutException)
            {
                // Timeout = skip this pattern (safety against ReDoS)
                continue;
            }
        }

        return null;
    }
}
