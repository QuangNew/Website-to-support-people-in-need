namespace ReliefConnect.API.Services;

/// <summary>
/// Distributed rate-limit counter store.
/// </summary>
public interface IRateLimitStore
{
    Task<bool> CheckRateLimitAsync(string key, int maxAttempts, TimeSpan window, CancellationToken cancellationToken = default);
}