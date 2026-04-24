using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace ReliefConnect.Infrastructure.Data;

/// <summary>
/// Design-time factory used exclusively by EF Core tooling (dotnet ef migrations/database update).
/// Bypasses Program.cs entirely — no Hangfire, no Identity, no other services are started.
/// Reads the connection string from appsettings.json + appsettings.Development.json
/// (the Development override is gitignored and holds the real credentials locally).
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        // Resolve the API project root so we can pick up its appsettings files
        var apiProjectPath = Path.GetFullPath(
            Path.Combine(Directory.GetCurrentDirectory(), "..", "ReliefConnect.API"));

        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiProjectPath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)  // gitignored — holds real credentials
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "DefaultConnection not found. Make sure appsettings.Development.json exists in ReliefConnect.API with the connection string.");

        // Disable connection pooling for design-time operations to avoid
        // ObjectDisposedException with Supabase PgBouncer during migrations.
        var csb = new Npgsql.NpgsqlConnectionStringBuilder(connectionString) { Pooling = false };

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(csb.ConnectionString, npgsql =>
        {
            npgsql.UseNetTopologySuite();
        });

        return new AppDbContext(optionsBuilder.Options);
    }
}
