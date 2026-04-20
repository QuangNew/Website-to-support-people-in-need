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
[Route("api/person-in-need")]
[Authorize(Policy = "RequirePersonInNeed")]
public class PersonInNeedController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly INotificationService _notifications;

    public PersonInNeedController(AppDbContext db, INotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    [HttpGet("offers")]
    public async Task<ActionResult<IEnumerable<IncomingHelpOfferDto>>> GetOffers()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var offers = await _db.HelpOffers
            .AsNoTracking()
            .Where(h => h.TargetUserId == userId)
            .OrderByDescending(h => h.CreatedAt)
            .Take(100)
            .Select(h => new IncomingHelpOfferDto
            {
                Id = h.Id,
                SponsorId = h.SponsorId,
                SponsorName = h.Sponsor != null
                    ? (h.Sponsor.FullName ?? h.Sponsor.UserName ?? "Ẩn danh")
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

    [HttpPost("offers/{offerId:int}/respond")]
    public async Task<ActionResult> RespondToOffer(int offerId, [FromBody] RespondHelpOfferDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        if (!Enum.TryParse<HelpOfferStatus>(dto.Decision, true, out var decision)
            || decision == HelpOfferStatus.Pending)
        {
            return BadRequest(new ApiErrorResponse
            {
                StatusCode = 400,
                Message = "Phản hồi không hợp lệ. Chọn Accepted hoặc Declined."
            });
        }

        var offer = await _db.HelpOffers
            .AsTracking()
            .Include(h => h.Ping)
            .FirstOrDefaultAsync(h => h.Id == offerId && h.TargetUserId == userId);

        if (offer == null)
        {
            return NotFound(new ApiErrorResponse
            {
                StatusCode = 404,
                Message = "Không tìm thấy đề nghị hỗ trợ."
            });
        }

        if (offer.Status != HelpOfferStatus.Pending)
        {
            return BadRequest(new ApiErrorResponse
            {
                StatusCode = 400,
                Message = "Đề nghị này đã được phản hồi trước đó."
            });
        }

        if (decision == HelpOfferStatus.Accepted
            && offer.Ping != null
            && offer.Ping.Status is SOSStatus.Resolved or SOSStatus.VerifiedSafe)
        {
            return BadRequest(new ApiErrorResponse
            {
                StatusCode = 400,
                Message = "Không thể chấp nhận đề nghị cho yêu cầu SOS đã đóng."
            });
        }

        offer.Status = decision;
        await _db.SaveChangesAsync();

        var targetLabel = offer.PingId.HasValue ? $"SOS #{offer.PingId.Value}" : "yêu cầu hỗ trợ";
        var responseLabel = decision == HelpOfferStatus.Accepted ? "chấp nhận" : "từ chối";

        try
        {
            await _notifications.SendAsync(
                offer.SponsorId,
                $"Người cần hỗ trợ đã {responseLabel} đề nghị hỗ trợ của bạn cho {targetLabel}.");
        }
        catch
        {
        }

        return Ok(new
        {
            message = decision == HelpOfferStatus.Accepted
                ? "Đã chấp nhận đề nghị hỗ trợ."
                : "Đã từ chối đề nghị hỗ trợ.",
            status = decision.ToString()
        });
    }
}