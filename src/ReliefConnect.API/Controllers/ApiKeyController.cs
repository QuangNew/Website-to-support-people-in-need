using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/admin/api-keys")]
[Authorize(Policy = "RequireAdmin")]
public class ApiKeyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<ApiKeyController> _logger;

    public ApiKeyController(AppDbContext db, ILogger<ApiKeyController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>List all API keys (masked).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ApiKeyResponseDto>>> GetAll()
    {
        var keys = await _db.ApiKeys
            .AsNoTracking()
            .OrderByDescending(k => k.CreatedAt)
            .Select(k => new ApiKeyResponseDto
            {
                Id = k.Id,
                Provider = k.Provider.ToString(),
                Label = k.Label,
                MaskedKey = MaskKey(k.KeyValue),
                Model = k.Model,
                IsActive = k.IsActive,
                UsageCount = k.UsageCount,
                LastUsedAt = k.LastUsedAt,
                CreatedAt = k.CreatedAt,
            })
            .ToListAsync();

        return Ok(keys);
    }

    /// <summary>Add a new API key.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiKeyResponseDto>> Create([FromBody] CreateApiKeyDto dto)
    {
        if (!Enum.TryParse<AiProvider>(dto.Provider, true, out var provider))
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Invalid provider. Use: Gemini, Claude, or GPT." });

        var entity = new ApiKey
        {
            Provider = provider,
            Label = dto.Label,
            KeyValue = dto.KeyValue,
            Model = dto.Model,
            IsActive = true,
        };

        _db.ApiKeys.Add(entity);
        await _db.SaveChangesAsync();

        _logger.LogInformation("API key created: {Label} ({Provider})", dto.Label, dto.Provider);

        return Ok(new ApiKeyResponseDto
        {
            Id = entity.Id,
            Provider = entity.Provider.ToString(),
            Label = entity.Label,
            MaskedKey = MaskKey(entity.KeyValue),
            Model = entity.Model,
            IsActive = entity.IsActive,
            UsageCount = 0,
            CreatedAt = entity.CreatedAt,
        });
    }

    /// <summary>Update an API key.</summary>
    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateApiKeyDto dto)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key == null) return NotFound();

        if (dto.Label != null) key.Label = dto.Label;
        if (dto.KeyValue != null) key.KeyValue = dto.KeyValue;
        if (dto.Model != null) key.Model = dto.Model;
        if (dto.IsActive.HasValue) key.IsActive = dto.IsActive.Value;

        await _db.SaveChangesAsync();
        _logger.LogInformation("API key updated: {Id}", id);

        return Ok(new { message = "API key updated." });
    }

    /// <summary>Delete an API key.</summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key == null) return NotFound();

        _db.ApiKeys.Remove(key);
        await _db.SaveChangesAsync();
        _logger.LogInformation("API key deleted: {Id} ({Label})", id, key.Label);

        return Ok(new { message = "API key deleted." });
    }

    private static string MaskKey(string key)
    {
        if (key.Length <= 12) return "****";
        return key[..8] + "****" + key[^4..];
    }
}
