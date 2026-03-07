using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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
    private readonly ILogger<MapController> _logger;

    public MapController(
        IPingRepository pingRepo,
        UserManager<ApplicationUser> userManager,
        ILogger<MapController> logger)
    {
        _pingRepo = pingRepo;
        _userManager = userManager;
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
    public async Task<ActionResult<IEnumerable<PingResponseDto>>> GetPings(
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] double? radiusKm)
    {
        IEnumerable<Ping> pings;

        if (lat.HasValue && lng.HasValue && radiusKm.HasValue)
        {
            pings = await _pingRepo.GetPingsInRadiusAsync(lat.Value, lng.Value, radiusKm.Value);
        }
        else
        {
            pings = await _pingRepo.GetAllAsync();
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
    /// Only verified PersonInNeed or Sponsor roles can create pings (REQ-MAP-02).
    /// </summary>
    [HttpPost("pings")]
    [Authorize(Policy = "RequireVerified")]
    public async Task<ActionResult<PingResponseDto>> CreatePing([FromBody] CreatePingDto dto)
    {
        var userId = User.FindFirst("UserId")?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return Unauthorized();

        if (!Enum.TryParse<MapItemType>(dto.Type, true, out var mapType))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Loại ping không hợp lệ. Chấp nhận: SOS, Supply, Shelter." });

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

        // Reload with includes
        var full = await _pingRepo.GetPingWithFlagAsync(created.Id);
        return CreatedAtAction(nameof(GetPingById), new { id = created.Id }, MapPingToDto(full!));
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
        var ping = await _pingRepo.GetPingWithFlagAsync(id);
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
        var userId = User.FindFirst("UserId")?.Value;
        var ping = await _pingRepo.GetPingWithFlagAsync(id);

        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        if (ping.UserId != userId)
            return Forbid();

        ping.Status = SOSStatus.VerifiedSafe;
        if (ping.PingFlag != null)
            ping.PingFlag.IsBlinking = false;

        await _pingRepo.UpdateAsync(ping);
        _logger.LogInformation("Ping {PingId} confirmed safe by user {UserId}", id, userId);

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
}
