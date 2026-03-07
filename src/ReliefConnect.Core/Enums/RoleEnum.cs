namespace ReliefConnect.Core.Enums;

/// <summary>
/// User roles in the system with incremental privilege levels.
/// Matches SRS Section 2.2 User Classes.
/// </summary>
public enum RoleEnum
{
    Guest = 0,
    PersonInNeed = 1,
    Sponsor = 2,
    Volunteer = 3,
    Admin = 9
}
