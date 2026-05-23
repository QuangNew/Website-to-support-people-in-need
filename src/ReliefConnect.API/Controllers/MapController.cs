using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;
using ReliefConnect.API.Extensions;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

/// <summary>
/// Map controller for relief ping CRUD and spatial queries.
/// Sprint 2 — REQ-MAP-01 through REQ-MAP-05.
/// Uses OpenStreetMap (Leaflet) on frontend; no server-side map API key needed.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class MapController : ControllerBase
{
    private readonly IPingRepository _pingRepo;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly INotificationService _notifications;
    private readonly ILogger<MapController> _logger;
    private readonly ISpamGuardService _spamGuard;
    private readonly AppDbContext _db;
    private readonly IServiceScopeFactory _scopeFactory;

    public MapController(
        IPingRepository pingRepo,
        UserManager<ApplicationUser> userManager,
        INotificationService notifications,
        ILogger<MapController> logger,
        ISpamGuardService spamGuard,
        AppDbContext db,
        IServiceScopeFactory scopeFactory)
    {
        _pingRepo = pingRepo;
        _userManager = userManager;
        _notifications = notifications;
        _logger = logger;
        _spamGuard = spamGuard;
        _db = db;
        _scopeFactory = scopeFactory;
    }

    // ─────────────────────────────────────
    // GET /api/map/pings
    // ─────────────────────────────────────
    /// <summary>
    /// Get all pings, optionally filtered by radius from a center point.
    /// Public endpoint — guests can view the map.
    /// </summary>
    [HttpGet("pings")]
    public async Task<ActionResult<IEnumerable<PingResponseDto>>> GetPings(
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] double? radiusKm)
    {
        var includeSensitiveContact = CanViewSensitivePingContact(GetViewerRole());
        IEnumerable<Ping> pings;

        if (lat.HasValue && lng.HasValue && radiusKm.HasValue)
        {
            // Validate coordinates
            if (lat.Value < -90 || lat.Value > 90 || lng.Value < -180 || lng.Value > 180)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Invalid coordinates." });

            if (radiusKm.Value < 0 || radiusKm.Value > 10000)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Radius must be between 0 and 10000 km." });

            pings = await _pingRepo.GetPingsInRadiusAsync(lat.Value, lng.Value, radiusKm.Value);
        }
        else
        {
            // Limit to 500 most recent pings for performance
            pings = await _pingRepo.GetAllAsync(limit: 500);
        }

        return Ok(pings.Select(ping => MapPingToDto(ping, includeSensitiveContact)));
    }

    // ─────────────────────────────────────
    // GET /api/map/pings/{id}
    // ─────────────────────────────────────
    [HttpGet("pings/{id:int}")]
    public async Task<ActionResult<PingResponseDto>> GetPingById(int id)
    {
        var ping = await _pingRepo.GetPingWithFlagAsync(id);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        var viewerUserId = GetViewerUserId();
        var viewerState = await MarkPingViewedAsync(ping, viewerUserId);

        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole()), viewerState, viewerUserId));
    }

    // ─────────────────────────────────────
    // POST /api/map/pings
    // ─────────────────────────────────────
    /// <summary>
    /// Create a new ping on the map.
    /// Any authenticated user can create SOS pings.
    /// </summary>
    [HttpPost("pings")]
    [Authorize]
    public async Task<ActionResult<PingResponseDto>> CreatePing([FromBody] CreatePingDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var currentUser = await _userManager.Users
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                DisplayName = u.FullName ?? u.UserName,
                u.UserName,
                u.Email,
                u.Role,
            })
            .FirstOrDefaultAsync();
        if (currentUser == null)
            return Unauthorized();

        // ── Spam Guard ──
        var spamCheck = await _spamGuard.CheckPingAsync(userId);
        if (spamCheck.Verdict == SpamVerdict.Suspend)
        {
            await _spamGuard.SuspendForSpamAsync(userId, "Tạo SOS quá nhiều (>4 lần/giờ)");
            return StatusCode(429, new ApiErrorResponse { StatusCode = 429, Message = "Tài khoản của bạn đã bị tạm khóa do tạo SOS quá nhiều." });
        }

        if (!Enum.TryParse<MapItemType>(dto.Type, true, out var mapType))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Loại ping không hợp lệ. Chấp nhận: SOS, Supply, Shelter." });

        // Supply and Shelter pings are admin-only
        if (mapType is MapItemType.Supply or MapItemType.Shelter && currentUser.Role != RoleEnum.Admin)
            return Forbid();

        // Validate coordinates within Vietnam territory (bounding box + island zones)
        if (!IsInsideVietnamTerritory(dto.Lat, dto.Lng))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vị trí nằm ngoài lãnh thổ Việt Nam." });

        string? contactName = null;
        string? contactPhone = null;
        string? conditionImageUrl = string.IsNullOrWhiteSpace(dto.ConditionImageUrl)
            ? null
            : dto.ConditionImageUrl.Trim();

        if (mapType == MapItemType.SOS)
        {
            contactName = dto.ContactName?.Trim();
            if (string.IsNullOrWhiteSpace(contactName))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vui lòng nhập tên thật để gửi SOS." });

            contactPhone = dto.ContactPhone?.Trim();
            if (string.IsNullOrWhiteSpace(contactPhone))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Vui lòng nhập số điện thoại để gửi SOS." });

            if (!IsValidContactPhone(contactPhone))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Số điện thoại không hợp lệ." });

            if (conditionImageUrl != null && !IsAllowedConditionImageUrl(conditionImageUrl))
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Ảnh tình trạng không hợp lệ." });
        }
        else if (conditionImageUrl != null)
        {
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Ảnh tình trạng chỉ hỗ trợ cho SOS." });
        }

        var ping = new Ping
        {
            CoordinatesLat = dto.Lat,
            CoordinatesLong = dto.Lng,
            Type = mapType,
            Status = mapType == MapItemType.SOS ? SOSStatus.Pending : SOSStatus.Resolved,
            Details = dto.Details,
            ContactName = contactName,
            ContactPhone = contactPhone,
            ConditionImageUrl = conditionImageUrl,
            SOSCategory = mapType == MapItemType.SOS && !string.IsNullOrEmpty(dto.SOSCategory)
                ? Enum.TryParse<Core.Enums.SOSCategory>(dto.SOSCategory, true, out var cat) ? cat : Core.Enums.SOSCategory.Other
                : null,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
        };

        var created = await _pingRepo.AddAsync(ping);
        _logger.LogInformation("Ping created: Id={PingId}, Type={Type}, User={UserId}", created.Id, dto.Type, userId);
        await this.LogUserActivity(_db, "PingCreated", $"Created {created.Type} ping #{created.Id}; ping={created.Id}; status={created.Status}", userId, currentUser.DisplayName ?? currentUser.UserName);

        // Notify all active users about new map pings.
        var notificationMessage = ping.Type == MapItemType.SOS
            ? $"SOS mới từ {contactName}: {(ping.Details?.Length > 100 ? ping.Details[..100] + "…" : ping.Details ?? "Không có chi tiết")}"
            : $"Ping mới ({ping.Type}) #{created.Id}: {(ping.Details?.Length > 100 ? ping.Details[..100] + "…" : ping.Details ?? "Không có chi tiết")}";
        try
        {
            var targetUserIds = await _db.Users
                .AsNoTracking()
                .Where(u => !u.IsSuspended)
                .Select(u => u.Id)
                .ToListAsync();

            QueueSystemNotification(targetUserIds, notificationMessage, created.Id);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to queue system-wide notification for ping {PingId}", created.Id);
        }

        var includeSensitiveContact = CanViewSensitivePingContact(currentUser.Role);

        var responseDto = MapPingToDto(created, includeSensitiveContact, viewerUserId: userId);
        responseDto.UserName = contactName ?? currentUser.DisplayName;
        responseDto.ContactName = contactName ?? currentUser.DisplayName;
        responseDto.ContactPhone = includeSensitiveContact ? contactPhone : null;
        responseDto.ContactEmail = includeSensitiveContact ? currentUser.Email : null;

        if (spamCheck.Verdict == SpamVerdict.Warning)
            return CreatedAtAction(nameof(GetPingById), new { id = created.Id }, new { ping = responseDto, spamWarning = spamCheck.WarningMessage });

        return CreatedAtAction(nameof(GetPingById), new { id = created.Id }, responseDto);
    }

    // ─────────────────────────────────────
    // PUT /api/map/pings/{id}/status
    // ─────────────────────────────────────
    /// <summary>
    /// Update ping status (e.g., Volunteer marks as InProgress or Resolved).
    /// </summary>
    [HttpPut("pings/{id:int}/status")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<ActionResult<PingResponseDto>> UpdatePingStatus(int id, [FromBody] UpdatePingStatusDto dto)
    {
        var ping = await _pingRepo.GetPingWithFlagForUpdateAsync(id);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        if (ping.Type != MapItemType.SOS)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Chỉ có thể cập nhật trạng thái của điểm SOS." });

        if (!Enum.TryParse<SOSStatus>(dto.Status, true, out var newStatus))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Trạng thái không hợp lệ. Chấp nhận: Pending, InProgress, Resolved, VerifiedSafe." });

        var oldStatus = ping.Status;
        ping.Status = newStatus;

        // If resolved/safe, stop blinking
        if (newStatus is SOSStatus.Resolved or SOSStatus.VerifiedSafe && ping.PingFlag != null)
        {
            ping.PingFlag.IsBlinking = false;
        }

        await _pingRepo.UpdateAsync(ping);
        _logger.LogInformation("Ping {PingId} status updated to {Status}", id, dto.Status);
        await this.LogUserActivity(_db, "PingStatusUpdated", $"Updated ping #{id} status {oldStatus} -> {newStatus}; ping={id}; target={ping.UserId}");

        // Notify ping owner about status change
        try
        {
            await _notifications.SendAsync(ping.UserId,
                $"Trạng thái SOS của bạn đã được cập nhật: {newStatus}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send owner notification for ping {PingId}", id);
        }

        var viewerUserId = GetViewerUserId();
        var viewerState = await LoadViewerPingStateAsync(viewerUserId, ping.Id);
        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole()), viewerState, viewerUserId));
    }

    // ─────────────────────────────────────
    // POST /api/map/pings/{id}/confirm-safe
    // ─────────────────────────────────────
    /// <summary>
    /// PersonInNeed confirms their own safety (REQ-MAP-05).
    /// </summary>
    [HttpPost("pings/{id:int}/confirm-safe")]
    [Authorize(Policy = "RequirePersonInNeed")]
    public async Task<ActionResult<PingResponseDto>> ConfirmSafe(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var ping = await _pingRepo.GetPingWithFlagForUpdateAsync(id);

        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        if (ping.UserId != userId)
            return Forbid();

        ping.Status = SOSStatus.VerifiedSafe;
        if (ping.PingFlag != null)
            ping.PingFlag.IsBlinking = false;

        await _pingRepo.UpdateAsync(ping);
        _logger.LogInformation("Ping {PingId} confirmed safe by user {UserId}", id, userId);
        await this.LogUserActivity(_db, "PingConfirmedSafe", $"Confirmed safe for ping #{id}; ping={id}", userId);

        // Notify volunteers that user confirmed safe
        try
        {
            await _notifications.SendToRoleAsync((int)Core.Enums.RoleEnum.Volunteer,
                $"Người dùng đã xác nhận an toàn cho SOS #{id}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send volunteer safe-confirmation notification for ping {PingId}", id);
        }

        var viewerState = await LoadViewerPingStateAsync(userId, ping.Id);
        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole()), viewerState, userId));
    }

    // ─────────────────────────────────────
    // GET /api/map/pings/user/{userId}
    // ─────────────────────────────────────
    [HttpGet("pings/user/{userId}")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<PingResponseDto>>> GetPingsByUser(string userId)
    {
        var pings = await _pingRepo.GetPingsByUserAsync(userId);
        var includeSensitiveContact = CanViewSensitivePingContact(GetViewerRole());
        return Ok(pings.Select(ping => MapPingToDto(ping, includeSensitiveContact)));
    }

    // ─────────────────────────────────────
    // POST /api/map/pings/attention
    // ─────────────────────────────────────
    [HttpPost("pings/attention")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<PingAttentionDto>>> GetPingAttention([FromBody] PingAttentionRequestDto? dto)
    {
        var viewerUserId = GetViewerUserId();
        if (string.IsNullOrEmpty(viewerUserId))
            return Unauthorized();

        var ids = (dto?.PingIds ?? new List<int>())
            .Where(id => id > 0)
            .Distinct()
            .Take(500)
            .ToList();

        if (ids.Count == 0)
            return Ok(Array.Empty<PingAttentionDto>());

        var pings = await _db.Pings
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.Type,
                p.Status,
                p.UserId,
            })
            .ToListAsync();

        var viewerStates = await LoadViewerPingStatesAsync(viewerUserId, ids);
        var attention = pings.Select(ping =>
        {
            viewerStates.TryGetValue(ping.Id, out var viewerState);
            var isNewForViewer = IsNewForViewer(ping.Type, ping.Status, ping.UserId, viewerState, viewerUserId);
            var isPinnedForViewer = viewerState?.IsPinned == true;

            return new PingAttentionDto
            {
                PingId = ping.Id,
                IsNewForViewer = isNewForViewer,
                IsPinnedForViewer = isPinnedForViewer,
                RequiresViewerAttention = isNewForViewer || isPinnedForViewer,
                ViewedAt = viewerState?.ViewedAt,
                PinnedAt = viewerState?.PinnedAt,
            };
        });

        return Ok(attention);
    }

    // ─────────────────────────────────────
    // PUT /api/map/pings/{id}/pin
    // ─────────────────────────────────────
    [HttpPut("pings/{id:int}/pin")]
    [Authorize]
    public async Task<ActionResult<PingResponseDto>> PinPing(int id)
    {
        var viewerUserId = GetViewerUserId();
        if (string.IsNullOrEmpty(viewerUserId))
            return Unauthorized();

        var ping = await _pingRepo.GetPingWithFlagAsync(id);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        if (ping.Type != MapItemType.SOS)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Chỉ có thể ghim ping SOS." });

        var now = DateTime.UtcNow;
        var state = await _db.PingUserStates
            .FirstOrDefaultAsync(s => s.UserId == viewerUserId && s.PingId == id);

        if (state?.IsPinned != true)
        {
            var pinnedCount = await _db.PingUserStates
                .AsNoTracking()
                .CountAsync(s => s.UserId == viewerUserId && s.IsPinned);

            if (pinnedCount >= 5)
            {
                return BadRequest(new ApiErrorResponse
                {
                    StatusCode = 400,
                    Message = "Bạn chỉ có thể ghim tối đa 5 ping SOS cùng lúc.",
                });
            }

            if (state == null)
            {
                state = new PingUserState
                {
                    PingId = id,
                    UserId = viewerUserId,
                    CreatedAt = now,
                };
                _db.PingUserStates.Add(state);
            }

            state.IsPinned = true;
            state.PinnedAt = now;
            state.ViewedAt ??= now;
            state.UpdatedAt = now;
            await _db.SaveChangesAsync();
        }

        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole()), state, viewerUserId));
    }

    // ─────────────────────────────────────
    // DELETE /api/map/pings/{id}/pin
    // ─────────────────────────────────────
    [HttpDelete("pings/{id:int}/pin")]
    [Authorize]
    public async Task<ActionResult<PingResponseDto>> UnpinPing(int id)
    {
        var viewerUserId = GetViewerUserId();
        if (string.IsNullOrEmpty(viewerUserId))
            return Unauthorized();

        var ping = await _pingRepo.GetPingWithFlagAsync(id);
        if (ping == null)
            return NotFound(new ApiErrorResponse { StatusCode = 404, Message = "Không tìm thấy điểm cứu trợ." });

        var state = await _db.PingUserStates
            .FirstOrDefaultAsync(s => s.UserId == viewerUserId && s.PingId == id);

        if (state != null)
        {
            state.IsPinned = false;
            state.PinnedAt = null;
            state.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(MapPingToDto(ping, CanViewSensitivePingContact(GetViewerRole()), state, viewerUserId));
    }

    // ─────────────────────────────────────
    // DELETE /api/map/pings/{id}
    // ─────────────────────────────────────
    [HttpDelete("pings/{id:int}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> DeletePing(int id)
    {
        var ping = await _pingRepo.GetByIdAsync(id);
        if (ping == null)
            return NotFound();

        await _pingRepo.DeleteAsync(id);
        _logger.LogInformation("Ping {PingId} deleted by admin", id);
        await this.LogUserActivity(_db, "PingDeleted", $"Deleted ping #{id}; ping={id}; target={ping.UserId}");
        return NoContent();
    }

    private void QueueSystemNotification(IReadOnlyCollection<string> targetUserIds, string message, int pingId)
    {
        if (targetUserIds.Count == 0)
            return;

        _ = Task.Run(async () =>
        {
            using var scope = _scopeFactory.CreateScope();
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<MapController>>();

            try
            {
                await notifications.SendToManyAsync(targetUserIds, message);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to send system-wide notification for ping {PingId}", pingId);
            }
        });
    }

    // ─── DTO Mapping ───
    private async Task<Dictionary<int, PingUserState>> LoadViewerPingStatesAsync(string? viewerUserId, IEnumerable<int> pingIds)
    {
        if (string.IsNullOrEmpty(viewerUserId))
            return new Dictionary<int, PingUserState>();

        var ids = pingIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<int, PingUserState>();

        return await _db.PingUserStates
            .AsNoTracking()
            .Where(s => s.UserId == viewerUserId && ids.Contains(s.PingId))
            .ToDictionaryAsync(s => s.PingId);
    }

    private async Task<PingUserState?> LoadViewerPingStateAsync(string? viewerUserId, int pingId)
    {
        if (string.IsNullOrEmpty(viewerUserId))
            return null;

        return await _db.PingUserStates
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == viewerUserId && s.PingId == pingId);
    }

    private async Task<PingUserState?> MarkPingViewedAsync(Ping ping, string? viewerUserId)
    {
        if (string.IsNullOrEmpty(viewerUserId) || ping.Type != MapItemType.SOS)
            return await LoadViewerPingStateAsync(viewerUserId, ping.Id);

        var now = DateTime.UtcNow;
        var state = await _db.PingUserStates
            .FirstOrDefaultAsync(s => s.UserId == viewerUserId && s.PingId == ping.Id);

        if (state == null)
        {
            state = new PingUserState
            {
                PingId = ping.Id,
                UserId = viewerUserId,
                ViewedAt = now,
                CreatedAt = now,
                UpdatedAt = now,
            };
            _db.PingUserStates.Add(state);
        }
        else if (state.ViewedAt == null)
        {
            state.ViewedAt = now;
            state.UpdatedAt = now;
        }

        await _db.SaveChangesAsync();
        return state;
    }

    private static bool IsNewForViewer(Ping ping, PingUserState? viewerState, string? viewerUserId)
    {
        return IsNewForViewer(ping.Type, ping.Status, ping.UserId, viewerState, viewerUserId);
    }

    private static bool IsNewForViewer(
        MapItemType pingType,
        SOSStatus pingStatus,
        string pingOwnerId,
        PingUserState? viewerState,
        string? viewerUserId)
    {
        return !string.IsNullOrEmpty(viewerUserId)
            && pingType == MapItemType.SOS
            && pingStatus is SOSStatus.Pending or SOSStatus.InProgress
            && pingOwnerId != viewerUserId
            && viewerState?.ViewedAt == null;
    }

    private static PingResponseDto MapPingToDto(
        Ping ping,
        bool includeSensitiveContact,
        PingUserState? viewerState = null,
        string? viewerUserId = null)
    {
        var isNewForViewer = IsNewForViewer(ping, viewerState, viewerUserId);
        var isPinnedForViewer = viewerState?.IsPinned == true;

        return new PingResponseDto
        {
            Id = ping.Id,
            Lat = ping.CoordinatesLat,
            Lng = ping.CoordinatesLong,
            Type = ping.Type.ToString(),
            Status = ping.Status.ToString(),
            PriorityLevel = ping.PriorityLevel,
            Details = ping.Details,
            SOSCategory = ping.SOSCategory?.ToString()?.ToLowerInvariant(),
            CreatedAt = ping.CreatedAt,
            UserId = ping.UserId,
            UserName = ping.ContactName ?? ping.User?.FullName ?? ping.User?.UserName,
            ContactName = ping.ContactName ?? ping.User?.FullName ?? ping.User?.UserName,
            ContactPhone = includeSensitiveContact ? ping.ContactPhone ?? ping.User?.PhoneNumber : null,
            ContactEmail = includeSensitiveContact ? ping.User?.Email : null,
            ConditionImageUrl = ping.ConditionImageUrl,
            IsBlinking = ping.PingFlag?.IsBlinking ?? false,
            IsNewForViewer = isNewForViewer,
            IsPinnedForViewer = isPinnedForViewer,
            RequiresViewerAttention = isNewForViewer || isPinnedForViewer,
            ViewedAt = viewerState?.ViewedAt,
            PinnedAt = viewerState?.PinnedAt,
            AvatarUrl = ping.User?.AvatarUrl,
        };
    }

    private RoleEnum? GetViewerRole()
    {
        if (User.Identity?.IsAuthenticated != true)
            return null;

        var roleValue = User.FindFirstValue("Role") ?? User.FindFirstValue(ClaimTypes.Role);
        return Enum.TryParse<RoleEnum>(roleValue, true, out var role)
            ? role
            : null;
    }

    private string? GetViewerUserId()
    {
        return User.Identity?.IsAuthenticated == true
            ? User.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;
    }

    private static bool CanViewSensitivePingContact(RoleEnum? viewerRole)
    {
        return viewerRole.HasValue
            && viewerRole.Value != RoleEnum.Guest
            && viewerRole.Value != RoleEnum.PersonInNeed;
    }

    private static bool IsValidContactPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length is >= 8 and <= 15;
    }

    private static bool IsAllowedConditionImageUrl(string imageUrl)
    {
        if (imageUrl.Length > 500)
            return false;

        if (imageUrl.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri))
            return false;

        return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
    }

    // ─── Vietnam territory validation ───
    private static bool IsInsideVietnamTerritory(double lat, double lng)
    {
        // Quick bounding-box rejection
        if (lat < 5.78 || lat > 23.39 || lng < 102.15 || lng > 117.72)
            return false;

        // Mainland bounding box (rough)
        if (lat >= 8.0 && lat <= 23.39 && lng >= 102.15 && lng <= 110.0)
            return true; // Western mainland

        // Check island zones
        // Paracel Islands (Hoang Sa)
        if (lat >= 15.48 && lat <= 17.37 && lng >= 110.78 && lng <= 113.12)
            return true;
        // Spratly Islands (Truong Sa)
        if (lat >= 5.78 && lat <= 12.20 && lng >= 109.28 && lng <= 117.72)
            return true;
        // Con Dao Islands
        if (lat >= 8.33 && lat <= 9.07 && lng >= 106.28 && lng <= 106.97)
            return true;
        // Phu Quoc Island
        if (lat >= 9.68 && lat <= 10.72 && lng >= 103.48 && lng <= 104.42)
            return true;

        // Eastern coast mainland (simplified: up to ~110°E at the widest)
        if (lat >= 8.0 && lat <= 23.39 && lng >= 102.15 && lng <= 110.0)
            return true;
        // Central/South coast extends slightly east
        if (lat >= 10.0 && lat <= 21.5 && lng >= 106.0 && lng <= 109.6)
            return true;

        return false;
    }
}
