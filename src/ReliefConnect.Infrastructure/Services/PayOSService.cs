using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

/// <summary>
/// PayOS payment integration service.
/// Docs: https://payos.vn/docs/api/
/// </summary>
public class PayOSService : IPayOSService
{
    private const string BaseUrl = "https://api-merchant.payos.vn";
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<PayOSService> _logger;

    public PayOSService(HttpClient http, IConfiguration config, ILogger<PayOSService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<PayOSCreateResult> CreatePaymentLinkAsync(
        long orderCode,
        long amount,
        string description,
        string? buyerName,
        string? buyerEmail,
        string cancelUrl,
        string returnUrl)
    {
        var checksumKey = GetRequiredConfig("PayOS:ChecksumKey");

        // Signature = HMAC_SHA256(checksumKey, "amount=X&cancelUrl=X&description=X&orderCode=X&returnUrl=X")
        var signatureData = $"amount={amount}&cancelUrl={cancelUrl}&description={description}&orderCode={orderCode}&returnUrl={returnUrl}";
        var signature = HmacSha256Hex(checksumKey, signatureData);

        var body = new
        {
            orderCode,
            amount,
            description,
            buyerName,
            buyerEmail,
            cancelUrl,
            returnUrl,
            signature,
            expiredAt = (int)DateTimeOffset.UtcNow.AddMinutes(15).ToUnixTimeSeconds(),
        };

        var request = CreateAuthedRequest(HttpMethod.Post, $"{BaseUrl}/v2/payment-requests");
        request.Content = JsonContent.Create(body);

        var response = await _http.SendAsync(request);
        var raw = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("PayOS CreatePaymentLink failed {Status}: {Body}", response.StatusCode, raw);
            throw new InvalidOperationException($"PayOS error: {response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        if (root.GetProperty("code").GetString() != "00")
        {
            var desc = root.TryGetProperty("desc", out var d) ? d.GetString() : "Unknown error";
            throw new InvalidOperationException($"PayOS returned error: {desc}");
        }

        var data = root.GetProperty("data");
        return new PayOSCreateResult(
            QrCode: data.GetProperty("qrCode").GetString()!,
            CheckoutUrl: data.GetProperty("checkoutUrl").GetString()!,
            PaymentLinkId: data.GetProperty("paymentLinkId").GetString()!,
            Status: data.GetProperty("status").GetString()!
        );
    }

    public async Task<PayOSPaymentStatusResult> GetPaymentStatusAsync(long orderCode)
    {
        var request = CreateAuthedRequest(HttpMethod.Get, $"{BaseUrl}/v2/payment-requests/{orderCode}");
        var response = await _http.SendAsync(request);
        var raw = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("PayOS GetPaymentStatus failed {Status}: {Body}", response.StatusCode, raw);
            throw new InvalidOperationException($"PayOS error: {response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        if (root.GetProperty("code").GetString() != "00")
        {
            var desc = root.TryGetProperty("desc", out var d) ? d.GetString() : "Unknown error";
            throw new InvalidOperationException($"PayOS returned error: {desc}");
        }

        var data = root.GetProperty("data");
        return new PayOSPaymentStatusResult(
            OrderCode: orderCode,
            Status: data.GetProperty("status").GetString() ?? "PENDING",
            PaymentLinkId: data.TryGetProperty("paymentLinkId", out var paymentLinkId) ? paymentLinkId.GetString() : null
        );
    }

    /// <summary>
    /// Verifies a webhook payload signature from PayOS.
    /// PayOS sorts the data object fields alphabetically and computes HMAC_SHA256.
    /// </summary>
    public bool VerifyWebhookSignature(IDictionary<string, object?> data, string signature)
    {
        var checksumKey = _config["PayOS:ChecksumKey"];
        if (string.IsNullOrEmpty(checksumKey)) return false;

        // Sort keys alphabetically and build "key=value&key=value" string
        var sortedKeys = data.Keys.OrderBy(k => k, StringComparer.Ordinal);
        var parts = sortedKeys
            .Where(k => data[k] != null)
            .Select(k => $"{k}={data[k]}");
        var raw = string.Join("&", parts);

        var expected = HmacSha256Hex(checksumKey, raw);
        return string.Equals(expected, signature, StringComparison.OrdinalIgnoreCase);
    }

    private HttpRequestMessage CreateAuthedRequest(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("x-client-id", GetRequiredConfig("PayOS:ClientId"));
        request.Headers.Add("x-api-key", GetRequiredConfig("PayOS:ApiKey"));
        return request;
    }

    private string GetRequiredConfig(string key)
        => _config[key] ?? throw new InvalidOperationException($"{key} is not configured.");

    private static string HmacSha256Hex(string key, string data)
    {
        var keyBytes = Encoding.UTF8.GetBytes(key);
        var dataBytes = Encoding.UTF8.GetBytes(data);
        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(dataBytes);
        return Convert.ToHexString(hash).ToLower();
    }
}
