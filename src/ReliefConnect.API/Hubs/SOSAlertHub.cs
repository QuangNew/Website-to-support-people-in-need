using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ReliefConnect.API.Hubs;

/// <summary>
/// SignalR hub for real-time SOS blinking alerts (REQ-MAP-05).
/// Volunteers and Admins join the alert group to receive blinking notifications.
/// </summary>
[Authorize]
public class SOSAlertHub : Hub
{
    private const string AlertGroup = "SOSAlertReceivers";
    private readonly ILogger<SOSAlertHub> _logger;

    public SOSAlertHub(ILogger<SOSAlertHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Volunteers/Admins call this to start receiving SOS alerts.
    /// </summary>
    public async Task JoinSOSAlertGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, AlertGroup);
        _logger.LogInformation("User {UserId} joined SOS alert group", Context.UserIdentifier);
    }

    /// <summary>
    /// Leave the SOS alert group.
    /// </summary>
    public async Task LeaveSOSAlertGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, AlertGroup);
        _logger.LogInformation("User {UserId} left SOS alert group", Context.UserIdentifier);
    }

    /// <summary>
    /// Server-side method to broadcast a blinking alert for a specific ping.
    /// Called by SOSMonitorService when a ping exceeds the unconfirmed timeout.
    /// </summary>
    public static async Task BroadcastBlinkingAlert(IHubContext<SOSAlertHub> hubContext, int pingId, double lat, double lng)
    {
        await hubContext.Clients.Group(AlertGroup).SendAsync("ReceiveSOSAlert", new
        {
            PingId = pingId,
            Lat = lat,
            Lng = lng,
            Timestamp = DateTime.UtcNow,
        });
    }

    /// <summary>
    /// Broadcast that a ping's blink has been resolved (confirmed safe / resolved).
    /// </summary>
    public static async Task BroadcastAlertResolved(IHubContext<SOSAlertHub> hubContext, int pingId)
    {
        await hubContext.Clients.Group(AlertGroup).SendAsync("SOSAlertResolved", new
        {
            PingId = pingId,
            Timestamp = DateTime.UtcNow,
        });
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("SignalR connected: {ConnectionId}, User: {UserId}",
            Context.ConnectionId, Context.UserIdentifier);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("SignalR disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
