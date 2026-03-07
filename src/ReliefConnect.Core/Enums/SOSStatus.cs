namespace ReliefConnect.Core.Enums;

/// <summary>
/// Status lifecycle for SOS map items.
/// Matches SRS Section 4.2 Data Dictionary.
/// </summary>
public enum SOSStatus
{
    /// <summary>Waiting for help/approval</summary>
    Pending = 0,

    /// <summary>Volunteer assigned and en route</summary>
    InProgress = 1,

    /// <summary>Support completed</summary>
    Resolved = 2,

    /// <summary>User confirmed their own safety</summary>
    VerifiedSafe = 3
}
