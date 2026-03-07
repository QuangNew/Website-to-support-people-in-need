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
        });

        // ═══════ PING (Map Item) ═══════
        builder.Entity<Ping>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Type).HasConversion<int>();
            entity.Property(p => p.Status).HasConversion<int>();
            entity.Property(p => p.Details).HasMaxLength(2000);

            // Spatial index on coordinates for fast radius queries
            entity.HasIndex(p => new { p.CoordinatesLat, p.CoordinatesLong });

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

            // Index for cursor-based pagination (newest first)
            entity.HasIndex(p => p.CreatedAt).IsDescending();

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

            // Unique constraint: one reaction per user per post
            entity.HasIndex(r => new { r.PostId, r.UserId }).IsUnique();

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
        });
    }
}
