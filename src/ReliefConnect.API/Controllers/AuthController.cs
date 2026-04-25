using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string AuthCookieName = "auth_token";
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;
    private readonly IEmailService _emailService;
    private readonly ITokenBlacklistService _tokenBlacklist;
    private readonly AppDbContext _db;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration config,
        ILogger<AuthController> logger,
        IEmailService emailService,
        ITokenBlacklistService tokenBlacklist,
        AppDbContext db)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
        _logger = logger;
        _emailService = emailService;
        _tokenBlacklist = tokenBlacklist;
        _db = db;
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
        await _emailService.SendVerificationCodeAsync(dto.Email, verificationCode);

        _logger.LogInformation("User registered: {Username} ({Email}) — verification code sent", dto.Username, dto.Email);

        var token = GenerateJwtToken(user);
        AppendAuthCookie(token.Token, token.ExpiresAt);
        return Ok(new AuthResponseDto
        {
            Token = token.Token,
            UserId = user.Id,
            UserName = user.UserName!,
            Email = user.Email!,
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

        if (user.EmailVerificationCode == null ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(user.EmailVerificationCode.PadRight(10)),
                Encoding.UTF8.GetBytes(dto.Code.PadRight(10))))
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

        await _emailService.SendVerificationCodeAsync(user.Email!, code);

        return Ok(new { message = "Mã xác nhận mới đã được gửi." });
    }

    // ═══════════════════════════════════════════
    //  FORGOT PASSWORD
    // ═══════════════════════════════════════════

    /// <summary>
    /// Request password reset. Sends a 6-digit token to the email.
    /// </summary>
    [HttpPost("forgot-password")]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null)
            return Ok(new { message = "Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi." });

        var resetToken = GenerateVerificationCode();
        user.PasswordResetToken = resetToken;
        user.PasswordResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await _userManager.UpdateAsync(user);

        await _emailService.SendEmailAsync(
            dto.Email,
            "Đặt lại mật khẩu - ReliefConnect",
            $"<p>Mã đặt lại mật khẩu của bạn là: <strong>{resetToken}</strong></p><p>Mã có hiệu lực trong 15 phút.</p>");

        _logger.LogInformation("Password reset requested: {Email}", dto.Email);

        return Ok(new { message = "Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi." });
    }

    /// <summary>
    /// Reset password with the 6-digit token.
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<ActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null || user.PasswordResetToken == null ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(user.PasswordResetToken.PadRight(10)),
                Encoding.UTF8.GetBytes(dto.Token.PadRight(10))))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Mã đặt lại không hợp lệ." });

        if (user.PasswordResetTokenExpiry.HasValue && user.PasswordResetTokenExpiry < DateTime.UtcNow)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Mã đặt lại đã hết hạn." });

        var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, resetToken, dto.NewPassword);

        if (!result.Succeeded)
            return BadRequest(new ApiErrorResponse
            {
                StatusCode = 400,
                Message = "Đặt lại mật khẩu thất bại.",
                Errors = result.Errors.Select(e => e.Description)
            });

        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        await _userManager.UpdateAsync(user);

        _logger.LogInformation("Password reset successful: {Email}", user.Email);

        return Ok(new { message = "Mật khẩu đã được đặt lại thành công!" });
    }

    // ═══════════════════════════════════════════
    //  CHANGE PASSWORD (authenticated)
    // ═══════════════════════════════════════════

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new ApiErrorResponse
            {
                StatusCode = 400,
                Message = "Đổi mật khẩu thất bại.",
                Errors = result.Errors.Select(e => e.Description)
            });

        _logger.LogInformation("Password changed for user: {UserId}", userId);
        return Ok(new { message = "Đổi mật khẩu thành công!" });
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
        AppendAuthCookie(token.Token, token.ExpiresAt);
        return Ok(new AuthResponseDto
        {
            Token = token.Token,
            UserId = user.Id,
            UserName = user.UserName!,
            Email = user.Email!,
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
            return Unauthorized(new ApiErrorResponse { StatusCode = 401, Message = "Google xác thực thất bại. Vui lòng thử lại." });
        }

        // Find existing user by Google ID or email
        ApplicationUser? user;
        try
        {
            user = await FindUserByGoogleIdOrEmail(payload.Subject, payload.Email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database connection failed during Google login");
            return StatusCode(503, new ApiErrorResponse
            {
                StatusCode = 503,
                Message = "Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau."
            });
        }

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
        AppendAuthCookie(token.Token, token.ExpiresAt);
        return Ok(new AuthResponseDto
        {
            Token = token.Token,
            UserId = user.Id,
            UserName = user.UserName!,
            Email = user.Email!,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            EmailVerified = user.EmailConfirmed,
            ExpiresAt = token.ExpiresAt
        });
    }

    // ═══════════════════════════════════════════
    //  LOGOUT
    // ═══════════════════════════════════════════

    /// <summary>
    /// Logout and blacklist the current token.
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult> Logout()
    {
        var jti = User.FindFirstValue(JwtRegisteredClaimNames.Jti);
        var exp = User.FindFirstValue(JwtRegisteredClaimNames.Exp);

        if (jti != null && exp != null && long.TryParse(exp, out var expUnix))
        {
            var expiry = DateTimeOffset.FromUnixTimeSeconds(expUnix).UtcDateTime;
            _tokenBlacklist.BlacklistToken(jti, expiry);
        }

        await _signInManager.SignOutAsync();
        DeleteAuthCookie();
        _logger.LogInformation("User logged out: {Username}", User.Identity?.Name);

        return Ok(new { message = "Đăng xuất thành công." });
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
            PhoneNumber = user.PhoneNumber,
            Address = user.Address,
            FacebookUrl = user.FacebookUrl,
            TelegramUrl = user.TelegramUrl,
            CreatedAt = user.CreatedAt
        });
    }

    /// <summary>
    /// Get a user's basic public profile for community previews.
    /// </summary>
    [HttpGet("users/{userId}/basic-profile")]
    [AllowAnonymous]
    public async Task<ActionResult<BasicUserProfileDto>> GetBasicProfile(string userId)
    {
        var profile = await _userManager.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new BasicUserProfileDto
            {
                Id = u.Id,
                UserName = u.UserName!,
                FullName = u.FullName,
                Role = u.Role.ToString(),
                VerificationStatus = u.VerificationStatus.ToString(),
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
            })
            .FirstOrDefaultAsync();

        if (profile == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        return Ok(profile);
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
        if (dto.PhoneNumber != null) user.PhoneNumber = dto.PhoneNumber;
        if (dto.FacebookUrl != null) user.FacebookUrl = dto.FacebookUrl;
        if (dto.TelegramUrl != null) user.TelegramUrl = dto.TelegramUrl;

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
            PhoneNumber = user.PhoneNumber,
            Address = user.Address,
            FacebookUrl = user.FacebookUrl,
            TelegramUrl = user.TelegramUrl,
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
        user.PhoneNumber = dto.PhoneNumber;
        if (dto.Address != null) user.Address = dto.Address;
        user.VerificationImageUrls = dto.ImageUrls != null && dto.ImageUrls.Count > 0
            ? string.Join(",", dto.ImageUrls.Take(5))
            : null;
        user.RequestedRoleExpiry = DateTime.UtcNow.AddYears(1).AddMonths(6);
        await _userManager.UpdateAsync(user);

        _db.VerificationHistories.Add(new VerificationHistory
        {
            UserId = user.Id,
            RequestedRole = dto.RequestedRole,
            VerificationReason = dto.Reason,
            VerificationImageUrls = user.VerificationImageUrls,
            PhoneNumber = dto.PhoneNumber,
            Address = dto.Address,
            Status = VerificationStatus.Pending,
            SubmittedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        _logger.LogInformation("Verification requested: {Username} → {Role}", user.UserName, dto.RequestedRole);

        return Ok(new { message = "Yêu cầu xác minh đã được gửi. Admin sẽ duyệt sớm nhất." });
    }

    // ═══════════════════════════════════════════
    //  CONTACT INFO (support button)
    // ═══════════════════════════════════════════

    /// <summary>
    /// Get contact info of a PersonInNeed user. Only Sponsors, Volunteers, and Admins can access.
    /// </summary>
    [HttpGet("users/{userId}/contact")]
    [Authorize]
    public async Task<ActionResult<ContactInfoDto>> GetContactInfo(string userId)
    {
        var callerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerId == null) return Unauthorized();

        var caller = await _userManager.FindByIdAsync(callerId);
        if (caller == null) return Unauthorized();

        // Only Sponsor, Volunteer, or Admin can see contact info
        if (caller.Role != RoleEnum.Sponsor && caller.Role != RoleEnum.Volunteer && caller.Role != RoleEnum.Admin)
            return Forbid();

        var target = await _userManager.FindByIdAsync(userId);
        if (target == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Người dùng không tồn tại." });

        // Non-admin can only see PersonInNeed contact info
        if (caller.Role != RoleEnum.Admin && target.Role != RoleEnum.PersonInNeed)
            return Forbid();

        return Ok(new ContactInfoDto
        {
            UserId = target.Id,
            FullName = target.FullName,
            Email = target.Email!,
            PhoneNumber = target.PhoneNumber,
            AvatarUrl = target.AvatarUrl,
            FacebookUrl = target.FacebookUrl,
            TelegramUrl = target.TelegramUrl
        });
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

    private void AppendAuthCookie(string token, DateTime expiresAt)
    {
        var secure = IsSecureRequest();
        var sameSite = secure ? SameSiteMode.None : SameSiteMode.Lax;
        var origin = Request.Headers["Origin"].ToString();

        _logger.LogInformation(
            "Setting auth cookie: Secure={Secure}, SameSite={SameSite}, Origin={Origin}, IsHttps={IsHttps}, X-Forwarded-Proto={XFP}",
            secure, sameSite, origin, Request.IsHttps, Request.Headers["X-Forwarded-Proto"].ToString());

        Response.Cookies.Append(AuthCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            // SameSite=None is required for cross-origin requests (frontend on Azure Static Web Apps,
            // backend on Azure App Service are different origins). None requires Secure=true.
            SameSite = sameSite,
            Expires = new DateTimeOffset(expiresAt),
            // Do NOT set MaxAge — when both Expires and MaxAge are present, MaxAge takes priority
            // (RFC 6265). If there is clock drift between the server and browser, MaxAge can evaluate
            // to near-zero, causing the cookie to expire immediately and triggering an auto-logout loop.
            Path = "/",
            IsEssential = true,
        });
    }

    private void DeleteAuthCookie()
    {
        var secure = IsSecureRequest();
        Response.Cookies.Delete(AuthCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Path = "/",
            IsEssential = true,
        });
    }

    private bool IsSecureRequest()
    {
        if (Request.IsHttps)
            return true;

        var forwardedProto = Request.Headers["X-Forwarded-Proto"].ToString();
        if (string.Equals(forwardedProto, "https", StringComparison.OrdinalIgnoreCase))
            return true;

        // Azure App Service always terminates SSL at the load balancer, so the
        // internal request is plain HTTP even though the client connected over HTTPS.
        // If the ForwardedHeaders middleware didn't trust the Azure proxy (KnownProxies
        // mismatch), Request.IsHttps stays false — detect this via environment instead.
        var env = _config["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        if (string.Equals(env, "Production", StringComparison.OrdinalIgnoreCase))
            return true;

        // Azure also sets the X-Forwarded-Ssl and X-ARR-SSL headers
        var arrSsl = Request.Headers["X-ARR-SSL"].ToString();
        if (!string.IsNullOrEmpty(arrSsl))
            return true;

        return false;
    }

    private static string GenerateVerificationCode()
    {
        return RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
    }

    private async Task<ApplicationUser?> FindUserByGoogleIdOrEmail(string googleId, string email)
    {
        // First try by GoogleId (async)
        var byGoogleId = await _userManager.Users.FirstOrDefaultAsync(u => u.GoogleId == googleId);
        if (byGoogleId != null) return byGoogleId;

        // Fall back to email
        return await _userManager.FindByEmailAsync(email);
    }
}
