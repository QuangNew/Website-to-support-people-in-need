using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Immutable audit trail for submitted role verification requests.
/// Each submission creates one record that later transitions from Pending to Approved or Rejected.
/// </summary>
public class VerificationHistory
{
    public int Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string RequestedRole { get; set; } = string.Empty;

    public string? VerificationReason { get; set; }

    /// <summary>Comma-separated image URLs captured at submission time.</summary>
    public string? VerificationImageUrls { get; set; }

    public string? PhoneNumber { get; set; }

    public string? Address { get; set; }

    public VerificationStatus Status { get; set; } = VerificationStatus.Pending;

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewedByAdminId { get; set; }

    public string? ReviewedByAdminName { get; set; }

    public ApplicationUser User { get; set; } = null!;
}