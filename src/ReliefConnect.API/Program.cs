using System.Text;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using ReliefConnect.API.Hubs;
using ReliefConnect.API.Middleware;
using ReliefConnect.API.Services;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;
using ReliefConnect.Infrastructure.Repositories;
using ReliefConnect.Infrastructure.Services;
using Serilog;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

// ═══════════════════════════════════════════
//  SERILOG
// ═══════════════════════════════════════════
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Destructure.ByTransforming<ReliefConnect.Core.DTOs.LoginDto>(d => new { d.Email, Password = "***" })
    .Destructure.ByTransforming<ReliefConnect.Core.DTOs.RegisterDto>(d => new { d.Username, d.Email, d.FullName, Password = "***" })
    .Destructure.ByTransforming<ReliefConnect.Core.DTOs.ResetPasswordDto>(d => new { d.Email, d.Token, NewPassword = "***" })
    .Destructure.ByTransforming<ReliefConnect.Core.DTOs.ChangePasswordDto>(d => new { CurrentPassword = "***", NewPassword = "***" })
    .CreateLogger();

builder.Host.UseSerilog();

// ═══════════════════════════════════════════
//  DATABASE (Supabase PostgreSQL + PostGIS)
// ═══════════════════════════════════════════
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection must be configured");

var appConnectionString = BuildAppConnectionString(connectionString);
var appUsesSupabasePooler = IsSupabasePoolerConnection(appConnectionString);
var forwardedHeadersOptions = BuildForwardedHeadersOptions(builder.Configuration);

if (appUsesSupabasePooler)
{
    Log.Warning("DefaultConnection is using a Supabase pooler connection. EF MaxBatchSize=1 to avoid ObjectDisposedException with PgBouncer.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        appConnectionString,
        npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorCodesToAdd: null);
            npgsqlOptions.MaxBatchSize(appUsesSupabasePooler ? 1 : 100);
            npgsqlOptions.CommandTimeout(30); // 30s query timeout (production-safe default)
        })
    .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
    .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

// ═══════════════════════════════════════════
//  ASP.NET CORE IDENTITY
// ═══════════════════════════════════════════
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// ═══════════════════════════════════════════
//  JWT AUTHENTICATION
// ═══════════════════════════════════════════
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key must be configured (min 256-bit)");
if (Encoding.UTF8.GetBytes(jwtKey).Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 256 bits (32 bytes)");

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "ReliefConnect";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "ReliefConnectClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // Token resolution order:
            // 1. Authorization: Bearer header — handled by default middleware, skip here
            // 2. Cookie auth_token — fallback for same-origin or legacy browsers
            // 3. Query string access_token — for SignalR WebSocket connections

            // If Authorization header is present, let the default middleware handle it.
            // This takes priority over cookies, which may be stale or blocked by
            // third-party cookie policies (Safari ITP, Chrome deprecation).
            var authHeader = context.Request.Headers["Authorization"].ToString();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                // Don't set context.Token — let the default middleware extract it from the header
                return Task.CompletedTask;
            }

            // Fallback to cookie-based auth
            if (context.Request.Cookies.TryGetValue("auth_token", out var cookieToken))
            {
                context.Token = cookieToken;
                return Task.CompletedTask;
            }

            // SignalR WebSocket: read from query string
            var path = context.HttpContext.Request.Path;
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrWhiteSpace(accessToken)
                && path.StartsWithSegments("/hubs", StringComparison.OrdinalIgnoreCase))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            var blacklist = context.HttpContext.RequestServices.GetRequiredService<ITokenBlacklistService>();
            var jti = context.Principal?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
            if (!string.IsNullOrWhiteSpace(jti) && blacklist.IsBlacklisted(jti))
            {
                context.Fail("Token revoked");
                return;
            }

            // Reload user from DB to catch suspension, role changes, and stamp rotation
            var userId = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                context.Fail("Invalid token: missing subject");
                return;
            }

            var userState = await GetCachedAuthUserStateAsync(context.HttpContext, userId);
            if (userState == null)
            {
                context.Fail("Token revoked: user not found");
                return;
            }

            if (userState.IsSuspended && (userState.SuspendedUntil == null || userState.SuspendedUntil > DateTime.UtcNow))
            {
                context.Fail("Token revoked: account suspended");
                return;
            }

            var roleClaim = context.Principal?.FindFirst("Role")?.Value;
            if (roleClaim != null && roleClaim != userState.Role.ToString())
            {
                context.Fail("Token revoked: role changed");
                return;
            }

            var stampClaim = context.Principal?.FindFirst("stamp")?.Value;
            if (stampClaim != userState.SecurityStamp)
            {
                context.Fail("Token revoked: session invalidated");
                return;
            }
        }
    };
});

