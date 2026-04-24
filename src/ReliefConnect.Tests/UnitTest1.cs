using ReliefConnect.Infrastructure.Services;

namespace ReliefConnect.Tests;

public class ContentModerationServiceTests
{
    private readonly ContentModerationService _service = new();

    [Theory]
    [InlineData("Đồ chó, cút đi", "Ngôn ngữ tục tĩu / Profanity")]
    [InlineData("Tao sẽ giết mày", "Bạo lực / đe dọa / Violence & threats")]
    [InlineData("nigger", "Phát ngôn thù ghét / Hate speech")]
    public void Detects_clear_guideline_violations(string content, string expectedCategory)
    {
        var result = _service.CheckContent(content);

        Assert.Equal(expectedCategory, result);
    }

    [Theory]
    [InlineData("Tao đang cần giúp đỡ ở đây")]
    [InlineData("Da den la mau ao toi dang mac")]
    [InlineData("Khu vực này có nguy cơ nổ bình gas")]
    [InlineData("Tôi vừa đụng xe ngoài ngõ")]
    public void Does_not_flag_benign_text_as_violation(string content)
    {
        var result = _service.CheckContent(content);

        Assert.Null(result);
    }

    [Fact]
    public void Detects_obfuscated_phrase_after_spacing_is_collapsed()
    {
        var result = _service.CheckContent("đồ---chó");

        Assert.Equal("Ngôn ngữ tục tĩu / Profanity", result);
    }
}
