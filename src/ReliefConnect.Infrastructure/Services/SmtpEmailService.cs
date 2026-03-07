using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

/// <summary>
/// SMTP-based email sender.
/// Falls back to logging the email in development when SMTP is not configured.
/// </summary>
public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration config, ILogger<SmtpEmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody)
    {
        var host = _config["Smtp:Host"];
        var port = int.TryParse(_config["Smtp:Port"], out var p) ? p : 587;
        var user = _config["Smtp:User"];
        var pass = _config["Smtp:Password"];
        var from = _config["Smtp:From"] ?? "noreply@reliefconnect.vn";

        // If SMTP is not configured, log the email (dev mode)
        if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(user))
        {
            _logger.LogWarning(
                "SMTP not configured — email NOT sent. To: {To}, Subject: {Subject}, Body: {Body}",
                toEmail, subject, htmlBody);
            return;
        }

        using var client = new SmtpClient(host, port)
        {
            Credentials = new NetworkCredential(user, pass),
            EnableSsl = true
        };

        var msg = new MailMessage(from, toEmail, subject, htmlBody)
        {
            IsBodyHtml = true
        };

        await client.SendMailAsync(msg);
        _logger.LogInformation("Email sent to {To}: {Subject}", toEmail, subject);
    }

    public async Task SendVerificationCodeAsync(string toEmail, string code)
    {
        var subject = "ReliefConnect — Mã xác nhận email";
        var body = $"""
            <div style="font-family:'Be Vietnam Pro',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:16px">
              <h2 style="color:#f97316;margin:0 0 16px">ReliefConnect</h2>
              <p>Xin chào,</p>
              <p>Mã xác nhận email của bạn là:</p>
              <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#1e293b;border-radius:12px;margin:16px 0;color:#f97316">
                {code}
              </div>
              <p style="font-size:14px;color:#94a3b8">Mã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
              <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
              <p style="font-size:12px;color:#64748b">© ReliefConnect — Chung lòng mùa lũ</p>
            </div>
            """;

        await SendEmailAsync(toEmail, subject, body);
    }
}
