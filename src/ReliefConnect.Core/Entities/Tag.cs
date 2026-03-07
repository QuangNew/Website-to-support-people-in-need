namespace ReliefConnect.Core.Entities;

/// <summary>
/// Post category/tag (from Class Diagram).
/// SRS REQ-SOC-01: Mandatory category selection.
/// Stored as a lookup table instead of enum for extensibility.
/// </summary>
public class Tag
{
    public int Id { get; set; }

    /// <summary>
    /// Category name: "Gia cảnh" / "Bệnh tật" / "Giáo dục"
    /// </summary>
    public string CategoryName { get; set; } = string.Empty;

    public string? Description { get; set; }

    // Navigation
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
