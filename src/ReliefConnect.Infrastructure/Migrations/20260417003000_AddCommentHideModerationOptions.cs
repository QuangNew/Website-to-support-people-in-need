using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReliefConnect.Infrastructure.Migrations
{
    public partial class AddCommentHideModerationOptions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HiddenReason",
                table: "Comments",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HiddenUntil",
                table: "Comments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UserWasNotified",
                table: "Comments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Comments_HiddenUntil",
                table: "Comments",
                column: "HiddenUntil");

            migrationBuilder.Sql(
                """
                UPDATE \"Comments\"
                SET \"HiddenUntil\" = \"HiddenAt\" + INTERVAL '30 days'
                WHERE \"IsHidden\" = TRUE AND \"HiddenAt\" IS NOT NULL AND \"HiddenUntil\" IS NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Comments_HiddenUntil",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "HiddenReason",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "HiddenUntil",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "UserWasNotified",
                table: "Comments");
        }
    }
}