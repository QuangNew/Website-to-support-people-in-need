namespace ReliefConnect.Core.Interfaces;

public interface IPayOSService
{
    /// <summary>
    /// Creates a PayOS payment link and returns the QR code string and checkout URL.
    /// </summary>
    Task<PayOSCreateResult> CreatePaymentLinkAsync(
        long orderCode,
        long amount,
        string description,
        string? buyerName,
        string? buyerEmail,
        string cancelUrl,
        string returnUrl);

    /// <summary>
    /// Gets the latest payment status from PayOS for a given order code.
    /// </summary>
    Task<PayOSPaymentStatusResult> GetPaymentStatusAsync(long orderCode);

    /// <summary>
    /// Verifies that a webhook payload's signature matches using the checksum key.
    /// </summary>
    bool VerifyWebhookSignature(IDictionary<string, object?> data, string signature);
}

public sealed record PayOSCreateResult(
    string QrCode,
    string CheckoutUrl,
    string PaymentLinkId,
    string Status
);

public sealed record PayOSPaymentStatusResult(
    long OrderCode,
    string Status,
    string? PaymentLinkId
);
