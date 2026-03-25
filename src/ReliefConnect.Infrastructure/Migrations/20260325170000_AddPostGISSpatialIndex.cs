using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReliefConnect.Infrastructure.Migrations;

/// <inheritdoc />
public partial class AddPostGISSpatialIndex : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Create PostGIS GIST spatial index on Pings table for fast ST_DWithin queries
        // This replaces the B-tree index which doesn't help with geospatial radius queries
        migrationBuilder.Sql(@"
            CREATE INDEX IF NOT EXISTS idx_pings_coordinates_geography
            ON ""Pings""
            USING GIST (ST_MakePoint(""CoordinatesLong"", ""CoordinatesLat"")::geography);
        ");

        // Create composite index for SOS monitoring queries
        // Covers: Type + Status + CreatedAt DESC
        migrationBuilder.Sql(@"
            CREATE INDEX IF NOT EXISTS idx_pings_type_status_created
            ON ""Pings"" (""Type"", ""Status"", ""CreatedAt"" DESC);
        ");

        // Add index on PriorityLevel for urgent ping queries
        migrationBuilder.Sql(@"
            CREATE INDEX IF NOT EXISTS idx_pings_priority
            ON ""Pings"" (""PriorityLevel"");
        ");

        // Add index on Type for filtering
        migrationBuilder.Sql(@"
            CREATE INDEX IF NOT EXISTS idx_pings_type
            ON ""Pings"" (""Type"");
        ");

        // Add descending index on Comment.CreatedAt for chronological ordering
        migrationBuilder.Sql(@"
            CREATE INDEX IF NOT EXISTS idx_comments_created_desc
            ON ""Comments"" (""CreatedAt"" DESC);
        ");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"DROP INDEX IF EXISTS idx_pings_coordinates_geography;");
        migrationBuilder.Sql(@"DROP INDEX IF EXISTS idx_pings_type_status_created;");
        migrationBuilder.Sql(@"DROP INDEX IF EXISTS idx_pings_priority;");
        migrationBuilder.Sql(@"DROP INDEX IF EXISTS idx_pings_type;");
        migrationBuilder.Sql(@"DROP INDEX IF EXISTS idx_comments_created_desc;");
    }
}