using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReliefConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSOSCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SOSCategory",
                table: "Pings",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SOSCategory",
                table: "Pings");
        }
    }
}