// ═══════════════════════════════════════════
//  AUTHORIZATION POLICIES
// ═══════════════════════════════════════════
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("RequireAdmin", p => p.RequireClaim("Role", "Admin"))
    .AddPolicy("RequireVolunteer", p => p.RequireClaim("Role", "Volunteer", "Admin"))
    .AddPolicy("RequirePersonInNeed", p => p.RequireClaim("Role", "PersonInNeed", "Admin"))
    .AddPolicy("RequireSponsor", p => p.RequireClaim("Role", "Sponsor", "Admin"))
    .AddPolicy("RequireVerified", p => p.RequireClaim("Role", "PersonInNeed", "Sponsor", "Volunteer", "Admin"));

// ═══════════════════════════════════════════
//  CORS (Frontend)
// ═══════════════════════════════════════════
var frontendUrls = builder.Configuration.GetSection("Frontend:Urls").Get<string[]>()
    ?? new[]
    {
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175"
    };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(frontendUrls)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ═══════════════════════════════════════════
//  PERFORMANCE
// ═══════════════════════════════════════════
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});

builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Fastest;
});

builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Fastest;
});

builder.Services.AddOutputCache(options =>
{
    options.AddPolicy("MapData30s", p => p.Expire(TimeSpan.FromSeconds(30)));
    options.AddPolicy("Posts2min", p => p.Expire(TimeSpan.FromMinutes(2)));
    options.AddPolicy("Static5min", p => p.Expire(TimeSpan.FromMinutes(5)));
});

builder.Services.AddMemoryCache();

