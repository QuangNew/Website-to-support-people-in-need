using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DonationController : ControllerBase
{
    private const int MaxHistory = 1000;
    private static readonly TimeSpan RetentionPeriod = TimeSpan.FromDays(90); // 3 months

    private readonly AppDbContext _db;
    private readonly IPayOSService _payos;
    private readonly IConfiguration _config;

    public DonationController(AppDbContext db, IPayOSService payos, IConfiguration config)
    {
        _db = db;
        _payos = payos;
        _config = config;
    }

    // ─── GET /api/donation/history ─────────────────────────────
    /// <summary>
    /// Returns paid donation history (newest first).
    /// Max 1000 rows, limited to donations from the last 3 months.
    /// Public endpoint — no auth required.
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult> GetHistory()
    {
        var cutoff = DateTime.UtcNow - RetentionPeriod;

        var items = await _db.DonationRecords
            .Where(d => d.Status == DonationStatus.Paid && d.PaidAt >= cutoff)
            .OrderByDescending(d => d.PaidAt)
            .Take(MaxHistory)
            .Select(d => new
            {
                d.Id,
                d.DisplayName,
                d.MaskedPhone,
                AvatarUrl = d.User == null ? null : d.User.AvatarUrl,
                d.Amount,
                d.Message,
                d.PaidAt,
            })
            .ToListAsync();

        return Ok(items);
    }

    // ─── POST /api/donation/create ─────────────────────────────
    /// <summary>
    /// Creates a PayOS payment link for the authenticated user.
    /// Returns: orderCode, qrCode, checkoutUrl.
    /// </summary>
    [HttpPost("create")]
    [Authorize]
    public async Task<ActionResult> CreateDonation([FromBody] CreateDonationDto dto)
    {
        if (dto.Amount < 2000 || dto.Amount > 50_000_000)
            return BadRequest(new { message = "Số tiền ủng hộ phải từ 2.000đ đến 50.000.000đ." });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _db.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.FullName, u.Email, u.PhoneNumber })
            .FirstOrDefaultAsync();

        if (user == null) return Unauthorized();

        // Build display info
        var displayName = string.IsNullOrWhiteSpace(user.FullName) ? "Ẩn danh" : user.FullName;
        var maskedPhone = MaskPhone(user.PhoneNumber);

        // Generate unique orderCode: unix ms truncated to fit in int64 safely
        var orderCode = GenerateOrderCode();

        // PayOS description limit: ≤ 9 chars for max bank compatibility
        var description = "UNGHO";

        var frontendUrl = _config["Frontend:Urls:0"]
                         ?? _config.GetSection("Frontend:Urls").GetChildren().FirstOrDefault()?.Value
                         ?? "http://localhost:5173";
        var cancelUrl = $"{frontendUrl}/donate?status=cancelled";
        var returnUrl = $"{frontendUrl}/donate?status=success";

        PayOSCreateResult result;
        try
        {
            result = await _payos.CreatePaymentLinkAsync(
                orderCode, dto.Amount, description,
                displayName, user.Email,
                cancelUrl, returnUrl);
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { message = "Không thể kết nối PayOS. Vui lòng thử lại sau.", detail = ex.Message });
        }

        // Save pending record
        var record = new DonationRecord
        {
            OrderCode = orderCode,
            PaymentLinkId = result.PaymentLinkId,
            UserId = userId,
            DisplayName = displayName,
            MaskedPhone = maskedPhone,
            Amount = dto.Amount,
            Message = dto.Message?.Trim().Length > 200 ? dto.Message.Trim()[..200] : dto.Message?.Trim(),
            Status = DonationStatus.Pending,
        };
        _db.DonationRecords.Add(record);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            orderCode,
            qrCode = result.QrCode,
            checkoutUrl = result.CheckoutUrl,
            paymentLinkId = result.PaymentLinkId,
        });
    }

    // ─── GET /api/donation/status/{orderCode} ──────────────────
    /// <summary>
    /// Polls the status of a pending donation. Public.
    /// </summary>
    [HttpGet("status/{orderCode:long}")]
    public async Task<ActionResult> GetStatus(long orderCode)
    {
        var record = await _db.DonationRecords
            .FirstOrDefaultAsync(d => d.OrderCode == orderCode);

        if (record == null) return NotFound();

        if (record.Status == DonationStatus.Pending)
        {
            await TrySyncRemoteStatusAsync(record);
        }

        return Ok(new { status = record.Status.ToString(), paidAt = record.PaidAt });
    }

    // ─── POST /api/donation/webhook ────────────────────────────
    /// <summary>
    /// PayOS webhook endpoint. No auth — uses HMAC signature verification.
    /// Must return HTTP 200 to acknowledge receipt.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> Webhook([FromBody] JsonElement body)
    {
        // Parse the webhook body
        WebhookPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<WebhookPayload>(body.GetRawText(),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return BadRequest();
        }

        if (payload?.Data == null) return BadRequest();

        // Verify signature
        var dataDict = BuildDataDict(payload.Data);
        if (!_payos.VerifyWebhookSignature(dataDict, payload.Signature ?? ""))
        {
            return Unauthorized(new { message = "Invalid signature" });
        }

        // Only process success (code "00")
        if (payload.Code != "00" || !payload.Success) return Ok();

        var orderCode = payload.Data.OrderCode;
        var record = await _db.DonationRecords
            .FirstOrDefaultAsync(d => d.OrderCode == orderCode);

        if (record == null || record.Status == DonationStatus.Paid) return Ok();

        record.Status = DonationStatus.Paid;
        record.PaidAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Prune old records (> 3 months or > 1000 paid)
        await PruneOldDonations();

        return Ok();
    }

    // ─── Helpers ───────────────────────────────────────────────

    private async Task PruneOldDonations()
    {
        var cutoff = DateTime.UtcNow - RetentionPeriod;

        // Delete paid records older than 3 months
        await _db.DonationRecords
            .Where(d => d.Status == DonationStatus.Paid && d.PaidAt < cutoff)
            .ExecuteDeleteAsync();

        // Keep only the newest 1000 paid records
        var totalPaid = await _db.DonationRecords.CountAsync(d => d.Status == DonationStatus.Paid);
        if (totalPaid > MaxHistory)
        {
            var toDeleteCount = totalPaid - MaxHistory;
            var idsToDelete = await _db.DonationRecords
                .Where(d => d.Status == DonationStatus.Paid)
                .OrderBy(d => d.PaidAt)
                .Take(toDeleteCount)
                .Select(d => d.Id)
                .ToListAsync();

            await _db.DonationRecords
                .Where(d => idsToDelete.Contains(d.Id))
                .ExecuteDeleteAsync();
        }

        // Delete Pending records older than 30 minutes (abandoned)
        var pendingCutoff = DateTime.UtcNow.AddMinutes(-30);
        await _db.DonationRecords
            .Where(d => d.Status == DonationStatus.Pending && d.CreatedAt < pendingCutoff)
            .ExecuteDeleteAsync();
    }

    private async Task TrySyncRemoteStatusAsync(DonationRecord record)
    {
        PayOSPaymentStatusResult remoteStatus;
        try
        {
            remoteStatus = await _payos.GetPaymentStatusAsync(record.OrderCode);
        }
        catch
        {
            return;
        }

        if (!TryMapRemoteStatus(remoteStatus.Status, out var mappedStatus) || mappedStatus == record.Status)
        {
            return;
        }

        record.Status = mappedStatus;
        if (mappedStatus == DonationStatus.Paid && record.PaidAt == null)
        {
            record.PaidAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        if (mappedStatus == DonationStatus.Paid)
        {
            await PruneOldDonations();
        }
    }

    private static bool TryMapRemoteStatus(string? status, out DonationStatus mappedStatus)
    {
        switch (status?.Trim().ToUpperInvariant())
        {
            case "PAID":
                mappedStatus = DonationStatus.Paid;
                return true;
            case "CANCELLED":
            case "CANCELED":
            case "EXPIRED":
                mappedStatus = DonationStatus.Cancelled;
                return true;
            case "PENDING":
                mappedStatus = DonationStatus.Pending;
                return true;
            default:
                mappedStatus = DonationStatus.Pending;
                return false;
        }
    }

    private static long GenerateOrderCode()
    {
        // Use current unix ms % a large prime to stay within safe integer range
        // Add random component to reduce collision
        var ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var rand = Random.Shared.Next(100, 999);
        return (ms % 10_000_000_000L) * 1000 + rand;
    }

    private static string? MaskPhone(string? phone)
    {
        if (string.IsNullOrEmpty(phone) || phone.Length < 6) return phone;
        var first = phone[..3];
        var last = phone[^2..];
        var mid = new string('x', phone.Length - 5);
        return $"{first}{mid}{last}";
    }

    private static Dictionary<string, object?> BuildDataDict(WebhookData d) => new()
    {
        ["orderCode"] = d.OrderCode.ToString(),
        ["amount"] = d.Amount.ToString(),
        ["description"] = d.Description,
        ["accountNumber"] = d.AccountNumber,
        ["reference"] = d.Reference,
        ["transactionDateTime"] = d.TransactionDateTime,
        ["currency"] = d.Currency,
        ["paymentLinkId"] = d.PaymentLinkId,
        ["code"] = d.Code,
        ["desc"] = d.Desc,
        ["counterAccountBankId"] = d.CounterAccountBankId,
        ["counterAccountBankName"] = d.CounterAccountBankName,
        ["counterAccountName"] = d.CounterAccountName,
        ["counterAccountNumber"] = d.CounterAccountNumber,
        ["virtualAccountName"] = d.VirtualAccountName,
        ["virtualAccountNumber"] = d.VirtualAccountNumber,
    };

    // ─── Internal DTOs ─────────────────────────────────────────

    private sealed class WebhookPayload
    {
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("desc")] public string? Desc { get; set; }
        [JsonPropertyName("success")] public bool Success { get; set; }
        [JsonPropertyName("data")] public WebhookData? Data { get; set; }
        [JsonPropertyName("signature")] public string? Signature { get; set; }
    }

    private sealed class WebhookData
    {
        [JsonPropertyName("orderCode")] public long OrderCode { get; set; }
        [JsonPropertyName("amount")] public long Amount { get; set; }
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("accountNumber")] public string? AccountNumber { get; set; }
        [JsonPropertyName("reference")] public string? Reference { get; set; }
        [JsonPropertyName("transactionDateTime")] public string? TransactionDateTime { get; set; }
        [JsonPropertyName("currency")] public string? Currency { get; set; }
        [JsonPropertyName("paymentLinkId")] public string? PaymentLinkId { get; set; }
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("desc")] public string? Desc { get; set; }
        [JsonPropertyName("counterAccountBankId")] public string? CounterAccountBankId { get; set; }
        [JsonPropertyName("counterAccountBankName")] public string? CounterAccountBankName { get; set; }
        [JsonPropertyName("counterAccountName")] public string? CounterAccountName { get; set; }
        [JsonPropertyName("counterAccountNumber")] public string? CounterAccountNumber { get; set; }
        [JsonPropertyName("virtualAccountName")] public string? VirtualAccountName { get; set; }
        [JsonPropertyName("virtualAccountNumber")] public string? VirtualAccountNumber { get; set; }
    }
}

public sealed class CreateDonationDto
{
    public long Amount { get; set; }
    public string? Message { get; set; }
}
