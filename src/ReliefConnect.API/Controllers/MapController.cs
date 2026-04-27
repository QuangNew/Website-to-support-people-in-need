using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ReliefConnect.API.Extensions;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Map controller for relief ping CRUD and spatial queries.
/// Sprint 2 — REQ-MAP-01 through REQ-MAP-05.
/// Uses OpenStreetMap (Leaflet) on frontend; no server-side map API key needed.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class MapController : ControllerBase
{
    private readonly IPingRepository _pingRepo;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly INotificationService _notifications;
    private readonly ILogger<MapController> _logger;
    private readonly ISpamGuardService _spamGuard;
    private readonly AppDbContext _db;

    public MapController(
        IPingRepository pingRepo,
        UserManager<ApplicationUser> userManager,
        INotificationService notifications,
        ILogger<MapController> logger,
        ISpamGuardService spamGuard,
        AppDbContext db)
    {
        _pingRepo = pingRepo;
        _userManager = userManager;
        _notifications = notifications;
        _logger = logger;
        _spamGuard = spamGuard;
        _db = db;
    }

    // ─────────────────────────────────────
    // GET /api/map/pings
    // ─────────────────────────────────────
    /// <summary>
    /// Get all pings, optionally filtered by radius from a center point.
    /// Public endpoint — guests can view the map.
    /// </summary>
    [HttpGet("pings")]
    [OutputCache(PolicyName = "MapData30s")]
    public async Task<ActionResult<IEnumerable<PingResponseDto>>> GetPings(
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] double? radiusKm)
    {
        var includeSensitiveContact = CanViewSensitivePingContact(GetViewerRole());
        IEnumerable<Ping> pings;

        if (lat.HasValue && lng.HasValue && radiusKm.HasValue)
        {
            // Validate coordinates
            if (lat.Value < -90 || lat.Value > 90 || lng.Value < -180 || lng.Value > 180)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Invalid coordinates." });

            if (radiusKm.Value < 0 || radiusKm.Value > 10000)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Radius must be between 0 and 10000 km." });

            pings = await _pingRepo.GetPingsInRadiusAsync(lat.Value, lng.Value, radiusKm.Value);
        }
        else
        {
            // Limit to 500 most recent pings for performance
            pings = await _pingRepo.GetAllAsync(limit: 500);
        }

        var dtos = pings.Select(ping => MapPingToDto(ping, includeSensitiveContact));
        return Ok(dtos);
    }

    // ─────────────────────────────────────
    // GET /api/map/pings/{id}
    // ─────────────────────────────────────
    [HttpGet("pings/{id:int}")]
    public async Task<ActionResult<PingResponseDto>> GetPingById(int id)
    {
        var ping = await _pingRepo.GetPingWithFlagAsync(id);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole())));
    }

    // ─────────────────────────────────────
    // POST /api/map/pings
    // ─────────────────────────────────────
    /// <summary>
    /// Create a new ping on the map.
    /// Any authenticated user can create SOS pings.
    /// </summary>
    [HttpPost("pings")]
    [Authorize]
    public async Task<ActionResult<PingResponseDto>> CreatePing([FromBody] CreatePingDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var currentUser = await _userManager.Users
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                DisplayName = u.FullName ?? u.UserName,
                u.UserName,
                u.Email,
                u.Role,
            })
            .FirstOrDefaultAsync();
        if (currentUser == null)
            return Unauthorized();

        // ── Spam Guard ──
        var spamCheck = await _spamGuard.CheckPingAsync(userId);
        if (spamCheck.Verdict == SpamVerdict.Suspend)
        {
            await _spamGuard.SuspendForSpamAsync(userId, "Tạo SOS quá nhiều (>5 lần/giờ)");
            return StatusCode(429, new ApiErrorResponse { StatusCode = 429, Message = "Tài khoản của bạn đã bị tạm khóa do tạo SOS quá nhiều." });
        }

        if (!Enum.TryParse<MapItemType>(dto.Type, true, out var mapType))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Loại ping không hợp lệ. Chấp nhận: SOS, Supply, Shelter." });

        // Supply and Shelter pings are admin-only
        if (mapType is MapItemType.Supply or MapItemType.Shelter && currentUser.Role != RoleEnum.Admin)
            return Forbid();

        // Validate coordinates within Vietnam territory (bounding box + island zones)
        if (!IsInsideVietnamTerritory(dto.Lat, dto.Lng))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vị trí nằm ngoài lãnh thổ Việt Nam." });

        string? contactName = null;
        string? contactPhone = null;
        string? conditionImageUrl = string.IsNullOrWhiteSpace(dto.ConditionImageUrl)
            ? null
            : dto.ConditionImageUrl.Trim();

        if (mapType == MapItemType.SOS)
        {
            contactName = dto.ContactName?.Trim();
            if (string.IsNullOrWhiteSpace(contactName))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vui lòng nhập tên thật để gửi SOS." });

            contactPhone = dto.ContactPhone?.Trim();
            if (string.IsNullOrWhiteSpace(contactPhone))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vui lòng nhập số điện thoại để gửi SOS." });

            if (!IsValidContactPhone(contactPhone))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Số điện thoại không hợp lệ." });

            if (conditionImageUrl != null && !IsAllowedConditionImageUrl(conditionImageUrl))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Ảnh tình trạng không hợp lệ." });
        }
        else if (conditionImageUrl != null)
        {
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Ảnh tình trạng chỉ hỗ trợ cho SOS." });
        }

        var ping = new Ping
        {
            CoordinatesLat = dto.Lat,
            CoordinatesLong = dto.Lng,
            Type = mapType,
            Status = mapType == MapItemType.SOS ? SOSStatus.Pending : SOSStatus.Resolved,
            Details = dto.Details,
            ContactName = contactName,
            ContactPhone = contactPhone,
            ConditionImageUrl = conditionImageUrl,
            SOSCategory = mapType == MapItemType.SOS && !string.IsNullOrEmpty(dto.SOSCategory)
                ? Enum.TryParse<Core.Enums.SOSCategory>(dto.SOSCategory, true, out var cat) ? cat : Core.Enums.SOSCategory.Other
                : null,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
        };

        var created = await _pingRepo.AddAsync(ping);
        _logger.LogInformation("Ping created: Id={PingId}, Type={Type}, User={UserId}", created.Id, dto.Type, userId);
        await this.LogUserActivity(_db, "PingCreated", $"Created {created.Type} ping #{created.Id}; ping={created.Id}; status={created.Status}", userId, currentUser.DisplayName ?? currentUser.UserName);

        // Notify volunteers about new SOS request
        if (ping.Type == MapItemType.SOS)
        {
            var detail = ping.Details?.Length > 100 ? ping.Details[..100] + "…" : ping.Details ?? "Không có chi tiết";
            try
            {
                await _notifications.SendToRoleAsync((int)Core.Enums.RoleEnum.Volunteer,
                    $"SOS mới từ {contactName}: {detail}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send volunteer notification for SOS {PingId}", created.Id);
            }
        }

        var includeSensitiveContact = CanViewSensitivePingContact(currentUser.Role);

        var responseDto = new PingResponseDto
        {
            Id = created.Id,
            Lat = created.CoordinatesLat,
            Lng = created.CoordinatesLong,
            Type = created.Type.ToString(),
            Status = created.Status.ToString(),
            PriorityLevel = created.PriorityLevel,
            Details = created.Details,
            SOSCategory = created.SOSCategory?.ToString()?.ToLowerInvariant(),
            CreatedAt = created.CreatedAt,
            UserId = userId,
            UserName = contactName ?? currentUser.DisplayName,
            ContactName = contactName ?? currentUser.DisplayName,
            ContactPhone = includeSensitiveContact ? contactPhone : null,
            ContactEmail = includeSensitiveContact ? currentUser.Email : null,
            ConditionImageUrl = conditionImageUrl,
            IsBlinking = false,
        };

        if (spamCheck.Verdict == SpamVerdict.Warning)
            return CreatedAtAction(nameof(GetPingById), new { id = created.Id }, new { ping = responseDto, spamWarning = spamCheck.WarningMessage });

        return CreatedAtAction(nameof(GetPingById), new { id = created.Id }, responseDto);
    }

    // ─────────────────────────────────────
    // PUT /api/map/pings/{id}/status
    // ─────────────────────────────────────
    /// <summary>
    /// Update ping status (e.g., Volunteer marks as InProgress or Resolved).
    /// </summary>
    [HttpPut("pings/{id:int}/status")]
    [Authorize(Policy = "RequireVolunteer")]
    public async Task<ActionResult<PingResponseDto>> UpdatePingStatus(int id, [FromBody] UpdatePingStatusDto dto)
    {
        var ping = await _pingRepo.GetPingWithFlagForUpdateAsync(id);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        if (!Enum.TryParse<SOSStatus>(dto.Status, true, out var newStatus))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Trạng thái không hợp lệ. Chấp nhận: Pending, InProgress, Resolved, VerifiedSafe." });

        var oldStatus = ping.Status;
        ping.Status = newStatus;

        // If resolved/safe, stop blinking
        if (newStatus is SOSStatus.Resolved or SOSStatus.VerifiedSafe && ping.PingFlag != null)
        {
            ping.PingFlag.IsBlinking = false;
        }

        await _pingRepo.UpdateAsync(ping);
        _logger.LogInformation("Ping {PingId} status updated to {Status}", id, dto.Status);
        await this.LogUserActivity(_db, "PingStatusUpdated", $"Updated ping #{id} status {oldStatus} -> {newStatus}; ping={id}; target={ping.UserId}");

        // Notify ping owner about status change
        try
        {
            await _notifications.SendAsync(ping.UserId,
                $"Trạng thái SOS của bạn đã được cập nhật: {newStatus}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send owner notification for ping {PingId}", id);
        }

        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole())));
    }

    // ─────────────────────────────────────
    // POST /api/map/pings/{id}/confirm-safe
    // ─────────────────────────────────────
    /// <summary>
    /// PersonInNeed confirms their own safety (REQ-MAP-05).
    /// </summary>
    [HttpPost("pings/{id:int}/confirm-safe")]
    [Authorize(Policy = "RequirePersonInNeed")]
    public async Task<ActionResult<PingResponseDto>> ConfirmSafe(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var ping = await _pingRepo.GetPingWithFlagForUpdateAsync(id);

        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        if (ping.UserId != userId)
            return Forbid();

        ping.Status = SOSStatus.VerifiedSafe;
        if (ping.PingFlag != null)
            ping.PingFlag.IsBlinking = false;

        await _pingRepo.UpdateAsync(ping);
        _logger.LogInformation("Ping {PingId} confirmed safe by user {UserId}", id, userId);
        await this.LogUserActivity(_db, "PingConfirmedSafe", $"Confirmed safe for ping #{id}; ping={id}", userId);

        // Notify volunteers that user confirmed safe
        try
        {
            await _notifications.SendToRoleAsync((int)Core.Enums.RoleEnum.Volunteer,
                $"Người dùng đã xác nhận an toàn cho SOS #{id}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send volunteer safe-confirmation notification for ping {PingId}", id);
        }

        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole())));
    }

    // ─────────────────────────────────────
    // GET /api/map/pings/user/{userId}
    // ─────────────────────────────────────
    [HttpGet("pings/user/{userId}")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<PingResponseDto>>> GetPingsByUser(string userId)
    {
        var pings = await _pingRepo.GetPingsByUserAsync(userId);
        var includeSensitiveContact = CanViewSensitivePingContact(GetViewerRole());
        return Ok(pings.Select(ping => MapPingToDto(ping, includeSensitiveContact)));
    }

    // ─────────────────────────────────────
    // DELETE /api/map/pings/{id}
    // ─────────────────────────────────────
    [HttpDelete("pings/{id:int}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> DeletePing(int id)
    {
        var ping = await _pingRepo.GetByIdAsync(id);
        if (ping == null)
            return NotFound();

        await _pingRepo.DeleteAsync(id);
        _logger.LogInformation("Ping {PingId} deleted by admin", id);
        await this.LogUserActivity(_db, "PingDeleted", $"Deleted ping #{id}; ping={id}; target={ping.UserId}");
        return NoContent();
    }

    // ─── DTO Mapping ───
    private static PingResponseDto MapPingToDto(Ping ping, bool includeSensitiveContact) => new()
    {
        Id = ping.Id,
        Lat = ping.CoordinatesLat,
        Lng = ping.CoordinatesLong,
        Type = ping.Type.ToString(),
        Status = ping.Status.ToString(),
        PriorityLevel = ping.PriorityLevel,
        Details = ping.Details,
        SOSCategory = ping.SOSCategory?.ToString()?.ToLowerInvariant(),
        CreatedAt = ping.CreatedAt,
        UserId = ping.UserId,
        UserName = ping.ContactName ?? ping.User?.FullName ?? ping.User?.UserName,
        ContactName = ping.ContactName ?? ping.User?.FullName ?? ping.User?.UserName,
        ContactPhone = includeSensitiveContact ? ping.ContactPhone ?? ping.User?.PhoneNumber : null,
        ContactEmail = includeSensitiveContact ? ping.User?.Email : null,
        ConditionImageUrl = ping.ConditionImageUrl,
        IsBlinking = ping.PingFlag?.IsBlinking ?? false,
        AvatarUrl = ping.User?.AvatarUrl,
    };

    private RoleEnum? GetViewerRole()
    {
        if (User.Identity?.IsAuthenticated != true)
            return null;

        var roleValue = User.FindFirstValue("Role") ?? User.FindFirstValue(ClaimTypes.Role);
        return Enum.TryParse<RoleEnum>(roleValue, true, out var role)
            ? role
            : null;
    }

    private static bool CanViewSensitivePingContact(RoleEnum? viewerRole)
    {
        return viewerRole.HasValue
            && viewerRole.Value != RoleEnum.Guest
            && viewerRole.Value != RoleEnum.PersonInNeed;
    }

    private static bool IsValidContactPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length is >= 8 and <= 15;
    }

    private static bool IsAllowedConditionImageUrl(string imageUrl)
    {
        if (imageUrl.Length > 500)
            return false;

        if (imageUrl.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri))
            return false;

        return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
    }

    // ─── Vietnam territory validation ───
    private static bool IsInsideVietnamTerritory(double lat, double lng)
    {
        // Quick bounding-box rejection
        if (lat < 5.78 || lat > 23.39 || lng < 102.15 || lng > 117.72)
            return false;

        // Mainland bounding box (rough)
        if (lat >= 8.0 && lat <= 23.39 && lng >= 102.15 && lng <= 110.0)
            return true; // Western mainland

        // Check island zones
        // Paracel Islands (Hoang Sa)
        if (lat >= 15.48 && lat <= 17.37 && lng >= 110.78 && lng <= 113.12)
            return true;
        // Spratly Islands (Truong Sa)
        if (lat >= 5.78 && lat <= 12.20 && lng >= 109.28 && lng <= 117.72)
            return true;
        // Con Dao Islands
        if (lat >= 8.33 && lat <= 9.07 && lng >= 106.28 && lng <= 106.97)
            return true;
        // Phu Quoc Island
        if (lat >= 9.68 && lat <= 10.72 && lng >= 103.48 && lng <= 104.42)
            return true;

        // Eastern coast mainland (simplified: up to ~110°E at the widest)
        if (lat >= 8.0 && lat <= 23.39 && lng >= 102.15 && lng <= 110.0)
            return true;
        // Central/South coast extends slightly east
        if (lat >= 10.0 && lat <= 21.5 && lng >= 106.0 && lng <= 109.6)
            return true;

        return false;
    }
}