// ═══════════════════════════════════════════
//  CONTROLLERS + SIGNALR + SWAGGER
// ═══════════════════════════════════════════
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ═══════════════════════════════════════════
//  DEPENDENCY INJECTION
// ═══════════════════════════════════════════
builder.Services.AddScoped<IPingRepository, PingRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddScoped<IRateLimitStore, PostgresRateLimitStore>();
builder.Services.AddScoped<INotificationRealtimeDispatcher, NotificationRealtimeDispatcher>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<ISpamGuardService, SpamGuardService>();
builder.Services.AddHttpClient("AiProviders", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddSingleton<IAiProviderClient, GeminiProviderClient>();
builder.Services.AddSingleton<IAiProviderClient, OpenAiProviderClient>();
builder.Services.AddSingleton<IAiProviderClient, AnthropicProviderClient>();
builder.Services.AddSingleton<IAiProviderClient, NvidiaNimProviderClient>();
builder.Services.AddSingleton<IAiChatService, AiChatService>();
builder.Services.AddScoped<ITokenBlacklistService, TokenBlacklistService>();
builder.Services.AddSingleton<Ganss.Xss.HtmlSanitizer>();
builder.Services.AddSingleton<IContentModerationService, ContentModerationService>();
builder.Services.AddHttpClient<IPayOSService, PayOSService>();

// ═══════════════════════════════════════════
//  HANGFIRE
// ═══════════════════════════════════════════
var hangfireConnectionString = BuildHangfireConnectionString(builder.Configuration, connectionString);
var hangfireEnabled = ShouldEnableHangfire(hangfireConnectionString);

var hangfireStorageOptions = new PostgreSqlStorageOptions
{
    SchemaName = "hangfire",
    PrepareSchemaIfNecessary = false
};

if (hangfireEnabled)
{
    builder.Services.AddHangfire(config =>
        config.UsePostgreSqlStorage(
            options => options.UseNpgsqlConnection(hangfireConnectionString),
            hangfireStorageOptions));
    builder.Services.AddHangfireServer();
}
else
{
    Log.Warning("Hangfire server is disabled because the configured connection uses a Supabase pooler, which is causing Npgsql ObjectDisposedException in distributed locks. Configure ConnectionStrings:HangfireConnection with a compatible direct or dedicated connection to enable Hangfire again.");
}

// ═══════════════════════════════════════════
//  BACKGROUND SERVICES
// ═══════════════════════════════════════════
builder.Services.AddHostedService<ReliefConnect.API.BackgroundServices.PingFlagMonitorService>();
builder.Services.AddHostedService<ReliefConnect.API.BackgroundServices.SoftDeleteCleanupService>();
builder.Services.AddHostedService<ReliefConnect.API.BackgroundServices.TokenCleanupService>();
builder.Services.AddHostedService<ReliefConnect.API.BackgroundServices.MessageCleanupService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    FreeDevelopmentPort(5164);
    await SeedDevelopmentAdminAsync(app);
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ═══════════════════════════════════════════
//  MIDDLEWARE PIPELINE
// ═══════════════════════════════════════════
app.UseResponseCompression();
app.UseGlobalExceptionHandler();
app.UseForwardedHeaders(forwardedHeadersOptions);
app.UseHttpsRedirection();
app.UseStaticFiles();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data:; manifest-src 'self';";
    context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()";
    await next();
});
app.UseMiddleware<RateLimitingMiddleware>();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
// OutputCache MUST come AFTER Authentication + Authorization so that
// cached responses are only served to already-authenticated requests.
// Placing it before auth caused 401 responses to be cached and served
// to subsequent requests, breaking the admin panel.
app.UseOutputCache();
app.UseSerilogRequestLogging();

app.MapControllers();
app.MapHub<SOSAlertHub>("/hubs/sos-alerts");
app.MapHub<DirectMessageHub>("/hubs/direct-messages");
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));
if (hangfireEnabled)
{
    app.MapHangfireDashboard("/hangfire", new Hangfire.DashboardOptions
    {
        Authorization = Array.Empty<Hangfire.Dashboard.IDashboardAuthorizationFilter>()
    }).RequireAuthorization("RequireAdmin");
}

app.Run();

static void FreeDevelopmentPort(int port)
{
    try
    {
        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, port);
        listener.Start();
        listener.Stop();
        return;
    }
    catch (System.Net.Sockets.SocketException) { }

    try
    {
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "netstat",
            Arguments = "-ano",
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var proc = System.Diagnostics.Process.Start(psi)!;
        var output = proc.StandardOutput.ReadToEnd();
        proc.WaitForExit();

        foreach (var line in output.Split('\n'))
        {
            if (line.Contains($":{port}") && line.Contains("LISTENING"))
            {
                var parts = line.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length > 0 && int.TryParse(parts[^1], out var pid) && pid != Environment.ProcessId)
                {
                    try
                    {
                        var target = System.Diagnostics.Process.GetProcessById(pid);
                        Log.Warning("Port {Port} occupied by PID {Pid} ({Name}) — auto-killing zombie process",
                            port, pid, target.ProcessName);
                        target.Kill(entireProcessTree: true);
                        target.WaitForExit(5000);
                    }
                    catch (ArgumentException) { }
                    Thread.Sleep(500);
                }
            }
        }
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Could not auto-free port {Port}", port);
    }
}

