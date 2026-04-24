namespace ReliefConnect.Core.Entities;

/// <summary>
/// A 1-to-1 direct messaging conversation between two users.
/// User1Id &lt; User2Id is always enforced (normalized pair order).
/// </summary>
public class DirectConversation
{
    public int Id { get; set; }
    public string User1Id { get; set; } = string.Empty;
    public ApplicationUser User1 { get; set; } = null!;
    public string User2Id { get; set; } = string.Empty;
    public ApplicationUser User2 { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastMessageAt { get; set; }
    public ICollection<DirectMessage> Messages { get; set; } = new List<DirectMessage>();
}
