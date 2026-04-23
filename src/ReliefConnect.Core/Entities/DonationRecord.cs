namespace ReliefConnect.Core.Entities;

/// <summary>
/// Records a donation (ủng hộ) made via PayOS.
/// History: max 1000 rows, retained for 3 months.
/// </summary>
public class DonationRecord
{
    public int Id { get; set; }

    /// <summary>Unique PayOS order code (numeric, generated at creation time).</summary>
    public long OrderCode { get; set; }

    /// <summary>PayOS payment link ID returned after creating the link.</summary>
    public string? PaymentLinkId { get; set; }

    /// <summary>FK to ApplicationUser. Null for anonymous (not allowed in current UX but kept nullable for future).</summary>
    public string? UserId { get; set; }

    /// <summary>Donor's display name (full name or "Ẩn danh").</summary>
    public string DisplayName { get; set; } = "Ẩn danh";

    /// <summary>Phone with middle digits masked: "091xxxxx78".</summary>
    public string? MaskedPhone { get; set; }

    /// <summary>Amount in VND.</summary>
    public long Amount { get; set; }

    /// <summary>Optional support message from the donor.</summary>
    public string? Message { get; set; }

    public DonationStatus Status { get; set; } = DonationStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }

    // Navigation
    public ApplicationUser? User { get; set; }
}

public enum DonationStatus
{
    Pending = 0,
    Paid = 1,
    Cancelled = 2,
}
