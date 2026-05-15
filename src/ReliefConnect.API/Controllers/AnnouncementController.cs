using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.Core.DTOs;
using ReliefConnect.API.Services;
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
    private readonly IMemoryCache _cache;

    public AnnouncementController(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    /// <summary>
    /// Get active (non-expired) system announcements, newest first.
    /// </summary>
    [HttpGet("active")]
    public async Task<ActionResult> GetActiveAnnouncements([FromQuery] int limit = 10)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        var cacheKey = AnnouncementCacheKeys.Active(limit);
        if (_cache.TryGetValue(cacheKey, out List<AnnouncementDto>? cached) && cached != null)
            return Ok(cached);

        var now = DateTime.UtcNow;

        var announcements = await (
            from announcement in _db.SystemAnnouncements.AsNoTracking()
            where announcement.ExpiresAt == null || announcement.ExpiresAt > now
            join admin in _db.Users.AsNoTracking()
                on announcement.AdminId equals admin.Id into adminUsers
            from admin in adminUsers.DefaultIfEmpty()
            orderby announcement.CreatedAt descending
            select new AnnouncementDto
            {
                Id        = announcement.Id,
                Title     = announcement.Title,
                Content   = announcement.Content,
                AdminId   = announcement.AdminId,
                AdminName = admin != null ? admin.FullName ?? admin.UserName ?? "Admin" : "Admin",
                CreatedAt = announcement.CreatedAt,
                ExpiresAt = announcement.ExpiresAt,
                IsExpired = false,
            })
            .Take(limit)
            .ToListAsync();

        _cache.Set(cacheKey, announcements, TimeSpan.FromSeconds(30));
        return Ok(announcements);
    }
}
