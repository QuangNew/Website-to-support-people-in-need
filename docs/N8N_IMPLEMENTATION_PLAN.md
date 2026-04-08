# n8n Workflow Integration — Implementation Plan

> A step-by-step guide for developers with **zero prior n8n experience** to integrate n8n workflows as the primary AI chatbot provider in ReliefConnect.
>
> Version 1.0 · April 8, 2026

---

## Table of Contents

1. [What is n8n?](#1-what-is-n8n)
2. [Why n8n for ReliefConnect?](#2-why-n8n-for-reliefconnect)
3. [Architecture Overview](#3-architecture-overview)
4. [Prerequisites](#4-prerequisites)
5. [Phase 1: Set Up n8n (Local Development)](#5-phase-1-set-up-n8n-local-development)
6. [Phase 2: Build the Basic Chatbot Workflow](#6-phase-2-build-the-basic-chatbot-workflow)
7. [Phase 2B: Configure Dify Knowledge Base (RAG)](#7-phase-2b-configure-dify-knowledge-base-rag)
8. [Phase 3: Backend Integration](#8-phase-3-backend-integration)
9. [Phase 3B: Add RAG + Complexity Routing to n8n](#9-phase-3b-add-rag--complexity-routing-to-n8n)
10. [Phase 4: Dual-Provider Failover](#10-phase-4-dual-provider-failover)
11. [Phase 5: Production Deployment](#11-phase-5-production-deployment)
12. [Phase 6: Advanced Workflows](#12-phase-6-advanced-workflows)
13. [Testing Strategy](#13-testing-strategy)
14. [Troubleshooting](#14-troubleshooting)
15. [Glossary](#15-glossary)

---

## 1. What is n8n?

**n8n** (pronounced "n-eight-n") is an open-source workflow automation platform with a visual node-based editor. Think of it as a programmable pipeline builder where you connect **nodes** (actions) with **connections** (data flows) to create automated **workflows**.

### Key Concepts

| Concept | What It Is | Analogy |
|---------|-----------|---------|
| **Node** | A single action (e.g., "Call Gemini API", "Send HTTP Request") | A function in code |
| **Connection** | A data pipe between two nodes | A function call passing return values |
| **Workflow** | A complete chain of nodes | A program / pipeline |
| **Trigger** | The event that starts a workflow (e.g., webhook received) | An HTTP endpoint / event handler |
| **Execution** | One run of a workflow with specific input data | A single request/response cycle |
| **Credential** | Stored authentication secret (API key, OAuth token) | Environment variable / secret |

### How It Looks

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌───────────────────┐
│  Webhook     │────▶│  Process     │────▶│  Google Gemini  │────▶│  Respond to       │
│  (trigger)   │     │  Input       │     │  (AI model)     │     │  Webhook          │
└─────────────┘     └──────────────┘     └─────────────────┘     └───────────────────┘
```

You build this visually by dragging nodes onto a canvas, configuring each one, and drawing connections between them.

### n8n vs. Writing Code Directly

| Aspect | Direct Code | n8n Workflow |
|--------|------------|-------------|
| AI model swap | Code change + deploy | Click → select new model |
| Add RAG/memory | Write integration code | Drag & drop Memory node |
| Error handling | try/catch blocks | Built-in retry + error workflows |
| Monitoring | Custom logging | Dashboard with execution history |
| Non-developer changes | Impossible | Visual editor accessible to anyone |
| Multi-step AI chains | Complex orchestration code | Connect nodes visually |

---

## 2. Why n8n for ReliefConnect?

### Current Architecture (Direct Gemini API)

```
Frontend ──▶ ASP.NET API ──▶ GeminiService ──▶ Google Gemini API
                                                    ↓
Frontend ◀── ASP.NET API ◀── Response ◀─────────────┘
```

**Limitations**:
- Changing AI models requires code changes and redeployment
- No visual debugging of AI conversations
- Adding features (RAG, memory, multi-step chains) requires substantial code
- Non-developers cannot modify chatbot behavior

### Target Architecture (n8n + Fallback)

```
                              ┌──────────────────────┐
                              │       n8n Server      │
                              │  ┌─────────────────┐  │
Frontend ──▶ ASP.NET API ─────┤  │  AI Chatbot     │  │
                         │    │  │  Workflow        │  │
                         │    │  └─────────────────┘  │
                         │    └──────────────────────┘
                         │              │
                         │    (if n8n is down)
                         │              │
                         └──▶ GeminiService (fallback)
```

**Benefits**:
- Swap AI models (Gemini → GPT → Claude) without code changes
- Visual conversation flow debugging in n8n dashboard
- Add RAG, memory buffers, and multi-step chains visually
- Admin/product team can adjust chatbot behavior without developer involvement
- Built-in execution logging and retry mechanisms

---

## 3. Architecture Overview

### Dual-Provider Design

```
┌─────────────────────────────────────────────────────────────┐
│                    ASP.NET Core API                          │
│                                                             │
│  ChatbotController                                          │
│       │                                                     │
│       ▼                                                     │
│  IChatbotProvider (new interface)                            │
│       │                                                     │
│       ├──▶ N8nChatbotProvider (primary)                     │
│       │       │                                             │
│       │       ├── Health check: GET {n8n}/healthz           │
│       │       └── Chat:   POST {n8n}/webhook/chatbot        │
│       │                                                     │
│       └──▶ GeminiChatbotProvider (fallback)                 │
│               │                                             │
│               └── Existing GeminiService (unchanged)        │
│                                                             │
│  DualChatbotProvider (orchestrator)                          │
│       - Checks n8n health (cached 30s)                      │
│       - Routes to n8n if healthy                            │
│       - Falls back to Gemini on failure                     │
│       - Logs provider selection                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    n8n Workflow Server                       │
│                                                             │
│  Webhook Node                                               │
│       │ receives: { message, history[], image?, mimeType? } │
│       ▼                                                     │
│  Set Node (format input)                                    │
│       │                                                     │
│       ▼                                                     │
│  IF Node: has emergency keywords?                           │
│       │ yes ──▶ Set SafetyWarning = true                    │
│       │ no  ──▶ continue                                    │
│       ▼                                                     │
│  AI Agent Node (Google Gemini Chat Model + Memory)          │
│       │                                                     │
│       ▼                                                     │
│  Respond to Webhook Node                                    │
│       │ returns: { response, hasSafetyWarning }             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Prerequisites

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Docker Desktop | Latest | Run n8n in container |
| Node.js | 18+ | n8n CLI (optional alternative to Docker) |
| .NET SDK | 10.0 | ASP.NET Core backend |
| pnpm | 10.x | Frontend package manager |

### Accounts & Keys

| Account | Purpose | How to Get |
|---------|---------|-----------|
| Google Gemini API Key | AI chatbot responses | [Google AI Studio](https://aistudio.google.com/apikey) |
| n8n Account (optional) | Cloud hosting | [n8n.io](https://n8n.io) (free tier available) |

---

## 5. Phase 1: Set Up n8n (Local Development)

**Estimated complexity**: Low · **Files changed**: 0 (infrastructure only)

### Option A: Docker (Recommended)

#### Step 1: Create `docker-compose.n8n.yml`

Create this file in the project root:

```yaml
# docker-compose.n8n.yml
# n8n workflow automation server for ReliefConnect chatbot
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: reliefconnect-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      # Basic configuration
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/

      # Security
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=reliefconnect2026

      # Execution settings
      - EXECUTIONS_DATA_SAVE_ON_ERROR=all
      - EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
      - EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true

      # Timezone (Vietnam)
      - GENERIC_TIMEZONE=Asia/Ho_Chi_Minh
      - TZ=Asia/Ho_Chi_Minh
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
    driver: local
```

#### Step 2: Start n8n

```powershell
# Start n8n
docker compose -f docker-compose.n8n.yml up -d

# Verify it's running
docker ps | Select-String "n8n"

# View logs
docker logs reliefconnect-n8n --tail 50
```

#### Step 3: Access n8n

Open `http://localhost:5678` in your browser.

- **First time**: Create an owner account (email + password)
- **Subsequent visits**: Login with your account credentials

> **Security Note**: The `N8N_BASIC_AUTH_*` variables protect the n8n API. Your owner account credentials protect the n8n UI. These are separate authentication layers.

### Option B: npm (Alternative)

```powershell
# Install n8n globally
npm install -g n8n

# Start n8n
n8n start

# Or start with a specific port
n8n start --port 5678
```

### Verify Installation

After starting, confirm n8n is accessible:

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:5678/healthz" -Method Get
# Expected: { "status": "ok" }
```

---

## 6. Phase 2: Build the Basic Chatbot Workflow

**Estimated complexity**: Medium · **Files changed**: 0 (n8n UI only)

### Step 1: Create a New Workflow

1. In n8n, click **"Add workflow"** (+ button, top-left)
2. Name it: `ReliefConnect Chatbot`

### Step 2: Add a Webhook Trigger

1. Click the **"+"** button on the canvas
2. Search for **"Webhook"** and add it
3. Configure:

| Setting | Value |
|---------|-------|
| HTTP Method | POST |
| Path | `chatbot` |
| Authentication | Header Auth |
| Name | `X-N8N-Auth` |
| Value | `your-secret-key-here` (generate a strong random key) |
| Response Mode | **Response Node** (important!) |

> **The webhook URL will be**: `http://localhost:5678/webhook/chatbot` (production) or `http://localhost:5678/webhook-test/chatbot` (testing)

### Step 3: Add Input Processing (Set Node)

1. Add a **"Set"** node after the Webhook
2. Configure these output fields:

| Field Name | Value (Expression) | Type |
|------------|-------------------|------|
| `userMessage` | `{{ $json.body.message }}` | String |
| `hasImage` | `{{ $json.body.imageBase64 ? true : false }}` | Boolean |
| `imageBase64` | `{{ $json.body.imageBase64 ?? '' }}` | String |
| `imageMimeType` | `{{ $json.body.imageMimeType ?? '' }}` | String |
| `conversationHistory` | `{{ $json.body.history ?? [] }}` | Array |

### Step 4: Add Emergency Keyword Detection (IF Node)

1. Add an **"IF"** node after the Set node
2. Configure condition:

```
Value 1: {{ $json.userMessage.toLowerCase() }}
Operation: Contains
Value 2: (use Add OR conditions for each keyword)
```

Emergency keywords to add as OR conditions:
- `đau tim`
- `ngộ độc`
- `chảy máu`
- `ngừng thở`
- `cấp cứu`
- `heart attack`
- `poisoning`
- `bleeding`
- `emergency`
- `accident`

3. Name the True output: `Emergency`
4. Name the False output: `Normal`

### Step 5: Add Google Gemini Credential

Before adding the AI node, set up the credential:

1. Go to **Settings → Credentials** (or the credential modal in a node)
2. Click **"Add Credential"**
3. Search for **"Google Gemini (PaLM) API"** (or "Google AI")
4. Configure:

| Setting | Value |
|---------|-------|
| API Key | Your Gemini API key |

5. Save and name it: `ReliefConnect Gemini`

### Step 6: Add AI Agent Node (Normal Path)

1. From the **False** (Normal) output of the IF node, add an **"AI Agent"** node
2. Configure:

| Setting | Value |
|---------|-------|
| Agent Type | Conversational Agent |
| System Message | (paste the system prompt below) |
| Input Text | `{{ $('Set').item.json.userMessage }}` |

**System Message:**
```
Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam.
Nhiệm vụ: giúp người dùng tìm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, trả lời câu hỏi về tình hình thiên tai.
Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt. Nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh.
Không trả lời các nội dung nhạy cảm, chính trị, vi phạm pháp luật.
```

3. **Sub-nodes** — Click on the AI Agent node and add:
   - **Chat Model**: Google Gemini Chat Model
     - Model: `gemini-2.5-flash` (or `gemini-3-flash`)
     - Temperature: `0.7`
     - Max Tokens: `1024`
   - **Memory**: Window Buffer Memory
     - Context Window Length: `20` (matches our existing 20-message history)

### Step 7: Add Emergency Response (Set Node for True Path)

1. From the **True** (Emergency) output of the IF node, add a **"Set"** node
2. Name it: `Emergency Response`
3. Then connect it to the same AI Agent node (or a separate one)
4. After the AI Agent, add another **"Set"** node to flag the safety warning:

| Field Name | Value | Type |
|------------|-------|------|
| `response` | `{{ $json.output }}` | String |
| `hasSafetyWarning` | `true` | Boolean |

### Step 8: Add Normal Response (Set Node)

After the AI Agent (normal path), add a **"Set"** node:

| Field Name | Value | Type |
|------------|-------|------|
| `response` | `{{ $json.output }}` | String |
| `hasSafetyWarning` | `false` | Boolean |

### Step 9: Add Respond to Webhook Node

1. Add a **"Respond to Webhook"** node
2. Connect BOTH the emergency and normal response Set nodes to it
3. Configure:

| Setting | Value |
|---------|-------|
| Response Code | 200 |
| Response Body | JSON |
| Response Data | (Expression mode) |

JSON body:
```json
{
  "response": "{{ $json.response }}",
  "hasSafetyWarning": {{ $json.hasSafetyWarning }}
}
```

### Step 10: Test the Workflow

1. Click **"Test workflow"** (play button) in n8n
2. Send a test request from PowerShell:

```powershell
$body = @{
    message = "Xin chào, tôi cần giúp đỡ"
    history = @()
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:5678/webhook-test/chatbot" `
    -Method Post `
    -ContentType "application/json" `
    -Headers @{ "X-N8N-Auth" = "your-secret-key-here" } `
    -Body $body
```

3. In n8n, you should see the execution with data flowing through each node
4. The response should contain the Gemini AI's answer

### Complete Workflow Diagram

```
┌─────────────┐     ┌───────┐     ┌──────────┐
│   Webhook    │────▶│  Set  │────▶│    IF     │
│   (POST)     │     │ Input │     │ Emergency?│
└─────────────┘     └───────┘     └────┬──┬───┘
                                       │  │
                              True ────┘  └──── False
                                │              │
                          ┌─────▼─────┐  ┌─────▼─────┐
                          │ Set:      │  │           │
                          │ warning   │  │  AI Agent │
                          │ = true    │  │  (Gemini) │
                          └─────┬─────┘  └─────┬─────┘
                                │              │
                          ┌─────▼─────┐  ┌─────▼─────┐
                          │  AI Agent │  │ Set:      │
                          │  (Gemini) │  │ warning   │
                          └─────┬─────┘  │ = false   │
                                │        └─────┬─────┘
                                │              │
                          ┌─────▼──────────────▼────┐
                          │   Respond to Webhook    │
                          │   { response, warning } │
                          └─────────────────────────┘
```

### Step 11: Activate the Workflow

1. Toggle the **"Active"** switch in the top-right of the workflow editor
2. This makes the webhook available at the **production** URL: `http://localhost:5678/webhook/chatbot`

> **Important**: Test URLs (`/webhook-test/`) only work when the workflow is open in the editor. Production URLs (`/webhook/`) work when the workflow is activated.

---

## 7. Phase 2B: Configure Dify Knowledge Base (RAG)

**Estimated complexity**: Medium · **Files changed**: n8n workflow + Dify UI setup

> **This phase adds Retrieval-Augmented Generation** — the chatbot will search your knowledge base before generating a response, producing grounded, cited answers. Perform this phase after Phase 2. You can run both workflows simultaneously (upgrade iteratively).

### Step 1: Create a Dify Account and Knowledge Base

1. Register at [dify.ai](https://dify.ai) (cloud) or deploy self-hosted via Docker
2. Go to **Knowledge** → **Create Knowledge**
3. Name: `ReliefConnect Aid Knowledge Base`
4. Upload documents:
   - Disaster relief procedures (PDF/DOCX)
   - Platform usage guide (Markdown)
   - Aid eligibility rules
   - Emergency contact directory
   - FAQ compilation

### Step 2: Configure Indexing Settings

In Knowledge Base settings, select:

| Setting | Value |
|---------|-------|
| Index Method | **High Quality** (uses embedding model) |
| Embedding Model | `text-embedding-3-large` (OpenAI) OR `jina-embeddings-v3` |
| Max Tokens Per Chunk | `1024` |
| Chunk Overlap | `100` |
| Separator | `\n\n` |

> **Why High Quality?** Required for hybrid/semantic search. Economy mode only supports BM25 keyword search.

### Step 3: Configure Retrieval Settings

In Dataset Settings → Retrieval Settings:

| Setting | Value |
|---------|-------|
| Search Method | Hybrid Search |
| Reranking Model | Cohere — `rerank-multilingual-v3.0` |
| Top K | 6 |
| Score Threshold | 0.35 |

### Step 4: Get Dify API Keys

1. **Dataset API Key** (for retrieval): Knowledge Settings → API Access
2. **Chatflow API Key** (for generation): Create App → API Access

> These are **two different keys** — do not confuse them.

### Step 5: Create Two Dify Chatflow Apps

**Simple Chatflow** (for routine queries):
- Model: `gemini-2.0-flash` or `gpt-4o-mini`
- Temperature: 0.5
- Add a text input variable: `retrieved_context`
- System prompt includes: `{retrieved_context}` placeholder (see full prompt in [RAG_SYSTEM_ARCHITECTURE.md](RAG_SYSTEM_ARCHITECTURE.md#step-5-create-two-chatflow-apps))

**Complex Chatflow** (for policy/medical/multi-step queries):
- Model: `gemini-2.5-pro` or `gpt-4o`
- Temperature: 0.3 (lower = more precise reasoning)
- Same system prompt template with `{retrieved_context}`

### Step 6: Test Retrieval via Dify Dashboard

1. Knowledge → Your Dataset → **Retrieval Testing**
2. Enter test queries (in Vietnamese and English)
3. Verify relevant chunks are returned with scores > 0.35

### Step 7: Add Dify Credentials to n8n

In n8n → Settings → Credentials → Create New:

| Credential Type | Name | Header Name | Header Value |
|----------------|------|-------------|-------------|
| Header Auth | `Dify Dataset Key` | `Authorization` | `Bearer YOUR_DATASET_KEY` |
| Header Auth | `Dify Simple Chatflow Key` | `Authorization` | `Bearer YOUR_SIMPLE_KEY` |
| Header Auth | `Dify Complex Chatflow Key` | `Authorization` | `Bearer YOUR_COMPLEX_KEY` |

### Step 8: Add n8n Environment Variables

In `docker-compose.n8n.yml`, add environment variables:

```yaml
environment:
  # ... existing vars ...
  - DIFY_BASE_URL=https://api.dify.ai/v1
  - DIFY_DATASET_ID=your-dataset-id-here
```

---

## 8. Phase 3: Backend Integration

**Estimated complexity**: Medium · **Files changed**: 5-7

### Step 1: Add Configuration

Add n8n settings to `appsettings.Development.json`:

```json
{
  "N8n": {
    "BaseUrl": "http://localhost:5678",
    "WebhookPath": "/webhook/chatbot",
    "AuthToken": "your-secret-key-here",
    "HealthCheckPath": "/healthz",
    "TimeoutSeconds": 30,
    "HealthCacheDurationSeconds": 30
  }
}
```

### Step 2: Create IChatbotProvider Interface

Create `src/ReliefConnect.Core/Interfaces/IChatbotProvider.cs`:

```csharp
namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Unified interface for chatbot providers (n8n workflow or direct Gemini API).
/// </summary>
public interface IChatbotProvider
{
    /// <summary>
    /// Send a message and receive an AI response.
    /// </summary>
    Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null);

    /// <summary>
    /// Check if this provider is currently available.
    /// </summary>
    Task<bool> IsAvailableAsync();

    /// <summary>
    /// Display name for logging and diagnostics.
    /// </summary>
    string ProviderName { get; }
}
```

### Step 3: Create N8nChatbotProvider

Create `src/ReliefConnect.Infrastructure/Services/N8nChatbotProvider.cs`:

```csharp
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

public class N8nChatbotProvider : IChatbotProvider
{
    private readonly HttpClient _http;
    private readonly string _webhookUrl;
    private readonly string _healthUrl;
    private readonly string _authToken;
    private readonly ILogger<N8nChatbotProvider> _logger;

    // Cached health check result
    private bool _lastHealthStatus = false;
    private DateTime _lastHealthCheck = DateTime.MinValue;
    private readonly int _healthCacheDuration;

    public string ProviderName => "n8n Workflow";

    public N8nChatbotProvider(IConfiguration config, ILogger<N8nChatbotProvider> logger)
    {
        var baseUrl = config["N8n:BaseUrl"] ?? "http://localhost:5678";
        _webhookUrl = $"{baseUrl}{config["N8n:WebhookPath"] ?? "/webhook/chatbot"}";
        _healthUrl = $"{baseUrl}{config["N8n:HealthCheckPath"] ?? "/healthz"}";
        _authToken = config["N8n:AuthToken"] ?? "";
        _healthCacheDuration = int.Parse(config["N8n:HealthCacheDurationSeconds"] ?? "30");

        _http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(
                int.Parse(config["N8n:TimeoutSeconds"] ?? "30"))
        };
        _logger = logger;
    }

    public async Task<bool> IsAvailableAsync()
    {
        // Return cached result if fresh
        if ((DateTime.UtcNow - _lastHealthCheck).TotalSeconds < _healthCacheDuration)
            return _lastHealthStatus;

        try
        {
            var response = await _http.GetAsync(_healthUrl);
            _lastHealthStatus = response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "n8n health check failed");
            _lastHealthStatus = false;
        }

        _lastHealthCheck = DateTime.UtcNow;
        return _lastHealthStatus;
    }

    public async Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null)
    {
        var payload = new
        {
            message = userMessage,
            history = conversationHistory?.Select(h => new
            {
                role = h.Role,
                content = h.Content
            }).ToArray() ?? Array.Empty<object>(),
            imageBase64,
            imageMimeType
        };

        var request = new HttpRequestMessage(HttpMethod.Post, _webhookUrl);
        request.Headers.Add("X-N8N-Auth", _authToken);
        request.Content = JsonContent.Create(payload);

        _logger.LogInformation("Sending message to n8n workflow: {Url}", _webhookUrl);

        var response = await _http.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("n8n webhook returned {Status}: {Body}",
                response.StatusCode, json);
            throw new HttpRequestException(
                $"n8n returned {response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var responseText = root.GetProperty("response").GetString() ?? "";
        var hasSafetyWarning = root.TryGetProperty("hasSafetyWarning", out var sw)
            && sw.GetBoolean();

        return (responseText, hasSafetyWarning);
    }
}
```

### Step 4: Create GeminiChatbotProvider (Adapter)

Create `src/ReliefConnect.Infrastructure/Services/GeminiChatbotProvider.cs`:

```csharp
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

/// <summary>
/// Wraps the existing IGeminiService to implement IChatbotProvider.
/// </summary>
public class GeminiChatbotProvider : IChatbotProvider
{
    private readonly IGeminiService _gemini;

    public string ProviderName => "Direct Gemini API";

    public GeminiChatbotProvider(IGeminiService gemini)
    {
        _gemini = gemini;
    }

    public Task<bool> IsAvailableAsync() => Task.FromResult(true); // Always available as fallback

    public Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null)
    {
        return _gemini.SendMessageAsync(userMessage, conversationHistory, imageBase64, imageMimeType);
    }
}
```

### Step 5: Create DualChatbotProvider (Orchestrator)

Create `src/ReliefConnect.Infrastructure/Services/DualChatbotProvider.cs`:

```csharp
using Microsoft.Extensions.Logging;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

/// <summary>
/// Orchestrates between n8n (primary) and Gemini (fallback) providers.
/// </summary>
public class DualChatbotProvider : IChatbotProvider
{
    private readonly N8nChatbotProvider _n8n;
    private readonly GeminiChatbotProvider _gemini;
    private readonly ILogger<DualChatbotProvider> _logger;

    public string ProviderName => "Dual (n8n + Gemini)";

    public DualChatbotProvider(
        N8nChatbotProvider n8n,
        GeminiChatbotProvider gemini,
        ILogger<DualChatbotProvider> logger)
    {
        _n8n = n8n;
        _gemini = gemini;
        _logger = logger;
    }

    public async Task<bool> IsAvailableAsync()
    {
        return await _n8n.IsAvailableAsync() || await _gemini.IsAvailableAsync();
    }

    public async Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null)
    {
        // Try n8n first
        if (await _n8n.IsAvailableAsync())
        {
            try
            {
                _logger.LogInformation("Routing chatbot request to n8n workflow");
                return await _n8n.SendMessageAsync(
                    userMessage, conversationHistory, imageBase64, imageMimeType);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "n8n workflow failed, falling back to direct Gemini API");
            }
        }
        else
        {
            _logger.LogInformation(
                "n8n unavailable, using direct Gemini API");
        }

        // Fallback to Gemini
        return await _gemini.SendMessageAsync(
            userMessage, conversationHistory, imageBase64, imageMimeType);
    }
}
```

### Step 6: Register in DI Container

Add to `Program.cs`:

```csharp
// ═══════════════════════════════════════════
//  CHATBOT PROVIDERS (Dual: n8n + Gemini)
// ═══════════════════════════════════════════
builder.Services.AddSingleton<IGeminiService, GeminiService>();
builder.Services.AddSingleton<N8nChatbotProvider>();
builder.Services.AddSingleton<GeminiChatbotProvider>();
builder.Services.AddSingleton<IChatbotProvider, DualChatbotProvider>();
```

### Step 7: Update ChatbotController

Change the controller to use `IChatbotProvider` instead of `IGeminiService`:

```csharp
// Before:
private readonly IGeminiService _gemini;

// After:
private readonly IChatbotProvider _chatbot;
```

And update the `SendMessage` method:

```csharp
// Before:
var (response, hasSafetyWarning) = await _gemini.SendMessageAsync(
    dto.Content, historyTuples, dto.ImageBase64, dto.ImageMimeType);

// After:
var (response, hasSafetyWarning) = await _chatbot.SendMessageAsync(
    dto.Content, historyTuples, dto.ImageBase64, dto.ImageMimeType);
```

---

## 9. Phase 3B: Add RAG + Complexity Routing to n8n

**Estimated complexity**: Medium-High · **Files changed**: n8n workflow (upgrade from Phase 2 basic workflow)

> **This phase upgrades the basic Phase 2 workflow** into the full RAG pipeline with Dify KB retrieval and AI model routing. Requires Phase 2B (Dify setup) to be complete.

### Overview: What Changes

Phase 2 workflow (basic):
```
Webhook → Set Input → IF Emergency → AI Agent (Gemini) → Respond
```

Phase 3B workflow (full RAG + routing):
```
Webhook → Set Input → Dify KB Retrieve (hybrid 60/40) → Format Context → IF Complex → Dify Complex Chatflow → Merge → Respond
                                                                         └──────────→ Dify Simple Chatflow  ↗
```

### Step 1: Duplicate and Rename the Basic Workflow

1. In n8n, open the Phase 2 workflow
2. Click the **⋮** menu (top right) → **Duplicate**
3. Rename the new copy to: `ReliefConnect Chatbot — RAG`
4. Deactivate the original Phase 2 workflow (or keep both and switch via `N8n:WebhookPath` config)

### Step 2: Remove the AI Agent Node

Delete (or disconnect) the existing AI Agent node — the Dify Chatflow apps will handle AI generation.

### Step 3: Add Dify Knowledge Base Retrieve Node

Insert after the Set Input node:

1. Add **HTTP Request** node
2. Name: `Dify Hybrid Search`
3. Configure:

| Setting | Value |
|---------|-------|
| Method | POST |
| URL | `https://api.dify.ai/v1/datasets/{{ $env.DIFY_DATASET_ID }}/retrieve` |
| Authentication | Header Auth → `Dify Dataset Key` credential |
| Body | JSON (see below) |
| Timeout | 30000ms |

**Request body** (JSON mode):
```json
{
  "query": "{{ $('Set Input').item.json.userMessage }}",
  "retrieval_model": {
    "search_method": "hybrid_search",
    "reranking_enable": true,
    "reranking_mode": "weighted_score",
    "weights": {
      "vector_weight": 0.6,
      "keyword_weight": 0.4
    },
    "reranking_model": {
      "reranking_provider_name": "cohere",
      "reranking_model_name": "rerank-multilingual-v3.0"
    },
    "top_k": 6,
    "score_threshold_enabled": true,
    "score_threshold": 0.35
  }
}
```

### Step 4: Add Format Context Node (Code Node)

1. Add a **Code** node after Dify Hybrid Search
2. Name: `Format Context`
3. Language: JavaScript
4. Paste this code:

```javascript
const records = $input.item.json.records || [];
const query = $('Set Input').item.json.userMessage;

const contextChunks = records.slice(0, 6).map((r, i) => {
  const docName = r.segment?.document?.name || 'Unknown';
  const score = (r.score || 0).toFixed(3);
  return `--- Nguồn ${i+1}: ${docName} (độ liên quan: ${score}) ---\n${r.segment.content}`;
});

const context = contextChunks.length > 0 ? contextChunks.join('\n\n') : '';

const sources = records.map(r => ({
  documentName: r.segment?.document?.name || 'Unknown',
  score: r.score || 0,
  excerpt: (r.segment?.content || '').substring(0, 200) + '...'
}));

const emergencyKeywords = [
  'đau tim', 'ngộ độc', 'chảy máu', 'ngừng thở', 'tai nạn', 'cấp cứu',
  'heart attack', 'poisoning', 'bleeding', 'emergency', 'accident'
];
const hasEmergency = emergencyKeywords.some(kw => query.toLowerCase().includes(kw));

return [{ json: { context, sources, hasEmergency, userMessage: query } }];
```

### Step 5: Replace the IF Node (Complexity Routing)

Replace the old emergency IF node with a new complexity routing IF node:

**IF Node: "Is Complex Query?"**

Conditions (ANY = True → Complex path):
- `{{ $('Set Input').item.json.userMessage.length }}` **is greater than** `100`
- `{{ $('Set Input').item.json.hasImage }}` **is equal to** `true`
- `{{ $('Set Input').item.json.userMessage.toLowerCase() }}` **contains** `chính sách`
- `{{ $('Set Input').item.json.userMessage.toLowerCase() }}` **contains** `quy định`
- `{{ $('Set Input').item.json.userMessage.toLowerCase() }}` **contains** `thủ tục`
- `{{ $('Set Input').item.json.userMessage.toLowerCase() }}` **contains** `policy`
- `{{ $('Format Context').item.json.hasEmergency }}` **is equal to** `true`

**True branch** → Complex (powerful AI)
**False branch** → Simple (normal AI)

### Step 6: Add Dify Complex Chatflow Node (True path)

1. Add **HTTP Request** node on the True output
2. Name: `Dify Complex AI`
3. Configure:

| Setting | Value |
|---------|-------|
| Method | POST |
| URL | `https://api.dify.ai/v1/chat-messages` |
| Authentication | Header Auth → `Dify Complex Chatflow Key` |
| Timeout | 90000ms |

**Request body**:
```json
{
  "inputs": { "retrieved_context": "{{ $('Format Context').item.json.context }}" },
  "query": "{{ $('Set Input').item.json.userMessage }}",
  "response_mode": "blocking",
  "conversation_id": "{{ $('Set Input').item.json.conversationId }}",
  "user": "{{ $('Set Input').item.json.userId }}"
}
```

### Step 7: Add Dify Simple Chatflow Node (False path)

1. Add **HTTP Request** node on the False output
2. Name: `Dify Simple AI`
3. Same config as above but:
   - URL: uses Simple Chatflow API key
   - Timeout: 30000ms

### Step 8: Merge → Build Final Response → Respond

1. Add a **Merge** node connecting both AI response paths
2. After Merge, add a **Set** node:

| Field | Value |
|-------|-------|
| `response` | `{{ $json.answer }}` |
| `conversationId` | `{{ $json.conversation_id }}` |
| `hasSafetyWarning` | `{{ $('Format Context').item.json.hasEmergency }}` |
| `sources` | `{{ JSON.stringify($('Format Context').item.json.sources) }}` |
| `provider` | `n8n+dify` |

3. Add **Respond to Webhook** node:
```json
{
  "response": "{{ $json.response }}",
  "hasSafetyWarning": {{ $json.hasSafetyWarning }},
  "conversationId": "{{ $json.conversationId }}",
  "sources": {{ $json.sources }},
  "provider": "{{ $json.provider }}"
}
```

### Step 9: Activate and Test

```powershell
# Test complex query (policy question — should route to Powerful AI)
$body = @{
    message = "Thủ tục nộp hồ sơ xin cứu trợ y tế và điều kiện đủ điều kiện nhận là gì?"
    history = @()
    userId = "test-user"
    conversationId = ""
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:5678/webhook/chatbot" `
    -Method Post `
    -Headers @{ "X-ReliefConnect-Auth" = "your-secret" } `
    -Body $body -ContentType "application/json"

# Test simple query (should route to Normal AI)
$simpleBody = @{
    message = "SOS là gì?"
    history = @()
    userId = "test-user"
    conversationId = ""
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:5678/webhook/chatbot" `
    -Method Post `
    -Headers @{ "X-ReliefConnect-Auth" = "your-secret" } `
    -Body $simpleBody -ContentType "application/json"
```

> For the complete n8n workflow node specifications including all field expressions, see [RAG_SYSTEM_ARCHITECTURE.md — Section 7](RAG_SYSTEM_ARCHITECTURE.md#7-n8n-workflow-design-step-by-step).

---

## 10. Phase 4: Dual-Provider Failover

### Health Check Behavior

```
┌──────────────────────────────────┐
│        Health Check Logic         │
│                                  │
│  1. Check cache (30s TTL)        │
│     - If cached → return cached  │
│                                  │
│  2. GET http://n8n:5678/healthz  │
│     - 200 OK → n8n available     │
│     - Timeout/Error → n8n down   │
│                                  │
│  3. Cache result for 30 seconds  │
└──────────────────────────────────┘
```

### Failover Sequence

```
Request arrives at ChatbotController
    │
    ▼
DualChatbotProvider.SendMessageAsync()
    │
    ├── n8n.IsAvailableAsync()
    │   │
    │   ├── TRUE → n8n.SendMessageAsync()
    │   │           │
    │   │           ├── Success → Return response ✓
    │   │           │
    │   │           └── Exception → Log warning
    │   │                           │
    │   │                           └── gemini.SendMessageAsync()
    │   │                               │
    │   │                               └── Return response ✓
    │   │
    │   └── FALSE → Log "n8n unavailable"
    │                │
    │                └── gemini.SendMessageAsync()
    │                    │
    │                    └── Return response ✓
```

### Admin Visibility

Add a status endpoint to verify which provider is active:

```csharp
// In ChatbotController or an admin endpoint
[HttpGet("provider-status")]
[Authorize(Policy = "RequireAdmin")]
public async Task<ActionResult> GetProviderStatus()
{
    var n8nAvailable = await _n8nProvider.IsAvailableAsync();
    return Ok(new
    {
        ActiveProvider = n8nAvailable ? "n8n Workflow" : "Direct Gemini API",
        N8nStatus = n8nAvailable ? "Connected" : "Disconnected",
        GeminiStatus = "Always Available (Fallback)"
    });
}
```

---

## 11. Phase 5: Production Deployment

### n8n Production Setup

#### Option A: Docker on VPS (Recommended)

```yaml
# docker-compose.n8n-production.yml
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: reliefconnect-n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_HOST}/
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_ADMIN_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_ADMIN_PASSWORD}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=${DB_HOST}
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${DB_USER}
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
      - GENERIC_TIMEZONE=Asia/Ho_Chi_Minh
    volumes:
      - n8n_data:/home/node/.n8n
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Reverse proxy for HTTPS
  caddy:
    image: caddy:latest
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - n8n

volumes:
  n8n_data:
  caddy_data:
```

**Caddyfile** (for automatic HTTPS):
```
n8n.yourdomain.com {
    reverse_proxy n8n:5678
}
```

#### Option B: n8n Cloud

Use [n8n.io cloud](https://n8n.io/pricing) for managed hosting:
- No Docker management needed
- Automatic updates and backups
- Starts at free tier (limited executions)
- Update `N8n:BaseUrl` in `appsettings.json` to the cloud URL

### Production Configuration

Update `appsettings.json` (or use environment variables):

```json
{
  "N8n": {
    "BaseUrl": "https://n8n.yourdomain.com",
    "WebhookPath": "/webhook/chatbot",
    "AuthToken": "${N8N_WEBHOOK_AUTH_TOKEN}",
    "HealthCheckPath": "/healthz",
    "TimeoutSeconds": 30,
    "HealthCacheDurationSeconds": 30
  }
}
```

### Security Checklist

- [ ] n8n webhook uses HTTPS
- [ ] `AuthToken` is a randomly generated 64+ character string
- [ ] n8n basic auth credentials are strong and unique
- [ ] `N8N_ENCRYPTION_KEY` is set (encrypts credentials at rest)
- [ ] Execution data pruning is enabled (168 hours = 7 days)
- [ ] n8n admin panel is not publicly accessible (or protected by VPN/IP whitelist)

---

## 12. Phase 6: Advanced Workflows

Once the basic chatbot workflow is running, you can extend it with powerful n8n features:

### 12.1 Full RAG with Dify (Implemented in Phase 3B)

The full Dify-powered RAG pipeline is now documented as a first-class phase. See:
- **[Phase 2B](#7-phase-2b-configure-dify-knowledge-base-rag)** — Dify Knowledge Base setup
- **[Phase 3B](#9-phase-3b-add-rag--complexity-routing-to-n8n)** — n8n workflow upgrade
- **[RAG_SYSTEM_ARCHITECTURE.md](RAG_SYSTEM_ARCHITECTURE.md)** — Complete technical specification

The implemented architecture:
```
Webhook → Set Input → Dify KB Hybrid Search (60% vector + 40% BM25 + Cohere reranker)
        → Format Context → IF Complex → Dify Complex Chatflow (Gemini Pro / GPT-4o)
                                     → Merge → Respond
                        → Dify Simple Chatflow (Gemini Flash)   ↗
```

### 12.2 Multi-Language Routing

Add language detection to route to language-specific AI agents:

```
Webhook → Detect Language (Code Node) → IF Vietnamese → Vietnamese Agent
                                      → IF English → English Agent
```

### 12.3 Image Analysis Pipeline

Create a dedicated image analysis workflow:

```
Webhook → Validate Image → Gemini Vision → Extract Findings → Format Response → Respond
```

### 12.4 Escalation to Human Operator

Route complex or sensitive queries to human administrators:

```
AI Agent → Check Confidence → IF Low Confidence → Create DB Record → Notify Admin via SignalR
                             → IF High Confidence → Respond to User
```

### 12.5 Analytics & Logging

Add analytics nodes to track chatbot performance:

```
... → AI Response → Log to Supabase → Respond to Webhook
                  → IF Emergency → Send Email Alert to Admin
```

---

## 13. Testing Strategy

### 11.1 Unit Tests

Test the `DualChatbotProvider` orchestration logic:

```csharp
[Fact]
public async Task SendMessage_N8nAvailable_UsesN8n()
{
    // Arrange: Mock n8n as available
    // Act: Call DualChatbotProvider.SendMessageAsync
    // Assert: Verify n8n provider was called
}

[Fact]
public async Task SendMessage_N8nDown_FallsBackToGemini()
{
    // Arrange: Mock n8n as unavailable
    // Act: Call DualChatbotProvider.SendMessageAsync
    // Assert: Verify Gemini provider was called
}

[Fact]
public async Task SendMessage_N8nThrows_FallsBackToGemini()
{
    // Arrange: Mock n8n as available but throws on send
    // Act: Call DualChatbotProvider.SendMessageAsync
    // Assert: Verify Gemini fallback was called
}
```

### 11.2 Integration Tests

```powershell
# Test n8n webhook directly
$body = @{
    message = "How do I create an SOS request?"
    history = @()
} | ConvertTo-Json -Depth 3

$response = Invoke-RestMethod -Uri "http://localhost:5678/webhook/chatbot" `
    -Method Post `
    -ContentType "application/json" `
    -Headers @{ "X-N8N-Auth" = "your-secret-key-here" } `
    -Body $body

Write-Host "Response: $($response.response)"
Write-Host "Safety Warning: $($response.hasSafetyWarning)"
```

### 11.3 Failover Tests

```powershell
# 1. Start n8n → Send message → Verify n8n processes it
# 2. Stop n8n  → Send message → Verify Gemini processes it
# 3. Start n8n → Send message → Verify n8n resumes

# Stop n8n
docker stop reliefconnect-n8n

# Send test message through ASP.NET API
# Should use Gemini fallback

# Restart n8n
docker start reliefconnect-n8n

# Wait for health cache to expire (30s)
# Send test message → should use n8n again
```

### 11.4 E2E Test (Playwright)

Add to existing chatbot E2E test suite:

```typescript
test('chatbot works when n8n is primary', async ({ page }) => {
  // Login → Navigate to chat → Send message → Verify response
});

test('chatbot falls back to Gemini when n8n is down', async ({ page }) => {
  // Stop n8n docker container
  // Login → Navigate to chat → Send message → Verify response still works
  // Restart n8n docker container
});
```

---

## 14. Troubleshooting

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|---------|
| n8n UI shows "502 Bad Gateway" | n8n container not running | `docker start reliefconnect-n8n` |
| Webhook returns 404 | Workflow not activated | Toggle "Active" switch in n8n |
| Webhook returns 401 | Auth token mismatch | Verify `X-N8N-Auth` header matches n8n config |
| "Test" works but "Production" doesn't | Using test URL | Activate workflow; use `/webhook/` not `/webhook-test/` |
| n8n runs out of memory | Large conversation histories | Limit history to 20 messages; enable execution pruning |
| Gemini returns 429 | API key rate limited | Add more keys to the API key pool |
| Health check always fails | Firewall blocking port 5678 | Check Docker port mapping and firewall rules |
| Slow n8n response (> 30s) | Gemini model overloaded | Increase timeout; try a different model |

### Checking n8n Logs

```powershell
# View recent n8n logs
docker logs reliefconnect-n8n --tail 100

# Follow logs in real-time
docker logs reliefconnect-n8n -f

# Check n8n execution history
# Open http://localhost:5678 → Executions tab
```

### Checking ASP.NET Logs

The `DualChatbotProvider` logs which provider is used for each request:

```
[INF] Routing chatbot request to n8n workflow
[WRN] n8n workflow failed, falling back to direct Gemini API
[INF] n8n unavailable, using direct Gemini API
```

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **n8n** | Open-source workflow automation platform |
| **Node** | A single operation in an n8n workflow (e.g., HTTP request, AI model call) |
| **Workflow** | A connected sequence of nodes that processes data |
| **Webhook** | An HTTP endpoint that triggers a workflow when called |
| **Trigger** | The first node in a workflow that initiates execution |
| **Execution** | One complete run of a workflow |
| **Credential** | A stored secret (API key, password) used by nodes |
| **AI Agent** | An n8n node that orchestrates LLM calls with tools and memory |
| **Window Buffer Memory** | A memory node that stores the last N messages for conversation context |
| **RAG** | Retrieval-Augmented Generation — enhancing AI with retrieved documents |
| **Health Check** | A lightweight HTTP request to verify a service is running |
| **Failover** | Automatically switching to a backup system when the primary fails |
| **Dual Provider** | Architecture that supports two AI backends with automatic switching |

---

## Implementation Timeline

| Phase | Task | Complexity | Dependencies |
|-------|------|-----------|-------------|
| **Phase 1** | Set up n8n locally | Low | Docker installed |
| **Phase 2** | Build basic chatbot workflow in n8n | Medium | Phase 1 |
| **Phase 2B** | Configure Dify Knowledge Base | Medium | Dify account + documents |
| **Phase 3** | Backend IChatbotProvider + DualChatbotProvider | Medium | Phase 2 |
| **Phase 3B** | Add RAG + complexity routing to n8n workflow | Medium-High | Phase 2B + Phase 3 |
| **Phase 4** | Health check + failover logic | Low | Phase 3 |
| **Phase 5** | Production deployment | Medium | Phase 4 + VPS/Cloud |
| **Phase 6** | Advanced workflows (analytics, escalation) | High | Phase 5 |

---

*This document is designed for developers with zero n8n experience. Follow the phases sequentially for the smoothest onboarding.*
