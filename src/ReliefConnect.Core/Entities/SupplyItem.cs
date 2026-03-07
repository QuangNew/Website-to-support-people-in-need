namespace ReliefConnect.Core.Entities;

/// <summary>
/// Supply warehouse item on the relief map.
/// </summary>
public class SupplyItem
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public double CoordinatesLat { get; set; }

    public double CoordinatesLong { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
