using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.API.Extensions;
using ReliefConnect.Core;
using ReliefConnect.Core.DTOs;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Controllers;

[ApiController]
[Route("api/admin/api-keys")]
[Authorize(Policy = "RequireAdmin")]
public class ApiKeyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAiChatService _aiChatService;
    private readonly ILogger<ApiKeyController> _logger;

    public ApiKeyController(AppDbContext db, IAiChatService aiChatService, ILogger<ApiKeyController> logger)
    {
        _db = db;
        _aiChatService = aiChatService;
        _logger = logger;
    }

    /// <summary>List all API keys (masked).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ApiKeyResponseDto>>> GetAll()
    {
        var keys = await _db.ApiKeys
            .AsNoTracking()
            .OrderByDescending(k => k.CreatedAt)
            .ToListAsync();

        return Ok(keys.Select(MapToDto));
    }

    /// <summary>Catalog providers and model suggestions for the API key pool.</summary>
    [HttpGet("catalog")]
    public ActionResult<ApiKeyCatalogDto> GetCatalog()
    {
        return Ok(new ApiKeyCatalogDto
        {
            Providers = AiProviderCatalog.Providers.Select(provider => new ApiKeyProviderCatalogDto
            {
                Value = provider.Value,
                Label = provider.Label,
                DefaultModel = provider.DefaultModel,
                Models = provider.Models.Select(model => new ApiKeyModelCatalogDto
                {
                    Value = model.Value,
                    Label = model.Label,
                    SupportsImages = model.SupportsImages,
                }).ToList()
            }).ToList()
        });
    }

    /// <summary>Add a new API key.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiKeyResponseDto>> Create([FromBody] CreateApiKeyDto dto)
    {
        if (!AiProviderCatalog.TryNormalizeProvider(dto.Provider, out var provider))
            return BadRequest(InvalidProviderResponse());

        var model = AiProviderCatalog.NormalizeModel(provider, dto.Model);
        if (!AiProviderCatalog.IsModelAllowed(provider, model))
            return BadRequest(InvalidModelResponse(provider));

        var entity = new ApiKey
        {
            Provider = provider,
            Label = dto.Label.Trim(),
            KeyValue = dto.KeyValue.Trim(),
            Model = model,
            IsActive = true,
        };

        _db.ApiKeys.Add(entity);
        await _db.SaveChangesAsync();
        await this.LogUserActivity(_db, "ApiKeyCreated", $"Created API key #{entity.Id}; apiKey={entity.Id}; provider={entity.Provider}; label={entity.Label}; model={entity.Model}; active={entity.IsActive}");

        _logger.LogInformation("API key created: {Label} ({Provider})", entity.Label, entity.Provider);

        return Ok(MapToDto(entity));
    }

    /// <summary>Update an API key.</summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiKeyResponseDto>> Update(int id, [FromBody] UpdateApiKeyDto dto)
    {
        var key = await _db.ApiKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(k => k.Id == id);
        if (key == null) return NotFound();

        var hasUpdateField = dto.Provider != null || dto.Label != null || dto.KeyValue != null || dto.Model != null || dto.IsActive.HasValue;
        if (!hasUpdateField)
            return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "No API key update fields were provided." });

        var nextProvider = key.Provider;
        var nextLabel = key.Label;
        var nextKeyValue = key.KeyValue;
        var nextModel = key.Model;
        var nextIsActive = key.IsActive;
        var changed = false;
        var activeChanged = false;
        var keyValueChanged = false;
        var poolSelectionChanged = false;

        if (dto.Provider != null)
        {
            var trimmedProvider = dto.Provider.Trim();
            if (trimmedProvider.Length == 0)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Provider is required." });

            if (!AiProviderCatalog.TryNormalizeProvider(trimmedProvider, out var provider))
                return BadRequest(InvalidProviderResponse());

            if (AiProviderCatalog.NormalizeProvider(key.Provider) != provider)
            {
                nextProvider = provider;
                nextModel = AiProviderCatalog.GetDefaultModel(provider);
                changed = true;
                poolSelectionChanged = true;
            }
        }

        if (dto.Label != null)
        {
            var trimmedLabel = dto.Label.Trim();
            if (trimmedLabel.Length == 0)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Label is required." });

            if (key.Label != trimmedLabel)
            {
                nextLabel = trimmedLabel;
                changed = true;
            }
        }

        if (dto.KeyValue != null)
        {
            var trimmedKeyValue = dto.KeyValue.Trim();
            if (trimmedKeyValue.Length == 0)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "API key value cannot be empty." });

            if (key.KeyValue != trimmedKeyValue)
            {
                nextKeyValue = trimmedKeyValue;
                changed = true;
                keyValueChanged = true;
            }
        }

        if (dto.Model != null)
        {
            var trimmedModel = dto.Model.Trim();
            if (trimmedModel.Length == 0)
                return BadRequest(new ApiErrorResponse { StatusCode = 400, Message = "Model is required." });

            var normalizedModel = AiProviderCatalog.NormalizeModel(nextProvider, trimmedModel);
            if (!AiProviderCatalog.IsModelAllowed(nextProvider, normalizedModel))
                return BadRequest(InvalidModelResponse(nextProvider));

            if (!string.Equals(key.Model, normalizedModel, StringComparison.OrdinalIgnoreCase))
            {
                nextModel = normalizedModel;
                changed = true;
                poolSelectionChanged = true;
            }
        }

        if (dto.IsActive.HasValue && key.IsActive != dto.IsActive.Value)
        {
            nextIsActive = dto.IsActive.Value;
            changed = true;
            activeChanged = true;
        }

        if (!changed)
            return Ok(MapToDto(key));

        var updatedRows = await _db.ApiKeys
            .Where(k => k.Id == id)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(k => k.Provider, nextProvider)
                .SetProperty(k => k.Label, nextLabel)
                .SetProperty(k => k.KeyValue, nextKeyValue)
                .SetProperty(k => k.Model, nextModel)
                .SetProperty(k => k.IsActive, nextIsActive)
                .SetProperty(k => k.UsageCount, k => keyValueChanged || poolSelectionChanged ? 0 : k.UsageCount)
                .SetProperty(k => k.LastUsedAt, k => keyValueChanged || poolSelectionChanged ? null : k.LastUsedAt)
                .SetProperty(k => k.FailureCount, k => keyValueChanged || poolSelectionChanged ? 0 : k.FailureCount)
                .SetProperty(k => k.LastFailedAt, k => keyValueChanged || poolSelectionChanged ? null : k.LastFailedAt)
                .SetProperty(k => k.CooldownUntil, k => keyValueChanged || poolSelectionChanged ? null : k.CooldownUntil)
                .SetProperty(k => k.LastErrorCode, k => keyValueChanged || poolSelectionChanged ? null : k.LastErrorCode)
                .SetProperty(k => k.LastErrorMessage, k => keyValueChanged || poolSelectionChanged ? null : k.LastErrorMessage));

        if (updatedRows == 0) return NotFound();

        var updatedKey = await _db.ApiKeys
            .AsNoTracking()
            .FirstAsync(k => k.Id == id);

        var action = activeChanged && dto.IsActive.HasValue
            ? dto.IsActive.Value ? "ApiKeyActivated" : "ApiKeyDeactivated"
            : "ApiKeyUpdated";
        await this.LogUserActivity(_db, action, $"{action} API key #{updatedKey.Id}; apiKey={updatedKey.Id}; provider={updatedKey.Provider}; label={updatedKey.Label}; model={updatedKey.Model}; active={updatedKey.IsActive}");
        _logger.LogInformation("API key updated: {Id}; rows={Rows}", id, updatedRows);

        return Ok(MapToDto(updatedKey));
    }

    /// <summary>Test one API key without using chatbot quota.</summary>
    [HttpPost("{id}/test")]
    public async Task<ActionResult<ApiKeyTestResponseDto>> TestConnection(int id)
    {
        var result = await _aiChatService.TestApiKeyAsync(id, HttpContext.RequestAborted);
        var key = await _db.ApiKeys.AsNoTracking().FirstOrDefaultAsync(k => k.Id == id);

        return Ok(new ApiKeyTestResponseDto
        {
            Success = result.Success,
            Message = result.Message,
            ErrorCode = result.ErrorCode,
            CooldownUntil = result.CooldownUntil,
            ApiKey = key == null ? null : MapToDto(key),
        });
    }

    /// <summary>Delete an API key.</summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key == null) return NotFound();

        _db.ApiKeys.Remove(key);
        await _db.SaveChangesAsync();
        await this.LogUserActivity(_db, "ApiKeyDeleted", $"Deleted API key #{id}; apiKey={id}; provider={key.Provider}; label={key.Label}; model={key.Model}; active={key.IsActive}");
        _logger.LogInformation("API key deleted: {Id} ({Label})", id, key.Label);

        return Ok(new { message = "API key deleted." });
    }

    private static ApiKeyResponseDto MapToDto(ApiKey key) => new()
    {
        Id = key.Id,
        Provider = AiProviderCatalog.GetProviderValue(key.Provider),
        Label = key.Label,
        MaskedKey = MaskKey(key.KeyValue),
        Model = AiProviderCatalog.NormalizeModel(key.Provider, key.Model),
        IsActive = key.IsActive,
        UsageCount = key.UsageCount,
        LastUsedAt = key.LastUsedAt,
        FailureCount = key.FailureCount,
        LastFailedAt = key.LastFailedAt,
        CooldownUntil = key.CooldownUntil,
        LastErrorCode = key.LastErrorCode,
        LastErrorMessage = key.LastErrorMessage,
        HealthStatus = GetHealthStatus(key),
        CreatedAt = key.CreatedAt,
    };

    private static string GetHealthStatus(ApiKey key)
    {
        if (!key.IsActive) return "Disabled";
        if (key.CooldownUntil.HasValue && key.CooldownUntil.Value > DateTime.UtcNow) return "CoolingDown";
        if (key.FailureCount > 0) return "Failed";
        return "Healthy";
    }

    private static ApiErrorResponse InvalidProviderResponse() => new()
    {
        StatusCode = 400,
        Message = "Invalid provider. Use: Gemini, OpenAI, Anthropic, or NVIDIA NIM."
    };

    private static ApiErrorResponse InvalidModelResponse(AiProvider provider) => new()
    {
        StatusCode = 400,
        Message = $"Invalid model for {AiProviderCatalog.GetProviderLabel(provider)}. Choose one of: {string.Join(", ", AiProviderCatalog.GetProvider(provider)?.Models.Select(m => m.Value) ?? Array.Empty<string>())}."
    };

    private static string MaskKey(string key)
    {
        if (key.Length <= 12) return "****";
        return key[..8] + "****" + key[^4..];
    }
}
