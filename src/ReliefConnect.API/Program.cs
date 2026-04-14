using System.Text;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ReliefConnect.API.Hubs;
using ReliefConnect.API.Middleware;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;
using ReliefConnect.Infrastructure.Repositories;
using ReliefConnect.Infrastructure.Services;
using Serilog;

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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        connectionString,
        npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorCodesToAdd: null);
            npgsqlOptions.MaxBatchSize(100);
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
            if (context.Request.Cookies.TryGetValue("auth_token", out var token))
                context.Token = token;
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var blacklist = context.HttpContext.RequestServices.GetRequiredService<ITokenBlacklistService>();
            var jti = context.Principal?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
            if (jti != null && blacklist.IsBlacklisted(jti))
            {
                context.Fail("Token revoked");
            }
            return Task.CompletedTask;
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
    ?? new[] { "http://localhost:5173", "http://localhost:5174", "http://localhost:5175" };

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
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddSingleton<IGeminiService, GeminiService>();
builder.Services.AddScoped<ITokenBlacklistService, TokenBlacklistService>();
builder.Services.AddSingleton<Ganss.Xss.HtmlSanitizer>();

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

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    FreeDevelopmentPort(5164);
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ═══════════════════════════════════════════
//  MIDDLEWARE PIPELINE
// ═══════════════════════════════════════════
app.UseResponseCompression();
app.UseGlobalExceptionHandler();
app.UseHttpsRedirection();
app.UseStaticFiles();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self';";
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

static bool ShouldEnableHangfire(string connectionString)
{
    var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
    var host = builder.Host ?? string.Empty;
    return !host.EndsWith(".pooler.supabase.com", StringComparison.OrdinalIgnoreCase);
}
