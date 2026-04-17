using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Zone management for Admin — Priority Zone CRUD (REQ-MAP-04).
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ZoneController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly INotificationService _notifications;
    private readonly ILogger<ZoneController> _logger;

    public ZoneController(AppDbContext context, INotificationService notifications, ILogger<ZoneController> logger)
    {
        _context = context;
        _notifications = notifications;
        _logger = logger;
    }

    // GET /api/zone
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ZoneResponseDto>>> GetZones()
    {
        var zones = await _context.Zones
            .AsNoTracking()
            .OrderByDescending(z => z.RiskLevel)
            .ThenBy(z => z.Name)
            .Select(z => new ZoneResponseDto
            {
                Id = z.Id,
                Name = z.Name,
                BoundaryGeoJson = z.BoundaryGeoJson,
                RiskLevel = z.RiskLevel,
                CreatedAt = z.CreatedAt,
            })
            .ToListAsync();

        return Ok(zones);
    }

    // GET /api/zone/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ZoneResponseDto>> GetZone(int id)
    {
        var zone = await _context.Zones
            .AsNoTracking()
            .Where(z => z.Id == id)
            .Select(z => new ZoneResponseDto
            {
                Id = z.Id,
                Name = z.Name,
                BoundaryGeoJson = z.BoundaryGeoJson,
                RiskLevel = z.RiskLevel,
                CreatedAt = z.CreatedAt,
            })
            .FirstOrDefaultAsync();

        if (zone == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy vùng ưu tiên." });

        return Ok(zone);
    }

    // POST /api/zone
    [HttpPost]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ZoneResponseDto>> CreateZone([FromBody] CreateZoneDto dto)
    {
        var zone = new Zone
        {
            Name = dto.Name,
            BoundaryGeoJson = dto.BoundaryGeoJson,
            RiskLevel = dto.RiskLevel,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Zones.Add(zone);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Zone created: {ZoneId} — {ZoneName}, risk={Risk}", zone.Id, zone.Name, zone.RiskLevel);

        // Notify admins about new priority zone
        try
        {
            await _notifications.SendToRoleAsync((int)Core.Enums.RoleEnum.Admin,
                $"Vùng ưu tiên mới: {zone.Name} (Mức rủi ro: {zone.RiskLevel})");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send admin notification for zone {ZoneId}", zone.Id);
        }

        return CreatedAtAction(nameof(GetZone), new { id = zone.Id }, new ZoneResponseDto
        {
            Id = zone.Id,
            Name = zone.Name,
            BoundaryGeoJson = zone.BoundaryGeoJson,
            RiskLevel = zone.RiskLevel,
            CreatedAt = zone.CreatedAt,
        });
    }

    // PUT /api/zone/{id}
    [HttpPut("{id:int}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<ZoneResponseDto>> UpdateZone(int id, [FromBody] CreateZoneDto dto)
    {
        var zone = await _context.Zones.FindAsync(id);
        if (zone == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy vùng ưu tiên." });

        zone.Name = dto.Name;
        zone.BoundaryGeoJson = dto.BoundaryGeoJson;
        zone.RiskLevel = dto.RiskLevel;

        await _context.SaveChangesAsync();
        _logger.LogInformation("Zone updated: {ZoneId}", id);

        return Ok(new ZoneResponseDto
        {
            Id = zone.Id,
            Name = zone.Name,
            BoundaryGeoJson = zone.BoundaryGeoJson,
            RiskLevel = zone.RiskLevel,
            CreatedAt = zone.CreatedAt,
        });
    }

    // DELETE /api/zone/{id}
    [HttpDelete("{id:int}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> DeleteZone(int id)
    {
        var rows = await _context.Zones.Where(z => z.Id == id).ExecuteDeleteAsync();
        if (rows == 0)
            return NotFound();

        _logger.LogInformation("Zone deleted: {ZoneId}", id);

        return NoContent();
    }
}
