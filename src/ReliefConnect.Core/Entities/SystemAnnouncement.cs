namespace ReliefConnect.Core.Entities;

/// <summary>
/// System-wide admin announcement.
/// Maps to existing "SystemAnnouncements" table in Supabase.
/// DB columns: Id, Title, Content, AdminId, CreatedAt, ExpiresAt?
/// Note: DB does NOT have IsActive column. Active/expired computed from ExpiresAt at query time.
/// </summary>
public class SystemAnnouncement
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public string AdminId { get; set; } = string.Empty;
    public ApplicationUser Admin { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ExpiresAt { get; set; }
}
