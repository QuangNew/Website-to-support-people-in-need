using Microsoft.AspNetCore.Identity;
using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Application user extending ASP.NET Core Identity.
/// Central entity in Users & Roles subsystem (Class Diagram).
/// </summary>
public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;

    public RoleEnum Role { get; set; } = RoleEnum.Guest;

    public VerificationStatus VerificationStatus { get; set; } = VerificationStatus.None;

    public string? AvatarUrl { get; set; }

    /// <summary>Google OAuth subject identifier (Google's unique user ID).</summary>
    public string? GoogleId { get; set; }

    /// <summary>6-digit email verification code sent upon registration.</summary>
    public string? EmailVerificationCode { get; set; }

    /// <summary>Expiry time for the email verification code.</summary>
    public DateTime? EmailVerificationCodeExpiry { get; set; }

    /// <summary>Password reset token (6-digit code).</summary>
    public string? PasswordResetToken { get; set; }

    /// <summary>Expiry time for the password reset token.</summary>
    public DateTime? PasswordResetTokenExpiry { get; set; }

    /// <summary>Role requested in the latest verification submission.</summary>
    public string? RequestedRole { get; set; }

    /// <summary>Reason provided with the latest verification submission.</summary>
    public string? VerificationReason { get; set; }

    /// <summary>Comma-separated image URLs submitted with verification request.</summary>
    public string? VerificationImageUrls { get; set; }

    /// <summary>When the user's current role verification expires. Null = never.</summary>
    public DateTime? RequestedRoleExpiry { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Whether user is currently suspended or banned.</summary>
    public bool IsSuspended { get; set; }

    /// <summary>When temporary suspension expires. Null = permanent ban.</summary>
    public DateTime? SuspendedUntil { get; set; }

    /// <summary>Admin-provided reason for ban.</summary>
    public string? BanReason { get; set; }

    /// <summary>Number of community guideline violations. 3 = permanent ban.</summary>
    public int ViolationCount { get; set; }

    /// <summary>JTI of user's most recent JWT token (for force-logout).</summary>
    public string? LastTokenJti { get; set; }

    /// <summary>User's address (nullable, set during role verification).</summary>
    public string? Address { get; set; }

    // Navigation properties
    public ICollection<Ping> Pings { get; set; } = new List<Ping>();
    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
    public ICollection<Conversation> Conversations { get; set; } = new List<Conversation>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public ICollection<VerificationHistory> VerificationHistories { get; set; } = new List<VerificationHistory>();
}
