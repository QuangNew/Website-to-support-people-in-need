using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReliefConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPingContactSnapshotFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConditionImageUrl",
                table: "Pings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactName",
                table: "Pings",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactPhone",
                table: "Pings",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConditionImageUrl",
                table: "Pings");

            migrationBuilder.DropColumn(
                name: "ContactName",
                table: "Pings");

            migrationBuilder.DropColumn(
                name: "ContactPhone",
                table: "Pings");
        }
    }
}
