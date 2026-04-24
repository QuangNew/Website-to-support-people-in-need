namespace ReliefConnect.Core.Enums;

/// <summary>
/// Status lifecycle for sponsor help offers.
/// Maps to integer column in HelpOffers table.
/// </summary>
public enum HelpOfferStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}
