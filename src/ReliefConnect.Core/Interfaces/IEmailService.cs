namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Abstraction for sending emails (verification codes, notifications, etc.).
/// </summary>
public interface IEmailService
{
    /// <summary>Send a plain-text / HTML email.</summary>
    Task SendEmailAsync(string toEmail, string subject, string htmlBody);

    /// <summary>Send a 6-digit verification code email.</summary>
    Task SendVerificationCodeAsync(string toEmail, string code);
}
