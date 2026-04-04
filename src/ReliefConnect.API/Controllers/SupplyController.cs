using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// CRUD for supply warehouse items on the relief map.
/// Sprint 2 — supports REQ-MAP-01.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SupplyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly INotificationService _notifications;
    private readonly ILogger<SupplyController> _logger;

    public SupplyController(AppDbContext db, INotificationService notifications, ILogger<SupplyController> logger)
    {
        _db = db;
        _notifications = notifications;
        _logger = logger;
    }

    // ─────────────────────────────────────
    // GET /api/supply
    // ─────────────────────────────────────
    /// <summary>
    /// Get all supply items. Public endpoint.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SupplyResponseDto>>> GetSupplies()
    {
        var supplies = await _db.SupplyItems
            .AsNoTracking()
            .OrderByDescending(s => s.CreatedAt)
            .Take(500)
            .Select(s => new SupplyResponseDto
            {
                Id = s.Id,
                Name = s.Name,
                Quantity = s.Quantity,
                Lat = s.CoordinatesLat,
                Lng = s.CoordinatesLong,
                CreatedAt = s.CreatedAt,
            })
            .ToListAsync();

        return Ok(supplies);
    }

    // ─────────────────────────────────────
    // GET /api/supply/{id}
    // ─────────────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<ActionResult<SupplyResponseDto>> GetSupplyById(int id)
    {
        var supply = await _db.SupplyItems.FindAsync(id);
        if (supply == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy kho hàng cứu trợ." });

        return Ok(MapToDto(supply));
    }

    // ─────────────────────────────────────
    // POST /api/supply
    // ─────────────────────────────────────
    /// <summary>
    /// Create a new supply item. Only Sponsors, Volunteers, or Admins can create.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "RequireVerified")]
    public async Task<ActionResult<SupplyResponseDto>> CreateSupply([FromBody] CreateSupplyDto dto)
    {
        var supply = new SupplyItem
        {
            Name = dto.Name,
            Quantity = dto.Quantity,
            CoordinatesLat = dto.Lat,
            CoordinatesLong = dto.Lng,
            CreatedAt = DateTime.UtcNow,
        };

        _db.SupplyItems.Add(supply);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Supply item created: Id={SupplyId}, Name={Name}", supply.Id, supply.Name);

        // Notify volunteers about new supply point
        _ = _notifications.SendToRoleAsync((int)Core.Enums.RoleEnum.Volunteer,
            $"Điểm cung cấp mới: {supply.Name} (SL: {supply.Quantity})");

        return CreatedAtAction(nameof(GetSupplyById), new { id = supply.Id }, MapToDto(supply));
    }

    // ─────────────────────────────────────
    // PUT /api/supply/{id}
    // ─────────────────────────────────────
    [HttpPut("{id:int}")]
    [Authorize(Policy = "RequireVerified")]
    public async Task<ActionResult<SupplyResponseDto>> UpdateSupply(int id, [FromBody] UpdateSupplyDto dto)
    {
        var supply = await _db.SupplyItems.FindAsync(id);
        if (supply == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy kho hàng cứu trợ." });

        if (dto.Name != null) supply.Name = dto.Name;
        if (dto.Quantity.HasValue) supply.Quantity = dto.Quantity.Value;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Supply item updated: Id={SupplyId}", id);

        return Ok(MapToDto(supply));
    }

    // ─────────────────────────────────────
    // DELETE /api/supply/{id}
    // ─────────────────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> DeleteSupply(int id)
    {
        var rows = await _db.SupplyItems.Where(s => s.Id == id).ExecuteDeleteAsync();
        if (rows == 0)
            return NotFound();

        _logger.LogInformation("Supply item deleted: Id={SupplyId}", id);

        return NoContent();
    }

    // ─── DTO Mapping ───
    private static SupplyResponseDto MapToDto(SupplyItem s) => new()
    {
        Id = s.Id,
        Name = s.Name,
        Quantity = s.Quantity,
        Lat = s.CoordinatesLat,
        Lng = s.CoordinatesLong,
        CreatedAt = s.CreatedAt,
    };
}
