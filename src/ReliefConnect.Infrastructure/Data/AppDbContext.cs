using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;

namespace ReliefConnect.Infrastructure.Data;

/// <summary>
/// Main database context extending ASP.NET Core Identity.
/// Configured for PostgreSQL (Supabase) with PostGIS spatial support.
/// </summary>
public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Ping> Pings => Set<Ping>();
    public DbSet<PingFlag> PingFlags => Set<PingFlag>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<SupplyItem> SupplyItems => Set<SupplyItem>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Reaction> Reactions => Set<Reaction>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<SystemLog> SystemLogs => Set<SystemLog>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<HelpOffer> HelpOffers => Set<HelpOffer>();
    public DbSet<SystemAnnouncement> SystemAnnouncements => Set<SystemAnnouncement>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<BlacklistedToken> BlacklistedTokens => Set<BlacklistedToken>();
    public DbSet<ContentViolation> ContentViolations => Set<ContentViolation>();
    public DbSet<VerificationHistory> VerificationHistories => Set<VerificationHistory>();
    public DbSet<DirectConversation> DirectConversations => Set<DirectConversation>();
    public DbSet<DirectMessage> DirectMessages => Set<DirectMessage>();
    public DbSet<DonationRecord> DonationRecords => Set<DonationRecord>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // ═══════ USER ═══════
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.FullName).HasMaxLength(200);
            entity.Property(u => u.AvatarUrl).HasMaxLength(500);
            entity.Property(u => u.Role).HasConversion<int>();
            entity.Property(u => u.VerificationStatus).HasConversion<int>();

            // Indexes for admin queries and Google login
            entity.HasIndex(u => u.VerificationStatus);
            entity.HasIndex(u => u.GoogleId);
            entity.HasIndex(u => u.Role);
        });

        // ═══════ VERIFICATION HISTORY ═══════
        builder.Entity<VerificationHistory>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.Property(v => v.RequestedRole).HasMaxLength(50).IsRequired();
            entity.Property(v => v.VerificationReason).HasMaxLength(1000);
            entity.Property(v => v.VerificationImageUrls).HasMaxLength(3000);
            entity.Property(v => v.PhoneNumber).HasMaxLength(32);
            entity.Property(v => v.Address).HasMaxLength(500);
            entity.Property(v => v.ReviewedByAdminName).HasMaxLength(100);
            entity.Property(v => v.Status).HasConversion<int>();

            entity.HasIndex(v => new { v.UserId, v.SubmittedAt }).IsDescending();
            entity.HasIndex(v => new { v.UserId, v.Status });

            entity.HasOne(v => v.User)
                  .WithMany(u => u.VerificationHistories)
                  .HasForeignKey(v => v.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ═══════ PING (Map Item) ═══════
        builder.Entity<Ping>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Type).HasConversion<int>();
            entity.Property(p => p.Status).HasConversion<int>();
            entity.Property(p => p.Details).HasMaxLength(2000);
            entity.Property(p => p.ContactName).HasMaxLength(200);
            entity.Property(p => p.ContactPhone).HasMaxLength(32);
            entity.Property(p => p.ConditionImageUrl).HasMaxLength(500);
            entity.Property(p => p.SOSCategory).HasConversion<int?>();

            // B-tree index on coordinates (for equality queries)
            entity.HasIndex(p => new { p.CoordinatesLat, p.CoordinatesLong });
            // Covering index for the most common query: fetch all pings sorted by date
            entity.HasIndex(p => p.CreatedAt).IsDescending();
            // FK index for user lookups
            entity.HasIndex(p => p.UserId);
            // Status filter index
            entity.HasIndex(p => p.Status);
            // Type filter index for SOS filtering
            entity.HasIndex(p => p.Type);
            // Priority level for urgent sorting
            entity.HasIndex(p => p.PriorityLevel);
            // Composite index for SOS monitoring queries (Type + Status + CreatedAt)
            entity.HasIndex(p => new { p.Type, p.Status, p.CreatedAt }).IsDescending();

            entity.HasOne(p => p.User)
                  .WithMany(u => u.Pings)
                  .HasForeignKey(p => p.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.PingFlag)
                  .WithOne(f => f.Ping)
                  .HasForeignKey<PingFlag>(f => f.PingId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ═══════ PING FLAG ═══════
        builder.Entity<PingFlag>(entity =>
        {
            entity.HasKey(f => f.Id);
        });

        // ═══════ ZONE ═══════
        builder.Entity<Zone>(entity =>
        {
            entity.HasKey(z => z.Id);
            entity.Property(z => z.Name).HasMaxLength(200).IsRequired();
            entity.Property(z => z.BoundaryGeoJson).IsRequired();
        });

        // ═══════ SUPPLY ITEM ═══════
        builder.Entity<SupplyItem>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(s => new { s.CoordinatesLat, s.CoordinatesLong });
        });

        // ═══════ TAG (Category) ═══════
        builder.Entity<Tag>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.CategoryName).HasMaxLength(100).IsRequired();
            entity.Property(t => t.Description).HasMaxLength(500);

            // Seed the 3 required categories (REQ-SOC-01)
            entity.HasData(
                new Tag { Id = 1, CategoryName = "Gia cảnh", Description = "Livelihood Support — Hỗ trợ gia cảnh khó khăn" },
                new Tag { Id = 2, CategoryName = "Bệnh tật", Description = "Medical Support — Hỗ trợ y tế, bệnh tật" },
                new Tag { Id = 3, CategoryName = "Giáo dục", Description = "Education Support — Hỗ trợ giáo dục" }
            );
        });

        // ═══════ POST ═══════
        builder.Entity<Post>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Content).HasMaxLength(5000).IsRequired();
            entity.Property(p => p.ImageUrl).HasMaxLength(500);
            entity.Property(p => p.Category).HasConversion<int>();

            entity.HasIndex(p => p.CreatedAt).IsDescending();
            entity.HasIndex(p => p.AuthorId);
            entity.HasIndex(p => p.Category);
            entity.HasIndex(p => new { p.CreatedAt, p.Id }).IsDescending();
            // Soft-delete: index for restore queries
            entity.HasIndex(p => p.IsDeleted);
            entity.HasIndex(p => p.DeletedAt);

            entity.HasOne(p => p.Author)
                  .WithMany(u => u.Posts)
                  .HasForeignKey(p => p.AuthorId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.Tag)
                  .WithMany(t => t.Posts)
                  .HasForeignKey(p => p.CategoryId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ═══════ COMMENT ═══════
        builder.Entity<Comment>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Content).HasMaxLength(2000).IsRequired();
            entity.Property(c => c.HiddenReason).HasMaxLength(500);

            entity.HasIndex(c => c.PostId);
            entity.HasIndex(c => c.UserId);
            // Soft-delete: index for hidden comment cleanup
            entity.HasIndex(c => c.IsHidden);
            entity.HasIndex(c => c.HiddenAt);
            entity.HasIndex(c => c.HiddenUntil);
            // Index for chronological ordering (newest comments first)
            entity.HasIndex(c => c.CreatedAt).IsDescending();

            entity.HasOne(c => c.Post)
                  .WithMany(p => p.Comments)
                  .HasForeignKey(c => c.PostId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.User)
                  .WithMany(u => u.Comments)
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // ═══════ REACTION ═══════
        builder.Entity<Reaction>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Type).HasConversion<int>();

            entity.HasIndex(r => new { r.PostId, r.UserId }).IsUnique();
            entity.HasIndex(r => r.UserId);

            entity.HasOne(r => r.Post)
                  .WithMany(p => p.Reactions)
                  .HasForeignKey(r => r.PostId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.User)
                  .WithMany(u => u.Reactions)
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // ═══════ CONVERSATION ═══════
        builder.Entity<Conversation>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasIndex(c => c.UserId);

            entity.HasOne(c => c.User)
                  .WithMany(u => u.Conversations)
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ═══════ MESSAGE ═══════
        builder.Entity<Message>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Content).HasMaxLength(8000).IsRequired();
            entity.HasIndex(m => new { m.ConversationId, m.SentAt });

            entity.HasOne(m => m.Conversation)
                  .WithMany(c => c.Messages)
                  .HasForeignKey(m => m.ConversationId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Sender)
                  .WithMany()
                  .HasForeignKey(m => m.SenderId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ═══════ NOTIFICATION ═══════
        builder.Entity<Notification>(entity =>
        {
            entity.HasKey(n => n.Id);
            entity.Property(n => n.MessageText).HasMaxLength(500).IsRequired();

            entity.HasIndex(n => new { n.UserId, n.IsRead });
            // Index for chronological pagination (newest first)
            entity.HasIndex(n => n.CreatedAt).IsDescending();

            entity.HasOne(n => n.User)
                  .WithMany(u => u.Notifications)
                  .HasForeignKey(n => n.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ═══════ SYSTEM LOG ═══════
        builder.Entity<SystemLog>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.Property(l => l.Action).HasMaxLength(200).IsRequired();
            entity.Property(l => l.Details).HasMaxLength(2000);
            entity.Property(l => l.UserName).HasMaxLength(100);

            entity.HasIndex(l => l.CreatedAt).IsDescending();
            entity.HasIndex(l => l.Action);

            // Self-referencing parent-child for batch log hierarchy
            entity.HasOne(l => l.ParentLog)
                  .WithMany(l => l.ChildLogs)
                  .HasForeignKey(l => l.ParentLogId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(l => l.BatchId);
            entity.HasIndex(l => l.ParentLogId);
        });

        // ═══════ REPORT ═══════
        builder.Entity<Report>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Reason).HasMaxLength(500).IsRequired();
            entity.Property(r => r.Status).HasConversion<int>();

            entity.HasIndex(r => r.Status);
            entity.HasIndex(r => r.PostId);
            entity.HasIndex(r => r.ReporterId);

            entity.HasOne(r => r.Post)
                  .WithMany()
                  .HasForeignKey(r => r.PostId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Reporter)
                  .WithMany()
                  .HasForeignKey(r => r.ReporterId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // ═══════ HELP OFFER ═══════
        builder.Entity<HelpOffer>(entity =>
        {
            entity.HasKey(h => h.Id);
            entity.Property(h => h.Message).HasMaxLength(1000).IsRequired();
            entity.Property(h => h.Status).HasConversion<int>();

            entity.HasIndex(h => h.SponsorId);
            entity.HasIndex(h => h.TargetUserId);
            entity.HasIndex(h => h.Status);

            entity.HasOne(h => h.Sponsor)
                  .WithMany()
                  .HasForeignKey(h => h.SponsorId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(h => h.TargetUser)
                  .WithMany()
                  .HasForeignKey(h => h.TargetUserId)
                  .OnDelete(DeleteBehavior.NoAction);

            entity.HasOne(h => h.Ping)
                  .WithMany()
                  .HasForeignKey(h => h.PingId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(h => h.Post)
                  .WithMany()
                  .HasForeignKey(h => h.PostId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ═══════ SYSTEM ANNOUNCEMENT ═══════
        builder.Entity<SystemAnnouncement>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Title).HasMaxLength(200).IsRequired();
            entity.Property(a => a.Content).HasMaxLength(5000).IsRequired();

            entity.HasIndex(a => a.ExpiresAt);
            entity.HasIndex(a => a.AdminId);

            entity.HasOne(a => a.Admin)
                  .WithMany()
                  .HasForeignKey(a => a.AdminId)
                  .OnDelete(DeleteBehavior.NoAction);
        });

        // ═══════ PING (AssignedVolunteer FK extension) ═══════
        builder.Entity<Ping>(entity =>
        {
            entity.HasOne(p => p.AssignedVolunteer)
                  .WithMany()
                  .HasForeignKey(p => p.AssignedVolunteerId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(p => p.AssignedVolunteerId);
        });

        // ═══════ API KEY ═══════
        builder.Entity<ApiKey>(entity =>
        {
            entity.HasKey(k => k.Id);
            entity.Property(k => k.Provider).HasConversion<string>().HasMaxLength(20);
            entity.Property(k => k.Label).HasMaxLength(100);
            entity.Property(k => k.Model).HasMaxLength(100);
            entity.Property(k => k.FailureCount).HasDefaultValue(0);
            entity.Property(k => k.LastErrorCode).HasMaxLength(80);
            entity.Property(k => k.LastErrorMessage).HasMaxLength(240);
            entity.HasIndex(k => new { k.CooldownUntil, k.LastUsedAt, k.UsageCount, k.Id })
                .HasDatabaseName("IX_ApiKeys_ActiveRotation")
                .HasFilter("\"IsActive\" = TRUE");
            entity.HasIndex(k => new { k.Provider, k.Model })
                .HasDatabaseName("IX_ApiKeys_ActiveProviderModel")
                .HasFilter("\"IsActive\" = TRUE");
        });

        // ═══════ APPLICATION USER (Suspension index) ═══════
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.HasIndex(u => u.IsSuspended);
        });

        // ═══════ BLACKLISTED TOKEN ═══════
        builder.Entity<BlacklistedToken>(entity =>
        {
            entity.HasIndex(t => t.Jti).IsUnique();
            entity.HasIndex(t => t.Expiry);
        });

        // ═══════ CONTENT VIOLATION ═══════
        builder.Entity<ContentViolation>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.Property(v => v.Content).HasMaxLength(2000);
            entity.Property(v => v.Reason).HasMaxLength(200);
            entity.HasIndex(v => v.UserId);
            entity.HasIndex(v => v.CreatedAt).IsDescending();

            entity.HasOne(v => v.User)
                  .WithMany()
                  .HasForeignKey(v => v.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(v => v.Comment)
                  .WithMany()
                  .HasForeignKey(v => v.CommentId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ═══════ APPLICATION USER (Social links) ═══════
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.FacebookUrl).HasMaxLength(500);
            entity.Property(u => u.TelegramUrl).HasMaxLength(200);
        });

        // ═══════ DIRECT CONVERSATION ═══════
        builder.Entity<DirectConversation>(entity =>
        {
            entity.HasKey(c => c.Id);

            // Normalized unique pair: User1Id < User2Id
            entity.HasIndex(c => new { c.User1Id, c.User2Id }).IsUnique();
            entity.HasIndex(c => c.User1Id);
            entity.HasIndex(c => c.User2Id);
            entity.HasIndex(c => c.LastMessageAt).IsDescending();

            entity.ToTable(t =>
            {
                t.HasCheckConstraint("CK_DirectConversation_NoSelf", "\"User1Id\" <> \"User2Id\"");
                t.HasCheckConstraint("CK_DirectConversation_UserOrder", "\"User1Id\" < \"User2Id\"");
            });

            entity.HasOne(c => c.User1)
                  .WithMany(u => u.DirectConversationsAsUser1)
                  .HasForeignKey(c => c.User1Id)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.User2)
                  .WithMany(u => u.DirectConversationsAsUser2)
                  .HasForeignKey(c => c.User2Id)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ═══════ DIRECT MESSAGE ═══════
        builder.Entity<DirectMessage>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Content).HasMaxLength(2000).IsRequired();

            entity.HasIndex(m => new { m.ConversationId, m.SentAt }).IsDescending();
            entity.HasIndex(m => m.SenderId);
            entity.HasIndex(m => new { m.ConversationId, m.IsRead })
                  .HasFilter("\"IsRead\" = false");
            entity.HasIndex(m => m.SentAt)
                  .HasFilter("\"DeletedAt\" IS NULL");

            entity.ToTable(t =>
            {
                t.HasCheckConstraint("CK_DirectMessage_Content_NotBlank", "char_length(btrim(\"Content\")) > 0");
                t.HasCheckConstraint("CK_DirectMessage_Content_MaxLen", "char_length(\"Content\") <= 2000");
            });

            entity.HasOne(m => m.Conversation)
                  .WithMany(c => c.Messages)
                  .HasForeignKey(m => m.ConversationId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Sender)
                  .WithMany()
                  .HasForeignKey(m => m.SenderId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ═══════ DONATION ═══════
        builder.Entity<DonationRecord>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.HasIndex(d => d.OrderCode).IsUnique();
            entity.HasIndex(d => d.Status);
            entity.HasIndex(d => d.PaidAt);
            entity.Property(d => d.DisplayName).HasMaxLength(200).IsRequired();
            entity.Property(d => d.MaskedPhone).HasMaxLength(20);
            entity.Property(d => d.Message).HasMaxLength(200);
            entity.Property(d => d.PaymentLinkId).HasMaxLength(100);
            entity.Property(d => d.Status).HasConversion<int>();

            entity.HasOne(d => d.User)
                  .WithMany()
                  .HasForeignKey(d => d.UserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
