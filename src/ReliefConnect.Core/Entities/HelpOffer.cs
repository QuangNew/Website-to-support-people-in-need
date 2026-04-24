using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Sponsor's offer to help a person in need.
/// Maps to existing "HelpOffers" table in Supabase.
/// DB columns: Id, SponsorId, TargetUserId, PingId?, PostId?, Message (NOT NULL), Status (int), CreatedAt
/// </summary>
public class HelpOffer
{
    public int Id { get; set; }

    public string SponsorId { get; set; } = string.Empty;
    public ApplicationUser Sponsor { get; set; } = null!;

    public string TargetUserId { get; set; } = string.Empty;
    public ApplicationUser TargetUser { get; set; } = null!;

    public int? PingId { get; set; }
    public Ping? Ping { get; set; }

    public int? PostId { get; set; }
    public Post? Post { get; set; }

    /// <summary>NOT NULL in database — always provide a message.</summary>
    public string Message { get; set; } = string.Empty;

    public HelpOfferStatus Status { get; set; } = HelpOfferStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
