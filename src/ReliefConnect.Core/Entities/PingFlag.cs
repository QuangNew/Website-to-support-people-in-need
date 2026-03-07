namespace ReliefConnect.Core.Entities;

/// <summary>
/// Emergency flag for a Ping (REQ-MAP-05).
/// Tracks blinking alert state when user hasn't confirmed safety within 15 minutes.
/// </summary>
public class PingFlag
{
    public int Id { get; set; }

    public int PingId { get; set; }
    public Ping Ping { get; set; } = null!;

    /// <summary>Whether the marker should blink on the map</summary>
    public bool IsBlinking { get; set; } = false;

    /// <summary>Minutes since the ping was created without safety confirmation</summary>
    public int UnconfirmedTimeMinutes { get; set; } = 0;

    public DateTime LastCheckedAt { get; set; } = DateTime.UtcNow;
}
