using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;
    private readonly IEmailService _emailService;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration config,
        ILogger<AuthController> logger,
        IEmailService emailService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
        _logger = logger;
        _emailService = emailService;
    }

    // ═══════════════════════════════════════════
    //  REGISTER (with email verification code)
    // ═══════════════════════════════════════════

    /// <summary>
    /// Register a new user account. Sends a 6-digit verification code to the email.
    /// </summary>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterDto dto)
    {
        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        if (existingUser != null)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Email đã được sử dụng." });

        // Generate 6-digit verification code
        var verificationCode = GenerateVerificationCode();

        var user = new ApplicationUser
        {
            UserName = dto.Username,
            Email = dto.Email,
            FullName = dto.FullName,
            Role = RoleEnum.Guest,
            VerificationStatus = VerificationStatus.None,
            EmailConfirmed = false,
            EmailVerificationCode = verificationCode,
            EmailVerificationCodeExpiry = DateTime.UtcNow.AddMinutes(15),
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new ApiErrorResponse
            {
                StatusCode = 400,
                Message = "Đăng ký thất bại.",
                Errors = result.Errors.Select(e => e.Description)
            });
        }

        // Send verification email
        try
        {
            await _emailService.SendVerificationCodeAsync(dto.Email, verificationCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send verification email to {Email}", dto.Email);
        }

        _logger.LogInformation("User registered: {Username} ({Email}) — verification code sent", dto.Username, dto.Email);

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponseDto
        {
            Token = token.Token,
            UserId = user.Id,
            UserName = user.UserName!,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            EmailVerified = false,
            ExpiresAt = token.ExpiresAt
        });
    }

    // ═══════════════════════════════════════════
    //  VERIFY EMAIL (6-digit code)
    // ═══════════════════════════════════════════

    /// <summary>
    /// Verify email with the 6-digit code sent during registration.
    /// </summary>
    [HttpPost("verify-email")]
    [Authorize]
    public async Task<ActionResult> VerifyEmail([FromBody] VerifyEmailDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        if (user.EmailConfirmed)
            return Ok(new { message = "Email đã được xác nhận trước đó." });

        if (user.EmailVerificationCode != dto.Code)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Mã xác nhận không đúng." });

        if (user.EmailVerificationCodeExpiry.HasValue && user.EmailVerificationCodeExpiry < DateTime.UtcNow)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Mã xác nhận đã hết hạn. Vui lòng yêu cầu gửi lại." });

        user.EmailConfirmed = true;
        user.EmailVerificationCode = null;
        user.EmailVerificationCodeExpiry = null;
        await _userManager.UpdateAsync(user);

        _logger.LogInformation("Email verified: {Username}", user.UserName);

        return Ok(new { message = "Email đã được xác nhận thành công!" });
    }

    /// <summary>
    /// Resend the email verification code.
    /// </summary>
    [HttpPost("resend-code")]
    [Authorize]
    public async Task<ActionResult> ResendVerificationCode()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        if (user.EmailConfirmed)
            return Ok(new { message = "Email đã được xác nhận rồi." });

        var code = GenerateVerificationCode();
        user.EmailVerificationCode = code;
        user.EmailVerificationCodeExpiry = DateTime.UtcNow.AddMinutes(15);
        await _userManager.UpdateAsync(user);

        try
        {
            await _emailService.SendVerificationCodeAsync(user.Email!, code);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resend verification email to {Email}", user.Email);
            return StatusCode(500, new ApiErrorResponse { StatusCode = 500, Message = "Không thể gửi email. Vui lòng thử lại." });
        }

        return Ok(new { message = "Mã xác nhận mới đã được gửi." });
    }

    // ═══════════════════════════════════════════
    //  LOGIN
    // ═══════════════════════════════════════════

    /// <summary>
    /// Login with email/username and password.
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
    {
        // Support login by email OR username
        var user = await _userManager.FindByEmailAsync(dto.Email)
                ?? await _userManager.FindByNameAsync(dto.Email);
        if (user == null)
            return Unauthorized(new ApiErrorResponse { StatusCode = 401, Message = "Email/tên đăng nhập hoặc mật khẩu không đúng." });

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            if (result.IsLockedOut)
                return Unauthorized(new ApiErrorResponse { StatusCode = 401, Message = "Tài khoản bị khóa. Vui lòng thử lại sau 5 phút." });

            return Unauthorized(new ApiErrorResponse { StatusCode = 401, Message = "Email/tên đăng nhập hoặc mật khẩu không đúng." });
        }

        _logger.LogInformation("User logged in: {Username}", user.UserName);

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponseDto
        {
            Token = token.Token,
            UserId = user.Id,
            UserName = user.UserName!,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            EmailVerified = user.EmailConfirmed,
            ExpiresAt = token.ExpiresAt
        });
    }

    // ═══════════════════════════════════════════
    //  GOOGLE OAUTH
    // ═══════════════════════════════════════════

    /// <summary>
    /// Login / register via Google OAuth. Frontend sends the Google ID token (credential).
    /// </summary>
    [HttpPost("google")]
    public async Task<ActionResult<AuthResponseDto>> GoogleLogin([FromBody] GoogleLoginDto dto)
    {
        GoogleJsonWebSignature.Payload payload;
        try
        {
            var clientId = _config["Google:ClientId"] ?? "";
            _logger.LogInformation("Google OAuth: validating token with ClientId={ClientId}", clientId[..Math.Min(20, clientId.Length)] + "...");

            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId },
                // Allow 5-minute clock skew tolerance
                IssuedAtClockTolerance = TimeSpan.FromMinutes(5),
                ExpirationTimeClockTolerance = TimeSpan.FromMinutes(5)
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(dto.Credential, settings);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Google OAuth: InvalidJwtException — {Message}", ex.Message);
            return Unauthorized(new ApiErrorResponse { StatusCode = 401, Message = "Google token không hợp lệ." });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google OAuth: token validation failed — {Message}", ex.Message);
            return Unauthorized(new ApiErrorResponse { StatusCode = 401, Message = $"Google xác thực thất bại: {ex.Message}" });
        }

        // Find existing user by Google ID or email
        var user = await FindUserByGoogleIdOrEmail(payload.Subject, payload.Email);

        if (user == null)
        {
            // Create new user from Google profile
            user = new ApplicationUser
            {
                UserName = payload.Email.Split('@')[0] + "_g",
                Email = payload.Email,
                FullName = payload.Name ?? payload.Email,
                GoogleId = payload.Subject,
                AvatarUrl = payload.Picture,
                EmailConfirmed = payload.EmailVerified,
                Role = RoleEnum.Guest,
                VerificationStatus = VerificationStatus.None,
                CreatedAt = DateTime.UtcNow
            };

            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                return BadRequest(new ApiErrorResponse
                {
                    StatusCode = 400,
                    Message = "Không thể tạo tài khoản từ Google.",
                    Errors = createResult.Errors.Select(e => e.Description)
                });
            }

            _logger.LogInformation("New Google user created: {Email}", payload.Email);
        }
        else
        {
            // Link Google ID if not yet linked
            if (string.IsNullOrEmpty(user.GoogleId))
            {
                user.GoogleId = payload.Subject;
                if (!string.IsNullOrEmpty(payload.Picture) && string.IsNullOrEmpty(user.AvatarUrl))
                    user.AvatarUrl = payload.Picture;
                if (payload.EmailVerified && !user.EmailConfirmed)
                    user.EmailConfirmed = true;
                await _userManager.UpdateAsync(user);
            }
        }

        _logger.LogInformation("Google login: {Username}", user.UserName);

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponseDto
        {
            Token = token.Token,
            UserId = user.Id,
            UserName = user.UserName!,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            EmailVerified = user.EmailConfirmed,
            ExpiresAt = token.ExpiresAt
        });
    }

    // ═══════════════════════════════════════════
    //  PROFILE
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get current authenticated user's profile.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserProfileDto>> GetMe()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        return Ok(new UserProfileDto
        {
            Id = user.Id,
            UserName = user.UserName!,
            Email = user.Email!,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            VerificationStatus = user.VerificationStatus.ToString(),
            EmailVerified = user.EmailConfirmed,
            AvatarUrl = user.AvatarUrl,
            CreatedAt = user.CreatedAt
        });
    }

    /// <summary>
    /// Update user profile (name, avatar).
    /// </summary>
    [HttpPut("profile")]
    [Authorize]
    public async Task<ActionResult<UserProfileDto>> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        if (dto.FullName != null) user.FullName = dto.FullName;
        if (dto.AvatarUrl != null) user.AvatarUrl = dto.AvatarUrl;

        await _userManager.UpdateAsync(user);
        _logger.LogInformation("Profile updated: {Username}", user.UserName);

        return Ok(new UserProfileDto
        {
            Id = user.Id,
            UserName = user.UserName!,
            Email = user.Email!,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            VerificationStatus = user.VerificationStatus.ToString(),
            EmailVerified = user.EmailConfirmed,
            AvatarUrl = user.AvatarUrl,
            CreatedAt = user.CreatedAt
        });
    }

    // ═══════════════════════════════════════════
    //  ROLE VERIFICATION (KYC)
    // ═══════════════════════════════════════════

    /// <summary>
    /// Submit a role verification request (KYC).
    /// Allowed target roles: PersonInNeed, Sponsor, Volunteer.
    /// </summary>
    [HttpPost("verify-role")]
    [Authorize]
    public async Task<ActionResult> SubmitVerification([FromBody] VerifyRoleDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        if (user.VerificationStatus == VerificationStatus.Pending)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Bạn đã có yêu cầu xác minh đang chờ duyệt." });

        if (!Enum.TryParse<RoleEnum>(dto.RequestedRole, true, out var role) || role == RoleEnum.Admin || role == RoleEnum.Guest)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vai trò không hợp lệ. Chọn: PersonInNeed, Sponsor, hoặc Volunteer." });

        user.VerificationStatus = VerificationStatus.Pending;
        user.RequestedRole = dto.RequestedRole;
        user.VerificationReason = dto.Reason;
        await _userManager.UpdateAsync(user);

        _logger.LogInformation("Verification requested: {Username} → {Role}", user.UserName, dto.RequestedRole);

        return Ok(new { message = "Yêu cầu xác minh đã được gửi. Admin sẽ duyệt sớm nhất." });
    }

    // ═══════════════════════════════════════════
    //  PRIVATE HELPERS
    // ═══════════════════════════════════════════

    private (string Token, DateTime ExpiresAt) GenerateJwtToken(ApplicationUser user)
    {
        var key = _config["Jwt:Key"] ?? "DefaultDevSecretKey_ChangeInProduction_AtLeast32Characters!!";
        var issuer = _config["Jwt:Issuer"] ?? "ReliefConnect";
        var audience = _config["Jwt:Audience"] ?? "ReliefConnectClient";
        var expiryMinutes = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? ""),
            new(ClaimTypes.Email, user.Email ?? ""),
            new("FullName", user.FullName),
            new("Role", user.Role.ToString()),
            new("VerificationStatus", user.VerificationStatus.ToString()),
            new("EmailVerified", user.EmailConfirmed.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private static string GenerateVerificationCode()
    {
        return Random.Shared.Next(100000, 999999).ToString();
    }

    private async Task<ApplicationUser?> FindUserByGoogleIdOrEmail(string googleId, string email)
    {
        // First try by GoogleId
        var byGoogleId = _userManager.Users.FirstOrDefault(u => u.GoogleId == googleId);
        if (byGoogleId != null) return byGoogleId;

        // Fall back to email
        return await _userManager.FindByEmailAsync(email);
    }
}
