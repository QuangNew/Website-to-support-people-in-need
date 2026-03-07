namespace ReliefConnect.Core.Entities;

/// <summary>
/// Comment on a social post (REQ-SOC-02).
/// </summary>
public class Comment
{
    public int Id { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Foreign keys
    public int PostId { get; set; }
    public Post Post { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
}
