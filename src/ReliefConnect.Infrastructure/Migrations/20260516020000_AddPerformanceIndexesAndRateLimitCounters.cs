using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ReliefConnect.Infrastructure.Data;

#nullable disable

namespace ReliefConnect.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260516020000_AddPerformanceIndexesAndRateLimitCounters")]
    public partial class AddPerformanceIndexesAndRateLimitCounters : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "RateLimitCounters" (
                    "Key" text PRIMARY KEY,
                    "Count" integer NOT NULL,
                    "WindowStartedAt" timestamp with time zone NOT NULL,
                    "ExpiresAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NOT NULL
                );
                """);

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_RateLimitCounters_ExpiresAt" ON "RateLimitCounters" ("ExpiresAt");""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Posts_Feed_CreatedAt_Id" ON "Posts" ("CreatedAt" DESC, "Id" DESC) WHERE "IsDeleted" = FALSE AND "IsApproved" = TRUE;""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Posts_Feed_Category_CreatedAt_Id" ON "Posts" ("Category", "CreatedAt" DESC, "Id" DESC) WHERE "IsDeleted" = FALSE AND "IsApproved" = TRUE;""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Posts_Feed_Author_CreatedAt_Id" ON "Posts" ("AuthorId", "CreatedAt" DESC, "Id" DESC) WHERE "IsDeleted" = FALSE AND "IsApproved" = TRUE;""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Posts_SpamGuard_Author_CreatedAt" ON "Posts" ("AuthorId", "CreatedAt" DESC) WHERE "IsDeleted" = FALSE;""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Comments_Post_Visible_CreatedAt" ON "Comments" ("PostId", "CreatedAt" DESC) WHERE "IsHidden" = FALSE;""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Comments_User_Visible_CreatedAt" ON "Comments" ("UserId", "CreatedAt" DESC) WHERE "IsHidden" = FALSE;""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Reactions_Post_Type" ON "Reactions" ("PostId", "Type");""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Reactions_Post_CreatedAt" ON "Reactions" ("PostId", "CreatedAt" DESC);""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Notifications_User_CreatedAt" ON "Notifications" ("UserId", "CreatedAt" DESC);""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Notifications_User_Unread_CreatedAt" ON "Notifications" ("UserId", "CreatedAt" DESC) WHERE "IsRead" = FALSE;""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_DirectConversations_User1_LastMessageAt" ON "DirectConversations" ("User1Id", "LastMessageAt" DESC);""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_DirectConversations_User2_LastMessageAt" ON "DirectConversations" ("User2Id", "LastMessageAt" DESC);""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_DirectMessages_Conversation_SentAt_Id_Active" ON "DirectMessages" ("ConversationId", "SentAt" DESC, "Id" DESC) WHERE "DeletedAt" IS NULL;""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_DirectMessages_Unread_Conversation_Sender" ON "DirectMessages" ("ConversationId", "SenderId") WHERE "IsRead" = FALSE AND "DeletedAt" IS NULL;""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_DirectMessages_Sender_SentAt_Active" ON "DirectMessages" ("SenderId", "SentAt" DESC) WHERE "DeletedAt" IS NULL;""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_Pings_User_CreatedAt" ON "Pings" ("UserId", "CreatedAt" DESC);""");

            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_DonationRecords_Status_PaidAt" ON "DonationRecords" ("Status", "PaidAt" DESC) WHERE "PaidAt" IS NOT NULL;""");
            CreateIndexConcurrently(migrationBuilder,
                """CREATE INDEX CONCURRENTLY IF NOT EXISTS "IX_SystemAnnouncements_CreatedAt" ON "SystemAnnouncements" ("CreatedAt" DESC);""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            DropIndexConcurrently(migrationBuilder, "IX_SystemAnnouncements_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_DonationRecords_Status_PaidAt");
            DropIndexConcurrently(migrationBuilder, "IX_Pings_User_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_DirectMessages_Sender_SentAt_Active");
            DropIndexConcurrently(migrationBuilder, "IX_DirectMessages_Unread_Conversation_Sender");
            DropIndexConcurrently(migrationBuilder, "IX_DirectMessages_Conversation_SentAt_Id_Active");
            DropIndexConcurrently(migrationBuilder, "IX_DirectConversations_User2_LastMessageAt");
            DropIndexConcurrently(migrationBuilder, "IX_DirectConversations_User1_LastMessageAt");
            DropIndexConcurrently(migrationBuilder, "IX_Notifications_User_Unread_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_Notifications_User_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_Reactions_Post_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_Reactions_Post_Type");
            DropIndexConcurrently(migrationBuilder, "IX_Comments_User_Visible_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_Comments_Post_Visible_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_Posts_SpamGuard_Author_CreatedAt");
            DropIndexConcurrently(migrationBuilder, "IX_Posts_Feed_Author_CreatedAt_Id");
            DropIndexConcurrently(migrationBuilder, "IX_Posts_Feed_Category_CreatedAt_Id");
            DropIndexConcurrently(migrationBuilder, "IX_Posts_Feed_CreatedAt_Id");
            DropIndexConcurrently(migrationBuilder, "IX_RateLimitCounters_ExpiresAt");

            migrationBuilder.Sql("""DROP TABLE IF EXISTS "RateLimitCounters";""");
        }

        private static void CreateIndexConcurrently(MigrationBuilder migrationBuilder, string sql)
            => migrationBuilder.Sql(sql, suppressTransaction: true);

        private static void DropIndexConcurrently(MigrationBuilder migrationBuilder, string indexName)
            => migrationBuilder.Sql($"""DROP INDEX CONCURRENTLY IF EXISTS "{indexName}";""", suppressTransaction: true);
    }
}
