namespace ReliefConnect.Core.Entities;

public class BlacklistedToken
{
    public int Id { get; set; }
    public string Jti { get; set; } = string.Empty;
    public DateTime Expiry { get; set; }
}
