using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Post report for content moderation.
/// Maps to existing "Reports" table in Supabase.
/// DB columns: Id, PostId, ReporterId, Reason, Status (int), CreatedAt
/// </summary>
public class Report
{
    public int Id { get; set; }

    public int PostId { get; set; }
    public Post Post { get; set; } = null!;

    public string ReporterId { get; set; } = string.Empty;
    public ApplicationUser Reporter { get; set; } = null!;

    public string Reason { get; set; } = string.Empty;

    public ReportStatus Status { get; set; } = ReportStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
