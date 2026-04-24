using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
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

        var pings = await query
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

        var posts = await postsQuery
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

        return Ok(new
        {
            sosCases = pings,
            socialCases = posts
        });
    }

    [HttpGet("offers")]
    public async Task<ActionResult<IEnumerable<SponsorOfferHistoryDto>>> GetOffers()
    {
        var sponsorId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(sponsorId))
            return Unauthorized();

        var offers = await _db.HelpOffers
            .AsNoTracking()
            .Where(h => h.SponsorId == sponsorId)
            .OrderByDescending(h => h.CreatedAt)
            .Take(100)
            .Select(h => new SponsorOfferHistoryDto
            {
                Id = h.Id,
                TargetUserId = h.TargetUserId,
                TargetUserName = h.TargetUser != null
                    ? (h.TargetUser.FullName ?? h.TargetUser.UserName ?? "Ẩn danh")
                    : "Ẩn danh",
                PingId = h.PingId,
                PingStatus = h.Ping != null ? h.Ping.Status.ToString() : null,
                PingDetails = h.Ping != null ? h.Ping.Details : null,
                Message = h.Message,
                Status = h.Status.ToString(),
                CreatedAt = h.CreatedAt,
            })
            .ToListAsync();

        return Ok(offers);
    }

    [HttpGet("impact")]
    public async Task<ActionResult<SponsorImpactDto>> GetImpact()
    {
        var sponsorId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(sponsorId))
            return Unauthorized();

        var offers = await _db.HelpOffers
            .AsNoTracking()
            .Where(h => h.SponsorId == sponsorId)
            .Select(h => new { h.Status, h.TargetUserId })
            .ToListAsync();

        var response = new SponsorImpactDto
        {
            TotalOffers = offers.Count,
            PendingOffers = offers.Count(h => h.Status == HelpOfferStatus.Pending),
            AcceptedOffers = offers.Count(h => h.Status == HelpOfferStatus.Accepted),
            DeclinedOffers = offers.Count(h => h.Status == HelpOfferStatus.Declined),
            SupportedPeople = offers
                .Where(h => h.Status == HelpOfferStatus.Accepted)
                .Select(h => h.TargetUserId)
                .Distinct()
                .Count(),
        };

        return Ok(response);
    }

    [HttpPost("offer-help")]
    public async Task<ActionResult> OfferHelp([FromBody] OfferHelpDto dto)
    {
        var sponsorId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(sponsorId))
            return Unauthorized();

        var ping = await _db.Pings.FindAsync(dto.PingId);
        if (ping == null) return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy yêu cầu." });

        if (ping.Type != MapItemType.SOS)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Chỉ có thể gửi đề nghị hỗ trợ cho yêu cầu SOS." });

        if (ping.UserId == sponsorId)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Bạn không thể tự đề nghị hỗ trợ cho yêu cầu của chính mình." });

        if (ping.Status is SOSStatus.Resolved or SOSStatus.VerifiedSafe)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Yêu cầu này đã đóng, không thể gửi đề nghị hỗ trợ mới." });

        var existingOffer = await _db.HelpOffers
            .AsNoTracking()
            .AnyAsync(h => h.SponsorId == sponsorId && h.PingId == dto.PingId && h.Status == HelpOfferStatus.Pending);

        if (existingOffer)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Bạn đã gửi đề nghị hỗ trợ cho yêu cầu này rồi." });

        var message = string.IsNullOrWhiteSpace(dto.Message)
            ? "Sẵn sàng giúp đỡ"
            : dto.Message.Trim();

        var offer = new HelpOffer
        {
            SponsorId = sponsorId,
            TargetUserId = ping.UserId,
            PingId = ping.Id,
            Message = message,
            Status = HelpOfferStatus.Pending,
        };

        _db.HelpOffers.Add(offer);
        await _db.SaveChangesAsync();

        // Use centralized NotificationService instead of inline creation
        await _notifications.SendAsync(ping.UserId,
            $"Nhà tài trợ đã đề nghị hỗ trợ: {message}");

        return Ok(new { message = "Đã gửi đề nghị hỗ trợ.", offerId = offer.Id });
    }
}
