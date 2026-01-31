namespace DisasterReliefPlatform.Core.Enums;

public enum UserRole
{
    Admin,
    JCIStaff,
    Donor,
    Volunteer,
    Recipient
}

public enum SOSStatus
{
    Pending,
    Verified,
    InProgress,
    Resolved,
    Rejected
}

public enum DonationType
{
    Money,
    Supplies,
    Both
}

public enum VolunteerTaskStatus
{
    Available,
    Assigned,
    InProgress,
    Completed,
    Cancelled
}
