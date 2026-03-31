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
[Authorize(Policy = "RequireSponsor")]
public class SponsorController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly INotificationService _notifications;

    public SponsorController(AppDbContext db, INotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    [HttpGet("cases")]
    public async Task<ActionResult> SearchSupportCases(
        [FromQuery] string? category,
        [FromQuery] string? status,
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] double? radiusKm)
    {
        var query = _db.Pings
            .Where(p => p.Type == MapItemType.SOS)
            .AsNoTracking();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SOSStatus>(status, true, out var s))
            query = query.Where(p => p.Status == s);

        if (lat.HasValue && lng.HasValue && radiusKm.HasValue)
        {
            var r = radiusKm.Value / 111.0; // Convert km to degrees (approximate)
            var latMin = lat.Value - r;
            var latMax = lat.Value + r;
            var lngMin = lng.Value - r;
            var lngMax = lng.Value + r;
            query = query.Where(p =>
                p.CoordinatesLat >= latMin && p.CoordinatesLat <= latMax &&
                p.CoordinatesLong >= lngMin && p.CoordinatesLong <= lngMax);
        }

        // Build posts query — parse category to enum for index-friendly comparison
        var postsQuery = _db.Posts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(category) && Enum.TryParse<PostCategory>(category, true, out var cat))
            postsQuery = postsQuery.Where(p => p.Category == cat);

        // Run both queries in parallel — use projection to avoid loading full User/Author entities
        var pingsTask = query
            .OrderByDescending(p => p.CreatedAt)
            .Take(20)
            .Select(p => new
            {
                p.Id,
                p.CoordinatesLat,
                p.CoordinatesLong,
                Status = p.Status.ToString(),
                p.Details,
                p.CreatedAt,
                UserName = p.User != null ? p.User.FullName : null
            })
            .ToListAsync();

        var postsTask = postsQuery
            .OrderByDescending(p => p.CreatedAt)
            .Take(20)
            .Select(p => new
            {
                p.Id,
                p.Content,
                Category = p.Category.ToString(),
                p.CreatedAt,
                AuthorName = p.Author != null ? p.Author.FullName : null
            })
            .ToListAsync();

        await Task.WhenAll(pingsTask, postsTask);

        return Ok(new
        {
            sosCases = pingsTask.Result,
            socialCases = postsTask.Result
        });
    }

    [HttpPost("offer-help")]
    public async Task<ActionResult> OfferHelp([FromBody] OfferHelpDto dto)
    {
        var ping = await _db.Pings.FindAsync(dto.PingId);
        if (ping == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy yêu cầu." });

        // Use centralized NotificationService instead of inline creation
        await _notifications.SendAsync(ping.UserId,
            $"Nhà tài trợ đã đề nghị hỗ trợ: {dto.Message ?? "Sẵn sàng giúp đỡ"}");

        return Ok(new { message = "Đã gửi đề nghị hỗ trợ." });
    }
}
