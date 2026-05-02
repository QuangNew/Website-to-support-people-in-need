using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "RequireVolunteer")]
public class VolunteerController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly INotificationService _notifications;

    public VolunteerController(AppDbContext db, INotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    private async Task<ActionResult?> EnsureApprovedVolunteerAsync(string userId)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Role, u.VerificationStatus })
            .FirstOrDefaultAsync();

        if (user == null)
            return Unauthorized();

        if (user.Role == RoleEnum.Admin)
            return null;

        if (user.Role != RoleEnum.Volunteer || user.VerificationStatus != VerificationStatus.Approved)
        {
            return StatusCode(403, new ApiErrorResponse
            {
                StatusCode = 403,
                Message = "Tình nguyện viên phải được admin duyệt trước khi nhận nhiệm vụ SOS."
            });
        }

        return null;
    }

    [HttpGet("tasks")]
    public async Task<ActionResult<IEnumerable<VolunteerTaskDto>>> GetAvailableTasks([FromQuery] double? lat, [FromQuery] double? lng)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var approvalError = await EnsureApprovedVolunteerAsync(userId);
        if (approvalError != null)
            return approvalError;

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
            .Select(p => new VolunteerTaskDto
            {
                Id = p.Id,
                Lat = p.CoordinatesLat,
                Lng = p.CoordinatesLong,
                Details = p.Details,
                PriorityLevel = p.PriorityLevel,
                CreatedAt = p.CreatedAt,
                UserName = p.User != null ? p.User.FullName : null
            })
            .ToListAsync();

        return Ok(tasks);
    }

    [HttpPost("accept-task")]
    public async Task<ActionResult> AcceptTask([FromBody] AcceptTaskDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var approvalError = await EnsureApprovedVolunteerAsync(userId);
        if (approvalError != null)
            return approvalError;

        var ping = await _db.Pings
            .AsTracking()
            .FirstOrDefaultAsync(p => p.Id == dto.PingId);
        if (ping == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy nhiệm vụ." });

        if (ping.Status != SOSStatus.Pending)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Nhiệm vụ đã được nhận." });

        ping.Status = SOSStatus.InProgress;
        ping.AssignedVolunteerId = userId;
        await _db.SaveChangesAsync();

        try
        {
            await _notifications.SendAsync(ping.UserId, $"Một tình nguyện viên đã nhận yêu cầu SOS #{ping.Id}.");
        }
        catch
        {
        }

        return Ok(new { message = "Đã nhận nhiệm vụ.", pingId = ping.Id });
    }

    [HttpGet("active-tasks")]
    public async Task<ActionResult<IEnumerable<VolunteerTaskDto>>> GetActiveTasks()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var tasks = await _db.Pings
            .Where(p => p.Status == SOSStatus.InProgress && p.AssignedVolunteerId == userId)
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .Select(p => new VolunteerTaskDto
            {
                Id = p.Id,
                Lat = p.CoordinatesLat,
                Lng = p.CoordinatesLong,
                Status = p.Status.ToString(),
                Details = p.Details,
                PriorityLevel = p.PriorityLevel,
                CreatedAt = p.CreatedAt,
                UserName = p.User != null ? p.User.FullName : null,
                CompletionNotes = p.CompletionNotes,
            })
            .ToListAsync();

        return Ok(tasks);
    }

    [HttpPost("tasks/{pingId:int}/complete")]
    public async Task<ActionResult> CompleteTask(int pingId, [FromBody] CompleteTaskDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var ping = await _db.Pings
            .AsTracking()
            .FirstOrDefaultAsync(p => p.Id == pingId);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy nhiệm vụ." });

        if (ping.AssignedVolunteerId != userId)
            return Forbid();

        if (ping.Status != SOSStatus.InProgress)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Nhiệm vụ này không ở trạng thái đang thực hiện." });

        ping.Status = SOSStatus.Resolved;
        ping.CompletionNotes = string.IsNullOrWhiteSpace(dto.CompletionNotes) ? null : dto.CompletionNotes.Trim();
        await _db.SaveChangesAsync();

        try
        {
            await _notifications.SendAsync(ping.UserId, $"Yêu cầu SOS #{ping.Id} đã được đánh dấu hoàn thành.");
        }
        catch
        {
        }

        return Ok(new { message = "Đã hoàn thành nhiệm vụ.", pingId = ping.Id });
    }

    [HttpGet("tasks/history")]
    public async Task<ActionResult<IEnumerable<VolunteerTaskDto>>> GetTaskHistory()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var tasks = await _db.Pings
            .Where(p => p.AssignedVolunteerId == userId && (p.Status == SOSStatus.Resolved || p.Status == SOSStatus.VerifiedSafe))
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .Select(p => new VolunteerTaskDto
            {
                Id = p.Id,
                Lat = p.CoordinatesLat,
                Lng = p.CoordinatesLong,
                Status = p.Status.ToString(),
                Details = p.Details,
                PriorityLevel = p.PriorityLevel,
                CreatedAt = p.CreatedAt,
                UserName = p.User != null ? p.User.FullName : null,
                CompletionNotes = p.CompletionNotes,
            })
            .ToListAsync();

        return Ok(tasks);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<VolunteerStatsDto>> GetStats()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var tasks = await _db.Pings
            .AsNoTracking()
            .Where(p => p.AssignedVolunteerId == userId)
            .Select(p => new { p.Status, p.PriorityLevel })
            .ToListAsync();

        var response = new VolunteerStatsDto
        {
            TotalAcceptedTasks = tasks.Count,
            ActiveTasks = tasks.Count(p => p.Status == SOSStatus.InProgress),
            CompletedTasks = tasks.Count(p => p.Status == SOSStatus.Resolved || p.Status == SOSStatus.VerifiedSafe),
            VerifiedSafeTasks = tasks.Count(p => p.Status == SOSStatus.VerifiedSafe),
            HighPriorityActiveTasks = tasks.Count(p => p.Status == SOSStatus.InProgress && p.PriorityLevel >= 3),
        };

        return Ok(response);
    }
}
