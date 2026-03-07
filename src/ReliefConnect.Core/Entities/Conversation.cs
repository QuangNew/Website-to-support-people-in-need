namespace ReliefConnect.Core.Entities;

/// <summary>
/// Chat conversation for the AI chatbot (REQ-BOT-01).
/// </summary>
public class Conversation
{
    public int Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Foreign keys
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    // Navigation
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
