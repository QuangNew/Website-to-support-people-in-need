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
            .Include(p => p.User)
            .Where(p => p.Type == MapItemType.SOS && p.Status == SOSStatus.Pending)
            .AsNoTracking();

        if (lat.HasValue && lng.HasValue)
            query = query.OrderBy(p => Math.Pow(p.CoordinatesLat - lat.Value, 2) + Math.Pow(p.CoordinatesLong - lng.Value, 2));

        var tasks = await query.Take(50).ToListAsync();

        return Ok(tasks.Select(p => new
        {
            p.Id,
            Lat = p.CoordinatesLat,
            Lng = p.CoordinatesLong,
            p.Details,
            p.PriorityLevel,
            p.CreatedAt,
            UserName = p.User?.FullName
        }));
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

    [HttpGet("my-tasks")]
    public async Task<ActionResult> GetMyTasks()
    {
        var tasks = await _db.Pings
            .Include(p => p.User)
            .Where(p => p.Status == SOSStatus.InProgress)
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(tasks.Select(p => new
        {
            p.Id,
            Lat = p.CoordinatesLat,
            Lng = p.CoordinatesLong,
            Status = p.Status.ToString(),
            p.Details,
            p.CreatedAt
        }));
    }
}