static string BuildHangfireConnectionString(IConfiguration configuration, string defaultConnectionString)
{
    var configuredConnectionString = configuration.GetConnectionString("HangfireConnection");
    var builder = new Npgsql.NpgsqlConnectionStringBuilder(
        string.IsNullOrWhiteSpace(configuredConnectionString) ? defaultConnectionString : configuredConnectionString)
    {
        Pooling = false,
        Enlist = false,
        NoResetOnClose = false
    };

    var host = builder.Host ?? string.Empty;

    if (host.EndsWith(".pooler.supabase.com", StringComparison.OrdinalIgnoreCase))
    {
        Log.Warning("Hangfire is using a Supabase pooler connection. Configure ConnectionStrings:HangfireConnection with a direct database host if startup installation still fails.");
    }

    return builder.ConnectionString;
}

static ForwardedHeadersOptions BuildForwardedHeadersOptions(IConfiguration configuration)
{
    var options = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        ForwardLimit = configuration.GetValue<int?>("ReverseProxy:ForwardLimit") ?? 2,
    };

    var knownProxies = configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [];
    var knownNetworks = configuration.GetSection("ReverseProxy:KnownNetworks").Get<string[]>() ?? [];

    // Always clear defaults — the default KnownProxies only trusts 127.0.0.1,
    // which breaks X-Forwarded-Proto on Azure where the load balancer isn't localhost.
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();

    if (knownProxies.Length == 0 && knownNetworks.Length == 0)
        return options;

    foreach (var proxy in knownProxies)
    {
        if (IPAddress.TryParse(proxy, out var ipAddress))
            options.KnownProxies.Add(ipAddress);
        else
            Log.Warning("Ignoring invalid ReverseProxy:KnownProxies entry {Proxy}", proxy);
    }

    foreach (var network in knownNetworks)
    {
        if (TryParseIpNetwork(network, out var ipNetwork))
            options.KnownIPNetworks.Add(ipNetwork);
        else
            Log.Warning("Ignoring invalid ReverseProxy:KnownNetworks entry {Network}", network);
    }

    return options;
}

static string BuildAppConnectionString(string connectionString)
{
    var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);

    if (IsSupabasePoolerConnection(connectionString))
    {
        // Npgsql local pooling stays ENABLED (default) — reuses TCP connections locally.
        // PgBouncer handles server-side pooling; Npgsql pooling on top is fine and critical for performance.
        builder.Enlist = false;          // No distributed transactions (PgBouncer incompatible)
        builder.NoResetOnClose = true;   // Skip DISCARD ALL — PgBouncer handles session cleanup
        builder.MaxPoolSize = 5;         // Supabase free tier pool_size ~15-20; keep well under to avoid MaxClientsInSessionMode
        builder.MinPoolSize = 1;         // Keep at least 1 warm connection for fast first request
        builder.ConnectionIdleLifetime = 60; // Close idle connections after 60s to free pool slots
    }

    return builder.ConnectionString;
}

static bool IsSupabasePoolerConnection(string connectionString)
{
    var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
    var host = builder.Host ?? string.Empty;
    return host.EndsWith(".pooler.supabase.com", StringComparison.OrdinalIgnoreCase);
}

static bool ShouldEnableHangfire(string connectionString)
{
    return !IsSupabasePoolerConnection(connectionString);
}

static bool TryParseIpNetwork(string value, out System.Net.IPNetwork ipNetwork)
{
    ipNetwork = default;

    var parts = value.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
    if (parts.Length != 2)
        return false;

    if (!IPAddress.TryParse(parts[0], out var prefix) || !int.TryParse(parts[1], out var prefixLength))
        return false;

    ipNetwork = new System.Net.IPNetwork(prefix, prefixLength);
    return true;
}

static async Task<AuthUserStateCacheEntry?> GetCachedAuthUserStateAsync(HttpContext httpContext, string userId)
{
    var cache = httpContext.RequestServices.GetRequiredService<IMemoryCache>();
    var cacheKey = AuthValidationCacheKeys.UserState(userId);

    if (cache.TryGetValue(cacheKey, out AuthUserStateCacheEntry? cached) && cached != null)
        return cached;

    var userManager = httpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var userState = await userManager.Users
        .AsNoTracking()
        .Where(u => u.Id == userId)
        .Select(u => new AuthUserStateCacheEntry(
            u.Id,
            u.Role,
            u.IsSuspended,
            u.SuspendedUntil,
            u.SecurityStamp ?? string.Empty))
        .FirstOrDefaultAsync(httpContext.RequestAborted);

    if (userState == null)
        return null;

    cache.Set(cacheKey, userState, GetAuthUserStateCacheDuration(userState));
    return userState;
}

