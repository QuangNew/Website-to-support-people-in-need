# Chatbot Dual-Provider Architecture

> Technical specification for the n8n + Gemini dual AI backend in ReliefConnect, including the Dify RAG knowledge retrieval layer.
>
> Version 2.0 · April 8, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture](#2-current-architecture)
3. [Target Architecture](#3-target-architecture)
4. [RAG Layer: Dify Knowledge Retrieval](#4-rag-layer-dify-knowledge-retrieval)
5. [Interface Contract](#5-interface-contract)
6. [Provider Implementations](#6-provider-implementations)
7. [Failover Strategy](#7-failover-strategy)
8. [n8n Webhook Protocol](#8-n8n-webhook-protocol)
9. [Configuration Reference](#9-configuration-reference)
10. [Sequence Diagrams](#10-sequence-diagrams)
11. [Migration Path](#11-migration-path)
12. [Monitoring & Observability](#12-monitoring--observability)
13. [Security Considerations](#13-security-considerations)

---

## 1. Executive Summary

ReliefConnect's chatbot currently communicates directly with Google Gemini API through `GeminiService`. This document specifies a **dual-provider architecture** that introduces n8n workflow as the primary AI backend with automatic failover to the existing Gemini integration.

### Design Goals

| Goal | How |
|------|-----|
| **Zero downtime** | Automatic failover to Gemini when n8n is unreachable |
| **Zero frontend changes** | Same `ChatbotController` API; provider switching is invisible to clients |
| **Backward compatible** | `IGeminiService` remains unchanged; new interface `IChatbotProvider` wraps it |
| **Operationally visible** | Logging and admin endpoint expose which provider is active |
| **Extensible** | Adding a third provider (e.g., Azure OpenAI) requires only a new `IChatbotProvider` implementation |
| **Knowledge-grounded** | n8n queries Dify Knowledge Base (hybrid 60/40 search + reranker) before generating responses |
| **Cost-optimized** | Simple queries use cheap fast model; complex queries use powerful model |
| **Citation-capable** | Source document citations returned alongside AI responses |

---

## 2. Current Architecture

```
┌──────────────┐     ┌────────────────────┐     ┌──────────────────────┐
│   Frontend   │────▶│  ChatbotController │────▶│    GeminiService     │
│  ChatbotPage │     │                    │     │  (IGeminiService)    │
│              │◀────│  POST /messages    │◀────│                      │
└──────────────┘     └────────────────────┘     │  - API key pool      │
                                                │  - System prompt     │
                                                │  - Emergency detect  │
                                                │  - Safety settings   │
                                                └──────────┬───────────┘
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │  Google Gemini API   │
                                                │  generativelanguage  │
                                                │  .googleapis.com     │
                                                └──────────────────────┘
```

### Current Request Flow

1. Frontend sends `POST /api/chatbot/conversations/{id}/messages` with `SendMessageDto`
2. `ChatbotController` validates input, saves user message to DB
3. Fetches last 20 messages for context
4. Calls `IGeminiService.SendMessageAsync(message, history, image, mimeType)`
5. `GeminiService` selects least-used API key, calls Gemini REST API
6. Response saved to DB, returned to frontend

### Pain Points

- **Model lock-in**: Changing AI model requires code change + redeployment
- **No visual debugging**: Cannot inspect AI conversation flow without code
- **Limited extensibility**: Adding RAG, tools, or multi-step chains requires significant code
- **No separation of concerns**: Emergency detection, safety filtering, and AI generation mixed in one service

---

## 3. Target Architecture

```
┌──────────────┐     ┌────────────────────┐     ┌──────────────────────────────┐
│   Frontend   │────▶│  ChatbotController │────▶│    DualChatbotProvider       │
│  ChatbotPage │     │                    │     │    (IChatbotProvider)        │
│              │◀────│  POST /messages    │◀────│                              │
└──────────────┘     └────────────────────┘     │  ┌─────────────────────────┐ │
                                                │  │ n8n health check cache  │ │
                                                │  │ (30s TTL)               │ │
                                                │  └────────┬────────────────┘ │
                                                │           │                  │
                                                │     ┌─────▼──────┐          │
                                                │     │  n8n OK?   │          │
                                                │     └──┬──────┬──┘          │
                                                │    YES │      │ NO          │
                                                │        ▼      ▼             │
                                                │  ┌─────────┐ ┌───────────┐ │
                                                │  │  N8n     │ │ Gemini    │ │
                                                │  │ Provider │ │ Provider  │ │
                                                │  └────┬────┘ └─────┬─────┘ │
                                                │       │            │        │
                                                └───────┼────────────┼────────┘
                                                        │            │
                                          ┌─────────────▼───┐  ┌────▼────────────┐
                                          │  n8n Workflow    │  │  Google Gemini  │
                                          │  Server          │  │  API (direct)   │
                                          │  (port 5678)     │  │                 │
                                          │                  │  │                 │
                                          │  Webhook         │  │  Same as        │
                                          │  → IF emergency  │  │  current        │
                                          │  → AI Agent      │  │  GeminiService  │
                                          │  → Respond       │  │                 │
                                          └──────────────────┘  └─────────────────┘
```

### Target Architecture with RAG Layer

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────────────┐
│   Frontend   │───▶│  ChatbotController │───▶│    DualChatbotProvider       │
│  ChatbotPage │     │                    │     │    (IChatbotProvider)        │
│              │◄────│  POST /messages    │◄────│                               │
└──────────────┘     └──────────────────┘     │  ┌─────────────────────┐ │
                                                │  │ n8n health check cache  │ │
                                                │  │ (30s TTL)               │ │
                                                │  └────────┬────────────────┘ │
                                                │           │                  │
                                                │     ┌─────▼─────┐          │
                                                │     │  n8n OK?   │          │
                                                │     └──┬──────┬──┘          │
                                                │    YES │      │ NO          │
                                                │        ▼      ▼             │
                                                │  ┌─────────┐ ┌───────────┐ │
                                                │  │  N8n     │ │ Gemini    │ │
                                                │  │ Provider │ │ Provider  │ │
                                                │  └────┬────┘ └─────┬─────┘ │
                                                │       │            │        │
                                                └───────┼────────────┼────────┘
                                                        │            │
                              ┌─────────────────▼───┐  ┌───▼───────────┐
                              │  n8n Workflow Server  │  │  Google Gemini  │
                              │  (port 5678)          │  │  API (direct)   │
                              │                       │  └───────────────┘
                              │  RAG PIPELINE:        │
                              │  Webhook              │
                              │  ↓                    │
                              │  Dify KB Retrieve ◦───────────────────────▶ Dify KB
                              │  (60%+40% hybrid)     │         (Retrieval API)
                              │  ↓                    │
                              │  IF Complex? ───────────────────────▶ Dify Complex
                              │            └───────────────────────▶ Dify Simple
                              │  Respond              │
                              └──────────────────────────┘
```

---

## 4. RAG Layer: Dify Knowledge Retrieval

> This section documents the knowledge retrieval layer added in Version 2.0. The layer operates entirely within n8n and is transparent to the ASP.NET backend.

### What the RAG Layer Does

Before calling any AI model, n8n queries **Dify Knowledge Base** to retrieve relevant document chunks. These chunks are injected into the AI prompt as context, ensuring the response is grounded in platform-specific knowledge rather than general LLM training data.

### Hybrid Search: 60% + 40%

| Component | Weight | Method | Example Strength |
|-----------|--------|--------|------------------|
| Semantic Embedding | **60%** | Dense vector cosine similarity | Finds `"hỗ trợ"` when user writes `"viện trợ"` |
| Keyword / BM25 | **40%** | Term frequency matching | Finds `"Trung tâm cứu trợ Quận 1"` by exact phrase |

After fusion, a **Cohere `rerank-multilingual-v3.0`** cross-encoder re-scores the top results, optimizing for Vietnamese language accuracy.

### Complexity Routing Decision

| Query Characteristic | AI Tier | Model |
|---------------------|---------|-------|
| Length < 100 chars, simple FAQ | **Normal** | Gemini 2.0 Flash / GPT-4o mini |
| Length ≥ 100 chars, policy/medical/multi-step | **Powerful** | Gemini 2.5 Pro / GPT-4o |
| Contains emergency keywords | **Powerful** + `hasSafetyWarning: true` | Gemini 2.5 Pro |
| Contains image | **Powerful** | Gemini 2.5 Pro |

### Updated Response Contract

When n8n (with RAG) processes a message, the response now includes source citations:

```json
{
  "response": "AI-generated answer...",
  "hasSafetyWarning": false,
  "conversationId": "dify-conversation-uuid",
  "sources": [
    { "documentName": "relief_policy.pdf", "score": 0.87, "excerpt": "..." }
  ],
  "provider": "n8n+dify"
}
```

> See [RAG_SYSTEM_ARCHITECTURE.md](RAG_SYSTEM_ARCHITECTURE.md) for the complete technical specification of the RAG pipeline.

---

## 5. Interface Contract

### IChatbotProvider

```csharp
namespace ReliefConnect.Core.Interfaces;

public interface IChatbotProvider
{
    /// <summary>Provider display name for logging.</summary>
    string ProviderName { get; }

    /// <summary>Check if this provider is currently available.</summary>
    Task<bool> IsAvailableAsync();

    /// <summary>Send a message and receive an AI response.</summary>
    Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null);
}
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Same return type as `IGeminiService` | Zero-change migration for `ChatbotController` |
| `IsAvailableAsync()` as separate method | Allows health checking independently of message sends |
| `ProviderName` property | Enables structured logging without type checking |
| Nullable image parameters | Maintains existing multimodal support |
| No cancellation token | Matches existing `IGeminiService` signature |

---

## 6. Provider Implementations

### 5.1 N8nChatbotProvider

**Responsibility**: HTTP communication with n8n webhook endpoint

| Aspect | Detail |
|--------|--------|
| Health check | `GET {baseUrl}/healthz` with 30s cache TTL |
| Message send | `POST {baseUrl}/webhook/chatbot` with JSON body |
| Authentication | `X-N8N-Auth` header with shared secret |
| Timeout | 30 seconds (configurable) |
| Error handling | Throws `HttpRequestException` on non-2xx (caught by `DualChatbotProvider`) |

### 5.2 GeminiChatbotProvider

**Responsibility**: Adapter wrapping existing `IGeminiService`

| Aspect | Detail |
|--------|--------|
| Health check | Always returns `true` (fallback provider) |
| Message send | Delegates to `IGeminiService.SendMessageAsync()` |
| Configuration | None (uses existing `GeminiService` configuration) |

### 5.3 DualChatbotProvider

**Responsibility**: Orchestration and failover logic

| Aspect | Detail |
|--------|--------|
| Primary provider | `N8nChatbotProvider` |
| Fallback provider | `GeminiChatbotProvider` |
| Failover trigger | n8n health check failure OR n8n request exception |
| Health check caching | 30 seconds (prevents health check spam) |
| Logging | Logs provider selection and failover events |

---

## 7. Failover Strategy

### Decision Matrix

| n8n Health | n8n Send | Action | Provider Used |
|-----------|----------|--------|--------------|
| ✅ OK | ✅ Success | Normal | n8n |
| ✅ OK | ❌ Fail | Failover | Gemini (with warning log) |
| ❌ Down | — | Direct fallback | Gemini (with info log) |
| ❌ Down (cached) | — | Cached fallback | Gemini (no health check) |

### Health Check Cache Behavior

```
T=0s   : First request → health check → cache result (30s TTL)
T=5s   : Second request → use cached result (no HTTP call)
T=15s  : Third request → use cached result (no HTTP call)
T=31s  : Fourth request → health check expired → new HTTP call → cache result
```

### Recovery Behavior

When n8n comes back online:
1. Health cache expires (max 30 seconds)
2. Next health check succeeds
3. Next request routes to n8n
4. No manual intervention required

---

## 8. n8n Webhook Protocol

### Request Format (v2.0 — with RAG support)

```http
POST /webhook/chatbot HTTP/1.1
Host: localhost:5678
Content-Type: application/json
X-N8N-Auth: {shared-secret}

{
  "message": "Xin chào, tôi cần giúp đỡ",
  "history": [
    { "role": "user", "content": "Previous user message" },
    { "role": "model", "content": "Previous bot response" }
  ],
  "userId": "user-uuid",
  "conversationId": "",
  "imageBase64": "optional-base64-string",
  "imageMimeType": "image/jpeg"
}
```

> `userId` and `conversationId` are new fields required by Dify for conversation context persistence. `conversationId` should be empty string `""` for new conversations, and the UUID returned by Dify on subsequent messages in the same conversation.

### Response Format (v2.0 — with RAG citations)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "response": "Xin chào! Tôi là trợ lý AI của ReliefConnect...",
  "hasSafetyWarning": false,
  "conversationId": "dify-uuid-or-empty",
  "sources": [
    { "documentName": "platform_guide.pdf", "score": 0.82, "excerpt": "..." }
  ],
  "provider": "n8n+dify"
}
```

> **Backward compatibility**: `sources` and `conversationId` are new optional fields. The `response` and `hasSafetyWarning` fields remain unchanged, so existing frontend code works without modification.

### Error Responses

| Status | Meaning | Backend Action |
|--------|---------|---------------|
| 200 | Success | Use response |
| 401 | Auth token mismatch | Log error, failover to Gemini |
| 404 | Workflow not found/inactive | Log error, failover to Gemini |
| 500 | Workflow execution error | Log error, failover to Gemini |
| Timeout | n8n or Gemini too slow | Log error, failover to Gemini |

---

## 9. Configuration Reference

### appsettings.json (v2.0 — with Dify)

```json
{
  "N8n": {
    "BaseUrl": "http://localhost:5678",
    "WebhookPath": "/webhook/chatbot",
    "AuthToken": "your-random-64-char-secret-here",
    "HealthCheckPath": "/healthz",
    "TimeoutSeconds": 30,
    "HealthCacheDurationSeconds": 30
  },
  "Gemini": {
    "ApiKey": "AIzaSy...",
    "Model": "gemini-2.5-flash"
  },
  "Dify": {
    "BaseUrl": "https://api.dify.ai/v1",
    "DatasetId": "your-dataset-id",
    "DatasetApiKey": "dataset-api-key",
    "SimpleChatflowApiKey": "simple-chatflow-key",
    "ComplexChatflowApiKey": "complex-chatflow-key"
  }
}
```

> **Note**: The Dify keys are used by n8n directly (configured in n8n credentials, not in `appsettings.json`). The `Dify` section in `appsettings.json` is only needed if you add a direct Dify provider to the C# side.

### Environment Variable Overrides

| Variable | Config Path | Description |
|----------|------------|-------------|
| `N8N__BaseUrl` | N8n:BaseUrl | n8n server URL |
| `N8N__AuthToken` | N8n:AuthToken | Webhook authentication secret |
| `GEMINI__ApiKey` | Gemini:ApiKey | Fallback Gemini API key |

---

## 10. Sequence Diagrams

### Full RAG Flow (n8n + Dify Available)

```
Frontend   Controller   DualProvider  N8nProvider    n8n Workflow     Dify KB     Dify Chatflow
   │           │            │            │               │              │             │
   │ POST /msg │            │            │               │              │             │
   │───────────▶│            │            │               │              │             │
   │           │  IChatbot  │            │               │              │             │
   │           │───────────▶│            │               │              │             │
   │           │            │  n8n OK?   │               │              │             │
   │           │            │───────────▶│ /healthz      │              │             │
   │           │            │    true    │◄───────────────■│              │             │
   │           │            │◄───────────│               │              │             │
   │           │            │ SendMsg()  │               │              │             │
   │           │            │───────────▶│ POST /webhook │              │             │
   │           │            │            │──────────────▶│ retrieve     │             │
   │           │            │            │               │─────────────▶│             │
   │           │            │            │               │ chunks + scores│             │
   │           │            │            │               │◄─────────────│             │
   │           │            │            │               │ IF complex     │ chat-msg    │
   │           │            │            │               │───────────────────────▶│
   │           │            │            │               │              answer       │
   │           │            │            │               │◄───────────────────────│
   │           │            │            │ {response, sources, conversationId}   │
   │           │            │            │◄──────────────│              │             │
   │           │            │  (resp,sw) │               │              │             │
   │           │            │◄───────────│               │              │             │
   │           │  200 {msg} │            │               │              │             │
   │           │◄───────────│            │               │              │             │
   │  message  │            │            │               │              │             │
   │◄───────────│            │            │               │              │             │
```

### Normal Flow (n8n Available, basic workflow)

```
Frontend          Controller         DualProvider       N8nProvider          n8n Server
   │                  │                  │                  │                    │
   │  POST /messages  │                  │                  │                    │
   │─────────────────▶│                  │                  │                    │
   │                  │  SendMessage()   │                  │                    │
   │                  │─────────────────▶│                  │                    │
   │                  │                  │  IsAvailable()   │                    │
   │                  │                  │─────────────────▶│                    │
   │                  │                  │                  │  GET /healthz      │
   │                  │                  │                  │───────────────────▶│
   │                  │                  │                  │  200 OK            │
   │                  │                  │                  │◀───────────────────│
   │                  │                  │  true            │                    │
   │                  │                  │◀─────────────────│                    │
   │                  │                  │                  │                    │
   │                  │                  │  SendMessage()   │                    │
   │                  │                  │─────────────────▶│                    │
   │                  │                  │                  │  POST /webhook/... │
   │                  │                  │                  │───────────────────▶│
   │                  │                  │                  │  { response, ... } │
   │                  │                  │                  │◀───────────────────│
   │                  │                  │  (response, sw)  │                    │
   │                  │                  │◀─────────────────│                    │
   │                  │  (response, sw)  │                  │                    │
   │                  │◀─────────────────│                  │                    │
   │  200 { msg }     │                  │                  │                    │
   │◀─────────────────│                  │                  │                    │
```

### Failover Flow (n8n Down)

```
Frontend          Controller         DualProvider       N8nProvider       GeminiProvider
   │                  │                  │                  │                    │
   │  POST /messages  │                  │                  │                    │
   │─────────────────▶│                  │                  │                    │
   │                  │  SendMessage()   │                  │                    │
   │                  │─────────────────▶│                  │                    │
   │                  │                  │  IsAvailable()   │                    │
   │                  │                  │─────────────────▶│                    │
   │                  │                  │  false (cached)  │                    │
   │                  │                  │◀─────────────────│                    │
   │                  │                  │                  │                    │
   │                  │                  │          SendMessage()                │
   │                  │                  │─────────────────────────────────────▶│
   │                  │                  │                                Gemini API
   │                  │                  │          (response, sw)              │
   │                  │                  │◀─────────────────────────────────────│
   │                  │  (response, sw)  │                  │                    │
   │                  │◀─────────────────│                  │                    │
   │  200 { msg }     │                  │                  │                    │
   │◀─────────────────│                  │                  │                    │
```

---

## 11. Migration Path

### Step-by-Step Migration

| Step | Change | Risk | Rollback |
|------|--------|------|----------|
| 1 | Add `IChatbotProvider` interface | None | Delete file |
| 2 | Create `GeminiChatbotProvider` (wraps existing) | None | Delete file |
| 3 | Create `N8nChatbotProvider` | None | Delete file |
| 4 | Create `DualChatbotProvider` | None | Delete file |
| 5 | Register DI services in `Program.cs` | Low | Remove registrations |
| 6 | Update `ChatbotController` to use `IChatbotProvider` | Low | Revert to `IGeminiService` |
| 7 | Add n8n configuration to `appsettings.json` | None | Remove config section |
| 8 | Deploy and test | — | Revert step 6 |

### Rollback Plan

If the dual provider causes issues:

1. Change `ChatbotController` constructor back to `IGeminiService`
2. Remove `IChatbotProvider` DI registration
3. Deploy

The existing `GeminiService` and `IGeminiService` remain untouched throughout the migration, ensuring the fallback path is always available.

---

## 12. Monitoring & Observability

### Log Events

| Level | Event | Example |
|-------|-------|---------|
| `Information` | Provider selected | "Routing chatbot request to n8n workflow" |
| `Information` | n8n unavailable | "n8n unavailable, using direct Gemini API" |
| `Warning` | n8n failed, falling back | "n8n workflow failed, falling back to direct Gemini API" |
| `Warning` | Health check failed | "n8n health check failed: Connection refused" |
| `Error` | Both providers failed | "All chatbot providers failed" |

### Admin Status Endpoint

```
GET /api/chatbot/provider-status
Authorization: Bearer {admin-jwt}

Response:
{
  "activeProvider": "n8n Workflow",
  "n8nStatus": "Connected",
  "n8nLastHealthCheck": "2026-04-08T10:30:00Z",
  "geminiStatus": "Available (Fallback)",
  "geminiApiKeyPool": 3
}
```

### Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| n8n availability | Health check cache | < 95% over 1 hour |
| n8n response time | Request duration | > 10s average |
| Failover count | Log events | > 5 per hour |
| Gemini fallback rate | Provider selection logs | > 20% of requests |

---

## 13. Security Considerations

### Webhook Authentication

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS in production (TLS 1.2+) |
| Application | `X-N8N-Auth` header with shared secret |
| n8n admin panel | Basic auth (separate credentials) |
| Credential storage | n8n encrypts credentials with `N8N_ENCRYPTION_KEY` |

### Data in Transit

| Data | From → To | Protection |
|------|----------|-----------|
| User messages | ASP.NET → n8n | HTTPS + auth header |
| Conversation history | ASP.NET → n8n | HTTPS + auth header |
| Image data (base64) | ASP.NET → n8n | HTTPS + auth header |
| API keys | n8n → Gemini | HTTPS + `x-goog-api-key` header |

### Secret Management

| Secret | Development | Production |
|--------|------------|-----------|
| n8n auth token | `appsettings.Development.json` | Environment variable |
| Gemini API key | Database pool + config file | Database pool + env var |
| n8n admin password | Docker env var | Docker secret / env var |
| n8n encryption key | Not needed (dev) | Docker secret (required) |

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Unauthorized webhook access | `X-N8N-Auth` header validation |
| n8n admin panel exposure | Basic auth + IP whitelist in production |
| Credential theft from n8n DB | `N8N_ENCRYPTION_KEY` encrypts at rest |
| MITM on n8n ↔ Gemini | HTTPS enforced |
| Prompt injection via history | Existing HtmlSanitizer on input; Gemini safety filters |

---

*This architecture document should be read alongside [N8N_IMPLEMENTATION_PLAN.md](N8N_IMPLEMENTATION_PLAN.md) for step-by-step implementation instructions and [RAG_SYSTEM_ARCHITECTURE.md](RAG_SYSTEM_ARCHITECTURE.md) for the full knowledge retrieval pipeline spec.*
