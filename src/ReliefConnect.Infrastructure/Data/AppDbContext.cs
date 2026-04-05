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

        // ═══════ PING (Map Item) ═══════
        builder.Entity<Ping>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Type).HasConversion<int>();
            entity.Property(p => p.Status).HasConversion<int>();
            entity.Property(p => p.Details).HasMaxLength(2000);

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
            // Index for category filtering (used by 3+ endpoints)
            entity.HasIndex(p => p.Category);
            // Composite index for cursor pagination (CreatedAt DESC, Id DESC)
            entity.HasIndex(p => new { p.CreatedAt, p.Id }).IsDescending();

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

            entity.HasIndex(c => c.PostId);
            entity.HasIndex(c => c.UserId);
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
        });

        // ═══════ APPLICATION USER (Suspension index) ═══════
        builder.Entity<ApplicationUser>(entity =>
        {
            entity.HasIndex(u => u.IsSuspended);
        });
    }
}
