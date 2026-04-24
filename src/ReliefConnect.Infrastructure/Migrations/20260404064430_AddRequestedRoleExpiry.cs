using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ReliefConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRequestedRoleExpiry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId",
                table: "Messages");

            migrationBuilder.AddColumn<Guid>(
                name: "BatchId",
                table: "SystemLogs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ParentLogId",
                table: "SystemLogs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPinned",
                table: "Posts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "AssignedVolunteerId",
                table: "Pings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompletionNotes",
                table: "Pings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BanReason",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsSuspended",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LastTokenJti",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RequestedRoleExpiry",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SuspendedUntil",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "HelpOffers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SponsorId = table.Column<string>(type: "text", nullable: false),
                    TargetUserId = table.Column<string>(type: "text", nullable: false),
                    PingId = table.Column<int>(type: "integer", nullable: true),
                    PostId = table.Column<int>(type: "integer", nullable: true),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HelpOffers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HelpOffers_AspNetUsers_SponsorId",
                        column: x => x.SponsorId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_HelpOffers_AspNetUsers_TargetUserId",
                        column: x => x.TargetUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_HelpOffers_Pings_PingId",
                        column: x => x.PingId,
                        principalTable: "Pings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HelpOffers_Posts_PostId",
                        column: x => x.PostId,
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Reports",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PostId = table.Column<int>(type: "integer", nullable: false),
                    ReporterId = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reports_AspNetUsers_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Reports_Posts_PostId",
                        column: x => x.PostId,
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SystemAnnouncements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    AdminId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemAnnouncements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SystemAnnouncements_AspNetUsers_AdminId",
                        column: x => x.AdminId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SystemLogs_Action",
                table: "SystemLogs",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_SystemLogs_BatchId",
                table: "SystemLogs",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemLogs_ParentLogId",
                table: "SystemLogs",
                column: "ParentLogId");

            migrationBuilder.CreateIndex(
                name: "IX_Posts_Category",
                table: "Posts",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_Posts_CreatedAt_Id",
                table: "Posts",
                columns: new[] { "CreatedAt", "Id" },
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_Pings_AssignedVolunteerId",
                table: "Pings",
                column: "AssignedVolunteerId");

            migrationBuilder.CreateIndex(
                name: "IX_Pings_CreatedAt",
                table: "Pings",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_Pings_PriorityLevel",
                table: "Pings",
                column: "PriorityLevel");

            migrationBuilder.CreateIndex(
                name: "IX_Pings_Status",
                table: "Pings",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Pings_Type",
                table: "Pings",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_Pings_Type_Status_CreatedAt",
                table: "Pings",
                columns: new[] { "Type", "Status", "CreatedAt" },
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_CreatedAt",
                table: "Notifications",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId_SentAt",
                table: "Messages",
                columns: new[] { "ConversationId", "SentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_CreatedAt",
                table: "Comments",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_GoogleId",
                table: "AspNetUsers",
                column: "GoogleId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_IsSuspended",
                table: "AspNetUsers",
                column: "IsSuspended");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_Role",
                table: "AspNetUsers",
                column: "Role");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_VerificationStatus",
                table: "AspNetUsers",
                column: "VerificationStatus");

            migrationBuilder.CreateIndex(
                name: "IX_HelpOffers_PingId",
                table: "HelpOffers",
                column: "PingId");

            migrationBuilder.CreateIndex(
                name: "IX_HelpOffers_PostId",
                table: "HelpOffers",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_HelpOffers_SponsorId",
                table: "HelpOffers",
                column: "SponsorId");

            migrationBuilder.CreateIndex(
                name: "IX_HelpOffers_Status",
                table: "HelpOffers",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_HelpOffers_TargetUserId",
                table: "HelpOffers",
                column: "TargetUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_PostId",
                table: "Reports",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_ReporterId",
                table: "Reports",
                column: "ReporterId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_Status",
                table: "Reports",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAnnouncements_AdminId",
                table: "SystemAnnouncements",
                column: "AdminId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAnnouncements_ExpiresAt",
                table: "SystemAnnouncements",
                column: "ExpiresAt");

            migrationBuilder.AddForeignKey(
                name: "FK_Pings_AspNetUsers_AssignedVolunteerId",
                table: "Pings",
                column: "AssignedVolunteerId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SystemLogs_SystemLogs_ParentLogId",
                table: "SystemLogs",
                column: "ParentLogId",
                principalTable: "SystemLogs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pings_AspNetUsers_AssignedVolunteerId",
                table: "Pings");

            migrationBuilder.DropForeignKey(
                name: "FK_SystemLogs_SystemLogs_ParentLogId",
                table: "SystemLogs");

            migrationBuilder.DropTable(
                name: "HelpOffers");

            migrationBuilder.DropTable(
                name: "Reports");

            migrationBuilder.DropTable(
                name: "SystemAnnouncements");

            migrationBuilder.DropIndex(
                name: "IX_SystemLogs_Action",
                table: "SystemLogs");

            migrationBuilder.DropIndex(
                name: "IX_SystemLogs_BatchId",
                table: "SystemLogs");

            migrationBuilder.DropIndex(
                name: "IX_SystemLogs_ParentLogId",
                table: "SystemLogs");

            migrationBuilder.DropIndex(
                name: "IX_Posts_Category",
                table: "Posts");

            migrationBuilder.DropIndex(
                name: "IX_Posts_CreatedAt_Id",
                table: "Posts");

            migrationBuilder.DropIndex(
                name: "IX_Pings_AssignedVolunteerId",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_CreatedAt",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_PriorityLevel",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_Status",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_Type",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Pings_Type_Status_CreatedAt",
                table: "Pings");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_CreatedAt",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId_SentAt",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Comments_CreatedAt",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_GoogleId",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_IsSuspended",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_Role",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_VerificationStatus",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "BatchId",
                table: "SystemLogs");

            migrationBuilder.DropColumn(
                name: "ParentLogId",
                table: "SystemLogs");

            migrationBuilder.DropColumn(
                name: "IsPinned",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "AssignedVolunteerId",
                table: "Pings");

            migrationBuilder.DropColumn(
                name: "CompletionNotes",
                table: "Pings");

            migrationBuilder.DropColumn(
                name: "BanReason",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "IsSuspended",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "LastTokenJti",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "RequestedRoleExpiry",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "SuspendedUntil",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId",
                table: "Messages",
                column: "ConversationId");
        }
    }
}
