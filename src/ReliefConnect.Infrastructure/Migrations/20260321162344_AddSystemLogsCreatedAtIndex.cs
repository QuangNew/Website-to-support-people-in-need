using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReliefConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemLogsCreatedAtIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_SystemLogs_CreatedAt",
                table: "SystemLogs",
                column: "CreatedAt",
                descending: new[] { true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SystemLogs_CreatedAt",
                table: "SystemLogs");
        }
    }
}
