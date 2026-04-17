using System.ComponentModel.DataAnnotations;

namespace ReliefConnect.Core.DTOs;

// ═══════════════════════════════════════════
//  AUTH DTOs
// ═══════════════════════════════════════════

public class RegisterDto
{
    [Required, StringLength(50, MinimumLength = 6)]
    public string Username { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(255, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string FullName { get; set; } = string.Empty;
}

public class LoginDto
{
    /// <summary>Email or username</summary>
    [Required]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class UserProfileDto
{
    public string Id { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public string? AvatarUrl { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UpdateProfileDto
{
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
}

public class VerifyRoleDto
{
    [Required]
    public string RequestedRole { get; set; } = string.Empty;

    public string? Reason { get; set; }

    /// <summary>Optional list of uploaded image URLs (max 5) for identity verification.</summary>
    public List<string>? ImageUrls { get; set; }

    /// <summary>Phone number (required for role verification).</summary>
    [Required, Phone]
    public string PhoneNumber { get; set; } = string.Empty;

    /// <summary>Address (optional).</summary>
    public string? Address { get; set; }
}

public class GoogleLoginDto
{
    [Required]
    public string Credential { get; set; } = string.Empty;
}

public class VerifyEmailDto
{
    [Required, StringLength(6, MinimumLength = 6)]
    public string Code { get; set; } = string.Empty;
}

public class ForgotPasswordDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(6, MinimumLength = 6)]
    public string Token { get; set; } = string.Empty;

    [Required, StringLength(255, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangePasswordDto
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(255, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}

public class AdminPostDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsPinned { get; set; }
    public int CommentCount { get; set; }
    public int ReactionCount { get; set; }
}

// ═══════════════════════════════════════════
//  MAP DTOs
// ═══════════════════════════════════════════

public class CreatePingDto
{
    [Required]
    public double Lat { get; set; }

    [Required]
    public double Lng { get; set; }

    [Required]
    public string Type { get; set; } = string.Empty; // "SOS", "Supply", "Shelter"

    [StringLength(200)]
    public string? ContactName { get; set; }

    [StringLength(32)]
    public string? ContactPhone { get; set; }

    public string? Details { get; set; }

    [StringLength(500)]
    public string? ConditionImageUrl { get; set; }

    /// <summary>SOS category tag: evacuate, food, medical, shelter, other. Only used for SOS type pings.</summary>
    public string? SOSCategory { get; set; }
}

public class PingResponseDto
{
    public int Id { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int PriorityLevel { get; set; }
    public string? Details { get; set; }
    public string? SOSCategory { get; set; }
    public DateTime CreatedAt { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? ConditionImageUrl { get; set; }
    public bool IsBlinking { get; set; }
}

public class UpdatePingStatusDto
{
    [Required]
    public string Status { get; set; } = string.Empty; // "InProgress", "Resolved"
}

public class RouteRequestDto
{
    [Required]
    public double FromLat { get; set; }

    [Required]
    public double FromLng { get; set; }

    [Required]
    public double ToLat { get; set; }

    [Required]
    public double ToLng { get; set; }
}

// ═══════════════════════════════════════════
//  SOCIAL DTOs
// ═══════════════════════════════════════════

public class CreatePostDto
{
    [Required, StringLength(5000)]
    public string Content { get; set; } = string.Empty;

    [Required]
    public string Category { get; set; } = string.Empty; // "Livelihood", "Medical", "Education"

    public string? ImageUrl { get; set; }
}

public class PostResponseDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string Category { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorAvatar { get; set; }
    public string AuthorRole { get; set; } = string.Empty;
    public int LikeCount { get; set; }
    public int LoveCount { get; set; }
    public int PrayCount { get; set; }
    public int CommentCount { get; set; }
    public string? UserReaction { get; set; } // Current user's reaction, null if none
}

public class PaginatedResponse<T>
{
    public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();
    public string? NextCursor { get; set; }
    public bool HasMore => NextCursor != null;
}

public class AddReactionDto
{
    [Required]
    public string Type { get; set; } = string.Empty; // "Like", "Love", "Pray"
}

public class CreateCommentDto
{
    [Required, StringLength(2000)]
    public string Content { get; set; } = string.Empty;
}

public class CommentResponseDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? UserAvatar { get; set; }
}

// ═══════════════════════════════════════════
//  CHATBOT DTOs
// ═══════════════════════════════════════════

public class SendMessageDto
{
    [Required, StringLength(4000)]
    public string Content { get; set; } = string.Empty;

    /// <summary>Base64-encoded image data (max ~4MB after encoding). Supported: JPEG, PNG, WebP.</summary>
    [StringLength(5_600_000)]
    public string? ImageBase64 { get; set; }

    /// <summary>MIME type of the image — must be image/jpeg, image/png, or image/webp.</summary>
    [RegularExpression(@"^(image/jpeg|image/png|image/webp)$",
        ErrorMessage = "Allowed MIME types: image/jpeg, image/png, image/webp.")]
    public string? ImageMimeType { get; set; }
}

public class MessageResponseDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsBotMessage { get; set; }
    public bool HasSafetyWarning { get; set; }
    public DateTime SentAt { get; set; }
}

// ═══════════════════════════════════════════
//  ADMIN DTOs
// ═══════════════════════════════════════════

public class ApproveRoleDto
{
    [Required]
    public string Role { get; set; } = string.Empty;
}

public class AdminUserDto
{
    public string Id { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public string? RequestedRole { get; set; }
    public string? VerificationReason { get; set; }
    public bool EmailVerified { get; set; }
    public string? AvatarUrl { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsSuspended { get; set; }
    public DateTime? SuspendedUntil { get; set; }
    public string? BanReason { get; set; }
}

/// <summary>
/// Batch admin operations — all processed in a single DB transaction.
/// </summary>
public class AdminBatchDto
{
    /// <summary>List of role approval operations.</summary>
    public List<BatchRoleApprovalItem> RoleApprovals { get; set; } = [];

    /// <summary>UserIds to reject verification for.</summary>
    public List<string> RoleRejections { get; set; } = [];

    /// <summary>PostIds to delete.</summary>
    public List<int> PostDeletions { get; set; } = [];
}

public class BatchRoleApprovalItem
{
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty;
}

/// <summary>
/// Result of each operation in a batch — used for partial-failure reporting.
/// </summary>
public class BatchResultItem
{
    public string OpType  { get; set; } = string.Empty; // "approveRole" | "rejectVerification" | "deletePost"
    public string Key     { get; set; } = string.Empty; // userId or postId as string
    public bool   Success { get; set; }
    public string? Error  { get; set; }
}

public class AdminBatchResultDto
{
    public int Applied { get; set; }
    public int Failed  { get; set; }
    public List<BatchResultItem> Results { get; set; } = [];
}

public class SystemStatsDto
{
    public int TotalUsers { get; set; }
    public int TotalPersonsInNeed { get; set; }
    public int TotalSponsors { get; set; }
    public int TotalVolunteers { get; set; }
    public int ActiveSOS { get; set; }
    public int ResolvedCases { get; set; }
    public int TotalPosts { get; set; }
    public int TotalPostsLivelihood { get; set; }
    public int TotalPostsMedical { get; set; }
    public int TotalPostsEducation { get; set; }
    public int PendingVerifications { get; set; }
    public int PendingReports { get; set; }
}

public class SuspendUserDto
{
    [Required, StringLength(500)]
    public string Reason { get; set; } = string.Empty;

    /// <summary>Null = permanent suspension.</summary>
    public DateTime? Until { get; set; }
}

public class BanUserDto
{
    [Required, StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class CreateAnnouncementDto
{
    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(5000)]
    public string Content { get; set; } = string.Empty;

    public string? ExpiresAt { get; set; }
}

public class UpdateAnnouncementDto
{
    [StringLength(200)]
    public string? Title { get; set; }

    [StringLength(5000)]
    public string? Content { get; set; }

    public string? ExpiresAt { get; set; }
}

public class AnnouncementDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string AdminId { get; set; } = string.Empty;
    public string AdminName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsExpired { get; set; }
}

public class ReportDto
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public string PostContentPreview { get; set; } = string.Empty;
    public string ReporterId { get; set; } = string.Empty;
    public string ReporterName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class ReportPostDto
{
    [Required, StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class SystemLogDto
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? BatchId { get; set; }
    public bool HasChildren { get; set; }
}

public class AdminUserDetailDto : AdminUserDto
{
    public int PostCount { get; set; }
    public int CommentCount { get; set; }
    public int PingCount { get; set; }
}

public class CompleteTaskDto
{
    [StringLength(1000)]
    public string? Notes { get; set; }
}

/// <summary>Paginated response with total count and page metadata.</summary>
public class PagedResponse<T>
{
    public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)Total / PageSize) : 0;
}

// ═══════════════════════════════════════════
//  ZONE DTOs
// ═══════════════════════════════════════════

public class CreateZoneDto
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string BoundaryGeoJson { get; set; } = string.Empty;

    [Range(1, 5)]
    public int RiskLevel { get; set; } = 1;
}

public class ZoneResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BoundaryGeoJson { get; set; } = string.Empty;
    public int RiskLevel { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ═══════════════════════════════════════════
//  SUPPLY DTOs
// ═══════════════════════════════════════════

public class CreateSupplyDto
{
    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [Range(0, int.MaxValue)]
    public int Quantity { get; set; }

    [Required]
    public double Lat { get; set; }

    [Required]
    public double Lng { get; set; }
}

public class UpdateSupplyDto
{
    [StringLength(200)]
    public string? Name { get; set; }

    [Range(0, int.MaxValue)]
    public int? Quantity { get; set; }
}

public class SupplyResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Route DTOs removed — routing is now handled client-side via OSRM (OpenStreetMap)

// ═══════════════════════════════════════════
//  SPONSOR DTOs
// ═══════════════════════════════════════════

public class OfferHelpDto
{
    [Required]
    public int PingId { get; set; }

    [StringLength(1000)]
    public string? Message { get; set; }
}

// ═══════════════════════════════════════════
//  VOLUNTEER DTOs
// ═══════════════════════════════════════════

public class AcceptTaskDto
{
    [Required]
    public int PingId { get; set; }
}

// ═══════════════════════════════════════════
//  ERROR DTOs
// ═══════════════════════════════════════════

public class ApiErrorResponse
{
    public int StatusCode { get; set; }
    public string Message { get; set; } = string.Empty;
    public IEnumerable<string>? Errors { get; set; }
}

// ═══════════════════════════════════════════
//  API KEY POOL DTOs
// ═══════════════════════════════════════════

public class CreateApiKeyDto
{
    [Required]
    public string Provider { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Label { get; set; } = string.Empty;

    [Required]
    public string KeyValue { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Model { get; set; } = string.Empty;
}

public class UpdateApiKeyDto
{
    [StringLength(100)]
    public string? Label { get; set; }

    public string? KeyValue { get; set; }

    [StringLength(100)]
    public string? Model { get; set; }

    public bool? IsActive { get; set; }
}

public class ApiKeyResponseDto
{
    public int Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    /// <summary>Masked key for display (only first 8 + last 4 chars shown).</summary>
    public string MaskedKey { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int UsageCount { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ═══════════════════════════════════════════
//  CONTACT INFO DTO (support button)
// ═══════════════════════════════════════════

/// <summary>
/// Basic contact info shown to Sponsors/Volunteers when they click "Support" on a PIN user.
/// </summary>
public class ContactInfoDto
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? AvatarUrl { get; set; }
}

// ═══════════════════════════════════════════
//  RESTORE DTOs
// ═══════════════════════════════════════════

public class DeletedPostDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedByAdminName { get; set; }
    public int DaysRemaining { get; set; }
}

public class HiddenCommentDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public int PostId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? HiddenAt { get; set; }
    public DateTime? HiddenUntil { get; set; }
    public string? HiddenByAdminName { get; set; }
    public string? HiddenReason { get; set; }
    public bool UserWasNotified { get; set; }
    public bool IsIndefinite { get; set; }
    public int? DaysRemaining { get; set; }
}

public class HideCommentRequestDto
{
    public int? DurationDays { get; set; }
    public string Reason { get; set; } = string.Empty;
    public bool NotifyUser { get; set; }
}
