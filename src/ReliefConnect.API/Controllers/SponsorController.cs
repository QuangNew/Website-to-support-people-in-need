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
[Authorize(Policy = "RequireSponsor")]
public class SponsorController : ControllerBase
{
    private readonly AppDbContext _db;

    public SponsorController(AppDbContext db) => _db = db;

    [HttpGet("cases")]
    public async Task<ActionResult> SearchSupportCases(
        [FromQuery] string? category,
        [FromQuery] string? status,
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] double? radiusKm)
    {
        var query = _db.Pings
            .Include(p => p.User)
            .Where(p => p.Type == MapItemType.SOS)
            .AsNoTracking();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SOSStatus>(status, true, out var s))
            query = query.Where(p => p.Status == s);

        if (lat.HasValue && lng.HasValue && radiusKm.HasValue)
        {
            var r = radiusKm.Value;
            query = query.Where(p =>
                Math.Sqrt(Math.Pow(p.CoordinatesLat - lat.Value, 2) + Math.Pow(p.CoordinatesLong - lng.Value, 2)) * 111 <= r);
        }

        var posts = await _db.Posts
            .Include(p => p.Author)
            .AsNoTracking()
            .Where(p => !string.IsNullOrEmpty(category) ? p.Category.ToString() == category : true)
            .OrderByDescending(p => p.CreatedAt)
            .Take(20)
            .ToListAsync();

        var pings = await query.OrderByDescending(p => p.CreatedAt).Take(20).ToListAsync();

        return Ok(new
        {
            sosCases = pings.Select(p => new
            {
                p.Id,
                p.CoordinatesLat,
                p.CoordinatesLong,
                Status = p.Status.ToString(),
                p.Details,
                p.CreatedAt,
                UserName = p.User?.FullName
            }),
            socialCases = posts.Select(p => new
            {
                p.Id,
                p.Content,
                Category = p.Category.ToString(),
                p.CreatedAt,
                AuthorName = p.Author?.FullName
            })
        });
    }

    [HttpPost("offer-help")]
    public async Task<ActionResult> OfferHelp([FromBody] OfferHelpDto dto)
    {
        var ping = await _db.Pings.FindAsync(dto.PingId);
        if (ping == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy yêu cầu." });

        _db.Notifications.Add(new Core.Entities.Notification
        {
            UserId = ping.UserId,
            MessageText = $"Nhà tài trợ đã đề nghị hỗ trợ: {dto.Message ?? "Sẵn sàng giúp đỡ"}",
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã gửi đề nghị hỗ trợ." });
    }
}