static TimeSpan GetAuthUserStateCacheDuration(AuthUserStateCacheEntry userState)
{
    var defaultTtl = TimeSpan.FromSeconds(30);

    if (userState.IsSuspended && userState.SuspendedUntil is { } suspendedUntil)
    {
        var remaining = suspendedUntil - DateTime.UtcNow;
        if (remaining > TimeSpan.Zero && remaining < defaultTtl)
            return remaining;
    }

    return defaultTtl;
}

static async Task SeedDevelopmentAdminAsync(WebApplication app)
{
    if (!app.Configuration.GetValue("DevelopmentAdmin:Enabled", true))
    {
        Log.Information("Development admin seeding is disabled by configuration.");
        return;
    }

    using var scope = app.Services.CreateScope();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DevelopmentAdminSeed");

    var email = app.Configuration["DevelopmentAdmin:Email"] ?? "admin_test@reliefconnect.vn";
    var userName = app.Configuration["DevelopmentAdmin:Username"] ?? "admin_test";
    var password = app.Configuration["DevelopmentAdmin:Password"] ?? "Admin@123";
    var fullName = app.Configuration["DevelopmentAdmin:FullName"] ?? "Development Admin";

    try
    {
        var user = await userManager.FindByEmailAsync(email) ?? await userManager.FindByNameAsync(userName);
        var created = false;

        if (user == null)
        {
            user = new ApplicationUser
            {
                UserName = userName,
                Email = email,
                FullName = fullName,
                Role = RoleEnum.Admin,
                VerificationStatus = VerificationStatus.Approved,
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };

            var createResult = await userManager.CreateAsync(user, password);
            if (!createResult.Succeeded)
            {
                logger.LogWarning("Could not create development admin account {Email}: {Errors}", email, string.Join("; ", createResult.Errors.Select(e => e.Description)));
                return;
            }

            created = true;
        }

        var needsUpdate = false;

        if (!string.Equals(user.UserName, userName, StringComparison.Ordinal))
        {
            user.UserName = userName;
            needsUpdate = true;
        }

        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            user.Email = email;
            needsUpdate = true;
        }

        if (!string.Equals(user.FullName, fullName, StringComparison.Ordinal))
        {
            user.FullName = fullName;
            needsUpdate = true;
        }

        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            needsUpdate = true;
        }

        if (user.Role != RoleEnum.Admin)
        {
            user.Role = RoleEnum.Admin;
            needsUpdate = true;
        }

        if (user.VerificationStatus != VerificationStatus.Approved)
        {
            user.VerificationStatus = VerificationStatus.Approved;
            needsUpdate = true;
        }

        if (needsUpdate)
        {
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                logger.LogWarning("Could not update development admin account {Email}: {Errors}", email, string.Join("; ", updateResult.Errors.Select(e => e.Description)));
                return;
            }
        }

        if (!await userManager.CheckPasswordAsync(user, password))
        {
            IdentityResult passwordResult;

            if (await userManager.HasPasswordAsync(user))
            {
                var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
                passwordResult = await userManager.ResetPasswordAsync(user, resetToken, password);
            }
            else
            {
                passwordResult = await userManager.AddPasswordAsync(user, password);
            }

            if (!passwordResult.Succeeded)
            {
                logger.LogWarning("Could not normalize password for development admin account {Email}: {Errors}", email, string.Join("; ", passwordResult.Errors.Select(e => e.Description)));
                return;
            }
        }

        logger.LogInformation("Development admin account ready: {Email} (created: {Created})", email, created);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Failed to seed development admin account {Email}", email);
    }
}
