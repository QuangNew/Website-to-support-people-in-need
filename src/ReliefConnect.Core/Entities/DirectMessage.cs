namespace ReliefConnect.Core.Entities;

/// <summary>
/// A single message within a DirectConversation.
/// </summary>
public class DirectMessage
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public DirectConversation Conversation { get; set; } = null!;
    public string SenderId { get; set; } = string.Empty;
    public ApplicationUser Sender { get; set; } = null!;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
    public DateTime? DeletedAt { get; set; }
}
