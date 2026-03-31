using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "RequireVolunteer")]
public class VolunteerController : ControllerBase
{
    private readonly AppDbContext _db;

    public VolunteerController(AppDbContext db) => _db = db;

    [HttpGet("tasks")]
    public async Task<ActionResult> GetAvailableTasks([FromQuery] double? lat, [FromQuery] double? lng)
    {
        var query = _db.Pings
            .Where(p => p.Type == MapItemType.SOS && p.Status == SOSStatus.Pending)
            .AsNoTracking();

        if (lat.HasValue && lng.HasValue)
        {
            var delta = 0.5; // ~55km radius bounding box pre-filter
            query = query.Where(p =>
                p.CoordinatesLat  >= lat.Value - delta && p.CoordinatesLat  <= lat.Value + delta &&
                p.CoordinatesLong >= lng.Value - delta && p.CoordinatesLong <= lng.Value + delta);

            query = query.OrderBy(p =>
                (p.CoordinatesLat  - lat.Value) * (p.CoordinatesLat  - lat.Value) +
                (p.CoordinatesLong - lng.Value) * (p.CoordinatesLong - lng.Value));
        }

        var tasks = await query
            .Take(50)
            .Select(p => new
            {
                p.Id,
                Lat      = p.CoordinatesLat,
                Lng      = p.CoordinatesLong,
                p.Details,
                p.PriorityLevel,
                p.CreatedAt,
                UserName = p.User != null ? p.User.FullName : null
            })
            .ToListAsync();

        return Ok(tasks);
    }

    [HttpPost("accept-task")]
    public async Task<ActionResult> AcceptTask([FromBody] AcceptTaskDto dto)
    {
        var ping = await _db.Pings.FindAsync(dto.PingId);
        if (ping == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy nhiệm vụ." });

        if (ping.Status != SOSStatus.Pending)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Nhiệm vụ đã được nhận." });

        ping.Status = SOSStatus.InProgress;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã nhận nhiệm vụ.", pingId = ping.Id });
    }

    [HttpGet("active-tasks")]
    public async Task<ActionResult> GetActiveTasks()
    {
        var tasks = await _db.Pings
            .Where(p => p.Status == SOSStatus.InProgress)
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .Select(p => new
            {
                p.Id,
                Lat    = p.CoordinatesLat,
                Lng    = p.CoordinatesLong,
                Status = p.Status.ToString(),
                p.Details,
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(tasks);
    }
}
