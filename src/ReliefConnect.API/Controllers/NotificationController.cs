using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Notification endpoints — authenticated users can read and manage their own notifications.
/// All endpoints are scoped strictly to the calling user; no cross-user access is possible.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly INotificationRealtimeDispatcher _realtimeDispatcher;
    private readonly ILogger<NotificationController> _logger;

    public NotificationController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        INotificationRealtimeDispatcher realtimeDispatcher,
        ILogger<NotificationController> logger)
    {
        _db = db;
        _userManager = userManager;
        _realtimeDispatcher = realtimeDispatcher;
        _logger = logger;
    }

    private async Task PublishUnreadCountChangedAsync(string userId)
    {
        var unreadCount = await _db.Notifications
            .AsNoTracking()
            .CountAsync(n => n.UserId == userId && !n.IsRead);

        await _realtimeDispatcher.PublishUnreadCountChangedAsync(userId, unreadCount);
    }

    // ─────────────────────────────────────
    // GET /api/notification
    // ─────────────────────────────────────
    /// <summary>
    /// Get the current user's notifications, paginated and optionally filtered to unread only.
    /// Results are ordered newest-first.
    /// </summary>
    /// <param name="page">1-based page number (default: 1).</param>
    /// <param name="pageSize">Items per page, capped at 100 (default: 20).</param>
    /// <param name="unreadOnly">When true, only unread notifications are returned (default: false).</param>
    [HttpGet]
    public async Task<ActionResult> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool unreadOnly = false)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > 100) pageSize = 100;

        var query = _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId);

        if (unreadOnly)
            query = query.Where(n => !n.IsRead);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                n.Id,
                n.MessageText,
                n.IsRead,
                n.CreatedAt,
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
        });
    }

    // ─────────────────────────────────────
    // GET /api/notification/unread-count
    // ─────────────────────────────────────
    /// <summary>
    /// Get the number of unread notifications for the current user.
    /// Uses a lightweight indexed COUNT — no caching to ensure per-user correctness.
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<ActionResult> GetUnreadCount()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var count = await _db.Notifications
            .AsNoTracking()
            .CountAsync(n => n.UserId == userId && !n.IsRead);

        return Ok(new { count });
    }

    // ─────────────────────────────────────
    // PUT /api/notification/{id}/read
    // ─────────────────────────────────────
    /// <summary>
    /// Mark a single notification as read.
    /// Returns 404 if the notification does not exist, 403 if it belongs to another user.
    /// </summary>
    /// <param name="id">Notification ID.</param>
    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Fetch without tracking first to verify existence and ownership
        var notification = await _db.Notifications
            .AsNoTracking()
            .Where(n => n.Id == id)
            .Select(n => new { n.Id, n.UserId, n.IsRead })
            .FirstOrDefaultAsync();

        if (notification == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Thông báo không tồn tại." });

        if (notification.UserId != userId)
            return Forbid();

        // Already read — no-op, still return 204 for idempotency
        if (notification.IsRead)
            return NoContent();

        var rowsAffected = await _db.Notifications
            .Where(n => n.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        if (rowsAffected > 0)
            await PublishUnreadCountChangedAsync(userId);

        _logger.LogInformation("Notification {NotificationId} marked as read by user {UserId}", id, userId);

        return NoContent();
    }

    // ─────────────────────────────────────
    // PUT /api/notification/read-all
    // ─────────────────────────────────────
    /// <summary>
    /// Mark all of the current user's unread notifications as read in a single operation.
    /// Returns 204 NoContent; the number of updated rows is logged server-side.
    /// </summary>
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var rowsAffected = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        await PublishUnreadCountChangedAsync(userId);

        _logger.LogInformation(
            "All notifications marked as read for user {UserId} — {Count} updated",
            userId, rowsAffected);

        return NoContent();
    }

    // ─────────────────────────────────────
    // DELETE /api/notification/{id}
    // ─────────────────────────────────────
    /// <summary>
    /// Delete a single notification permanently.
    /// Returns 404 if the notification does not exist, 403 if it belongs to another user.
    /// </summary>
    /// <param name="id">Notification ID.</param>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteNotification(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        // Verify existence and ownership before deleting
        var notification = await _db.Notifications
            .AsNoTracking()
            .Where(n => n.Id == id)
            .Select(n => new { n.Id, n.UserId })
            .FirstOrDefaultAsync();

        if (notification == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Thông báo không tồn tại." });

        if (notification.UserId != userId)
            return Forbid();

        await _db.Notifications
            .Where(n => n.Id == id)
            .ExecuteDeleteAsync();

        await PublishUnreadCountChangedAsync(userId);

        _logger.LogInformation("Notification {NotificationId} deleted by user {UserId}", id, userId);

        return NoContent();
    }
}
