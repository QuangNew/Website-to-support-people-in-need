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

public class AdminPostDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string AuthorId { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
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

    public string? Details { get; set; }
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
    public DateTime CreatedAt { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? UserName { get; set; }
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
    public DateTime CreatedAt { get; set; }
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
