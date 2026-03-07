using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Reaction on a social post (REQ-SOC-02).
/// One reaction per user per post (toggle).
/// </summary>
public class Reaction
{
    public int Id { get; set; }

    public ReactionType Type { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Foreign keys
    public int PostId { get; set; }
    public Post Post { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;
}
