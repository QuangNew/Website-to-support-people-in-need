using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Public endpoint for active system announcements visible to all authenticated users.
/// </summary>
[ApiController]
[Route("api/announcements")]
[Authorize]
public class AnnouncementController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnnouncementController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Get active (non-expired) system announcements, newest first.
    /// </summary>
    [HttpGet("active")]
    public async Task<ActionResult> GetActiveAnnouncements([FromQuery] int limit = 10)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        var now = DateTime.UtcNow;

        var announcements = await _db.SystemAnnouncements
            .AsNoTracking()
            .Where(a => a.ExpiresAt == null || a.ExpiresAt > now)
            .OrderByDescending(a => a.CreatedAt)
            .Take(limit)
            .Select(a => new AnnouncementDto
            {
                Id        = a.Id,
                Title     = a.Title,
                Content   = a.Content,
                AdminId   = a.AdminId,
                AdminName = a.AdminId != null
                    ? _db.Users.Where(u => u.Id == a.AdminId).Select(u => u.FullName ?? u.UserName ?? "Admin").FirstOrDefault() ?? "Admin"
                    : "Admin",
                CreatedAt = a.CreatedAt,
                ExpiresAt = a.ExpiresAt,
                IsExpired = false,
            })
            .ToListAsync();

        return Ok(announcements);
    }
}
