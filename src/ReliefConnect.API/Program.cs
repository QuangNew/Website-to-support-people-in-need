using System.Text;
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
    .CreateLogger();

builder.Host.UseSerilog();

// ═══════════════════════════════════════════
//  DATABASE (Supabase PostgreSQL + PostGIS)
// ═══════════════════════════════════════════
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    ));

// ═══════════════════════════════════════════
//  ASP.NET CORE IDENTITY
// ═══════════════════════════════════════════
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    // Password rules per SRS 4.2
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;

    // Lockout
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;

    // User
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// ═══════════════════════════════════════════
//  JWT AUTHENTICATION
// ═══════════════════════════════════════════
var jwtKey = builder.Configuration["Jwt:Key"] ?? "DefaultDevSecretKey_ChangeInProduction_Min32Chars!!";
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

    // SignalR JWT support (token from query string)
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
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
// Support multiple frontend origins (Vite may auto-increment port)
var frontendUrls = builder.Configuration.GetSection("Frontend:Urls").Get<string[]>()
    ?? new[]
    {
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175"
    };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(frontendUrls)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // Required for SignalR
    });
});

// ═══════════════════════════════════════════
//  CONTROLLERS + SIGNALR + SWAGGER
// ═══════════════════════════════════════════
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ═══════════════════════════════════════════
//  DEPENDENCY INJECTION (Repositories + Services)
// ═══════════════════════════════════════════
builder.Services.AddScoped<IPingRepository, PingRepository>();
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddSingleton<IGeminiService, GeminiService>();

// ═══════════════════════════════════════════
//  BUILD APP
// ═══════════════════════════════════════════
var app = builder.Build();

// Development
if (app.Environment.IsDevelopment())
{
    // Auto-kill zombie dotnet processes occupying our port from previous runs
    FreeDevelopmentPort(5164);

    app.UseSwagger();
    app.UseSwaggerUI();
}

// Middleware pipeline
app.UseGlobalExceptionHandler();
app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseSerilogRequestLogging();

// Map controllers
app.MapControllers();

// SignalR hubs
app.MapHub<SOSAlertHub>("/hubs/sos-alerts");

app.Run();

// ═══════════════════════════════════════════
//  DEV UTILITY: Auto-free port from zombie processes
// ═══════════════════════════════════════════
static void FreeDevelopmentPort(int port)
{
    // Quick check: try binding to see if port is free
    try
    {
        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, port);
        listener.Start();
        listener.Stop();
        return; // Port is free — nothing to do
    }
    catch (System.Net.Sockets.SocketException) { /* Port occupied — proceed to kill */ }

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
                if (parts.Length > 0
                    && int.TryParse(parts[^1], out var pid)
                    && pid != Environment.ProcessId)
                {
                    try
                    {
                        var target = System.Diagnostics.Process.GetProcessById(pid);
                        Log.Warning("Port {Port} occupied by PID {Pid} ({Name}) — auto-killing zombie process",
                            port, pid, target.ProcessName);
                        target.Kill(entireProcessTree: true);
                        target.WaitForExit(5000);
                    }
                    catch (ArgumentException) { /* Process already exited */ }
                    Thread.Sleep(500); // Let OS release the socket
                }
            }
        }
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Could not auto-free port {Port}", port);
    }
}
