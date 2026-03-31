namespace ReliefConnect.Core.Enums;

/// <summary>
/// Status lifecycle for post reports.
/// Maps to integer column in Reports table.
/// </summary>
public enum ReportStatus
{
    Pending = 0,
    Reviewed = 1,
    Dismissed = 2
}
