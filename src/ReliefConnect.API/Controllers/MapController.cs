using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;

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

    public MapController(
        IPingRepository pingRepo,
        UserManager<ApplicationUser> userManager,
        INotificationService notifications,
        ILogger<MapController> logger)
    {
        _pingRepo = pingRepo;
        _userManager = userManager;
        _notifications = notifications;
        _logger = logger;
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

        var dtos = pings.Select(MapPingToDto);
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

        return Ok(MapPingToDto(ping));
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
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Lightweight user check — only fetch the name, not the full entity
        var userName = await _userManager.Users
            .Where(u => u.Id == userId)
            .Select(u => u.FullName ?? u.UserName)
            .FirstOrDefaultAsync();
        if (userName == null)
            return Unauthorized();

        if (!Enum.TryParse<MapItemType>(dto.Type, true, out var mapType))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Loại ping không hợp lệ. Chấp nhận: SOS, Supply, Shelter." });

        // Supply and Shelter pings are admin-only
        if (mapType is MapItemType.Supply or MapItemType.Shelter && !User.IsInRole("Admin"))
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null || user.Role != RoleEnum.Admin)
                return Forbid();
        }

        // Validate coordinates within Vietnam territory (bounding box + island zones)
        if (!IsInsideVietnamTerritory(dto.Lat, dto.Lng))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vị trí nằm ngoài lãnh thổ Việt Nam." });

        var ping = new Ping
        {
            CoordinatesLat = dto.Lat,
            CoordinatesLong = dto.Lng,
            Type = mapType,
            Status = mapType == MapItemType.SOS ? SOSStatus.Pending : SOSStatus.Resolved,
            Details = dto.Details,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
        };

        var created = await _pingRepo.AddAsync(ping);
        _logger.LogInformation("Ping created: Id={PingId}, Type={Type}, User={UserId}", created.Id, dto.Type, userId);

        // Notify volunteers about new SOS request
        if (ping.Type == MapItemType.SOS)
        {
            var detail = ping.Details?.Length > 100 ? ping.Details[..100] + "…" : ping.Details ?? "Không có chi tiết";
            _ = _notifications.SendToRoleAsync((int)Core.Enums.RoleEnum.Volunteer,
                $"SOS mới từ {userName}: {detail}");
        }

        // Build DTO directly — avoid reload round-trip
        var responseDto = new PingResponseDto
        {
            Id = created.Id,
            Lat = created.CoordinatesLat,
            Lng = created.CoordinatesLong,
            Type = created.Type.ToString(),
            Status = created.Status.ToString(),
            PriorityLevel = created.PriorityLevel,
            Details = created.Details,
            CreatedAt = created.CreatedAt,
            UserId = userId,
            UserName = userName,
            IsBlinking = false,
        };
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

        ping.Status = newStatus;

        // If resolved/safe, stop blinking
        if (newStatus is SOSStatus.Resolved or SOSStatus.VerifiedSafe && ping.PingFlag != null)
        {
            ping.PingFlag.IsBlinking = false;
        }

        await _pingRepo.UpdateAsync(ping);
        _logger.LogInformation("Ping {PingId} status updated to {Status}", id, dto.Status);

        // Notify ping owner about status change
        _ = _notifications.SendAsync(ping.UserId,
            $"Trạng thái SOS của bạn đã được cập nhật: {newStatus}");

        return Ok(MapPingToDto(ping));
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
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
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

        // Notify volunteers that user confirmed safe
        _ = _notifications.SendToRoleAsync((int)Core.Enums.RoleEnum.Volunteer,
            $"Người dùng đã xác nhận an toàn cho SOS #{id}");

        return Ok(MapPingToDto(ping));
    }

    // ─────────────────────────────────────
    // GET /api/map/pings/user/{userId}
    // ─────────────────────────────────────
    [HttpGet("pings/user/{userId}")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<PingResponseDto>>> GetPingsByUser(string userId)
    {
        var pings = await _pingRepo.GetPingsByUserAsync(userId);
        return Ok(pings.Select(MapPingToDto));
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
        return NoContent();
    }

    // ─── DTO Mapping ───
    private static PingResponseDto MapPingToDto(Ping ping) => new()
    {
        Id = ping.Id,
        Lat = ping.CoordinatesLat,
        Lng = ping.CoordinatesLong,
        Type = ping.Type.ToString(),
        Status = ping.Status.ToString(),
        PriorityLevel = ping.PriorityLevel,
        Details = ping.Details,
        CreatedAt = ping.CreatedAt,
        UserId = ping.UserId,
        UserName = ping.User?.FullName ?? ping.User?.UserName,
        IsBlinking = ping.PingFlag?.IsBlinking ?? false,
    };

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
