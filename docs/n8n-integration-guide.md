# n8n Workflow Automation — Complete Integration Guide

> **Target Audience:** Developers who have never used n8n before, integrating with an ASP.NET Core backend.  
> **Last Updated:** 2026-07-17  
> **Sources:** Official n8n documentation (docs.n8n.io)

---

## Table of Contents

- [A. n8n Overview & Architecture](#a-n8n-overview--architecture)
- [B. Self-Hosting with Docker](#b-self-hosting-with-docker)
- [C. Webhook Integration](#c-webhook-integration)
- [D. AI/LLM Nodes](#d-aillm-nodes)
- [E. HTTP Request Node](#e-http-request-node)
- [F. IF Node & Conditional Logic](#f-if-node--conditional-logic)
- [G. Respond to Webhook Node](#g-respond-to-webhook-node)
- [H. n8n REST API](#h-n8n-rest-api)
- [I. Authentication & Security](#i-authentication--security)
- [J. Best Practices & Common Pitfalls](#j-best-practices--common-pitfalls)
- [K. Dify Knowledge Base & RAG Integration](#k-dify-knowledge-base--rag-integration)

---

## A. n8n Overview & Architecture

### What is n8n?

n8n (pronounced "n-eight-n", short for "nodemation") is an **open-source workflow automation platform** with a visual, node-based editor. It allows you to connect different services and build automations without extensive coding.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Workflow** | A collection of nodes connected together to automate a process |
| **Node** | A single step in a workflow — can be a trigger, action, or logic operation |
| **Connection** | A link between nodes defining data flow |
| **Execution** | A single run of a workflow |
| **Credential** | Stored authentication details for external services |
| **Sticky Notes** | Annotation elements for documenting workflows |

### Node Types

1. **Core Nodes** — Built-in general-purpose nodes (Webhook, HTTP Request, IF, Code, etc.)
2. **App Nodes** — Pre-built integrations with external services (Gmail, Slack, GitHub, etc.)
3. **Trigger Nodes** — Nodes that start workflow execution (Webhook, Schedule, etc.)
4. **Cluster Nodes** — AI/LangChain nodes with root + sub-node architecture:
   - **Root Nodes:** AI Agent, Basic LLM Chain, Vector Store nodes
   - **Sub-Nodes:** Chat models, memory, tools, output parsers, embeddings

### Workflow Features

- **Executions:** Log of all workflow runs with input/output data
- **Tags:** Organize workflows by category
- **Templates:** Pre-built workflow patterns from the community
- **Import/Export:** JSON-based workflow portability
- **Sharing:** Collaborate with team members via projects
- **History:** Version history for workflow changes
- **Streaming:** Real-time response streaming for AI workflows

### Editions

| Edition | License | Features |
|---------|---------|----------|
| **Community** | Free (no license key) | Full core product |
| **Business** | Paid license key | + SSO, RBAC, source control, external secrets |
| **Enterprise** | Paid license key | + Custom roles, advanced audit, priority support |

### ASP.NET Core Relevance

Your ASP.NET Core backend (ReliefConnect) can interact with n8n via:
- **Webhooks** — n8n exposes HTTP endpoints your backend can call
- **HTTP Request nodes** — n8n calls your API endpoints
- **REST API** — Programmatically manage n8n workflows from your backend

---

## B. Self-Hosting with Docker

### Prerequisites

- Docker & Docker Compose installed
- A server or VM (Linux recommended)
- A domain name (for SSL/webhook URLs)
- Minimum 2GB RAM, 1 vCPU

### Quick Start with Docker

```bash
# Pull and run n8n with persistent data
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

n8n will be available at `http://localhost:5678`.

### Production Setup with Docker Compose

Create the following files:

#### `.env`

```env
# Domain configuration
DOMAIN_NAME=example.com
SUBDOMAIN=n8n
SSL_EMAIL=admin@example.com

# Database
POSTGRES_USER=n8n
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=n8n

# n8n configuration
N8N_ENCRYPTION_KEY=<random-32-char-string>
N8N_HOST=${SUBDOMAIN}.${DOMAIN_NAME}
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://${SUBDOMAIN}.${DOMAIN_NAME}/
GENERIC_TIMEZONE=Asia/Ho_Chi_Minh
```

#### `docker-compose.yml`

```yaml
version: '3.8'

services:
  n8n-db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - n8n_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: n8n-db
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: ${POSTGRES_DB}
      DB_POSTGRESDB_USER: ${POSTGRES_USER}
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD}
      N8N_HOST: ${N8N_HOST}
      N8N_PORT: ${N8N_PORT}
      N8N_PROTOCOL: ${N8N_PROTOCOL}
      WEBHOOK_URL: ${WEBHOOK_URL}
      GENERIC_TIMEZONE: ${GENERIC_TIMEZONE}
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      n8n-db:
        condition: service_healthy

volumes:
  n8n_db_data:
  n8n_data:
```

#### Start / Stop

```bash
# Start
sudo docker compose up -d

# Stop
sudo docker compose stop

# View logs
sudo docker compose logs -f n8n

# Update n8n
sudo docker compose pull
sudo docker compose up -d
```

### Key Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_TYPE` | Database type: `postgresdb`, `mysqldb`, `sqlite` | `sqlite` |
| `N8N_HOST` | Hostname for n8n | `localhost` |
| `N8N_PORT` | Port n8n listens on | `5678` |
| `N8N_PROTOCOL` | `http` or `https` | `http` |
| `WEBHOOK_URL` | Public URL for webhooks (important for external services) | auto-detected |
| `N8N_ENCRYPTION_KEY` | Key to encrypt credentials in database | auto-generated on first run |
| `GENERIC_TIMEZONE` | Default timezone | `America/New_York` |
| `EXECUTIONS_DATA_PRUNE` | Auto-delete old executions | `true` |
| `EXECUTIONS_DATA_MAX_AGE` | Max age of execution data (hours) | `336` (14 days) |
| `N8N_PAYLOAD_SIZE_MAX` | Max webhook payload size (MB) | `16` |
| `N8N_DIAGNOSTICS_ENABLED` | Telemetry data collection | `true` |
| `N8N_PROXY_HOPS` | Number of reverse proxy hops (for correct IP detection) | `0` |

### Supported Databases

| Database | Notes |
|----------|-------|
| **SQLite** | Default, suitable for small deployments, no extra config |
| **PostgreSQL** | Recommended for production — better performance & concurrency |
| **MySQL/MariaDB** | Alternative production option |

### Tunnel for Local Development

For testing webhooks locally (external services need to reach your n8n):

```bash
# Full stack with tunnel (Docker required)
pnpm stack --tunnel
```

This uses Cloudflare tunnels to create a public URL pointing to your local n8n. **Never use tunnels in production.**

### Common Pitfalls — Self-Hosting

| Issue | Solution |
|-------|----------|
| Webhooks unreachable from external services | Set `WEBHOOK_URL` to your public URL (with HTTPS) |
| Credentials lost after container recreation | Mount a persistent volume for `/home/node/.n8n` |
| Encryption key mismatch after migration | Back up and restore `N8N_ENCRYPTION_KEY` — all credentials are encrypted with this |
| Port 5678 conflict | Change `N8N_PORT` or map to a different host port |
| Memory errors on large workflows | Increase container memory limits, consider queue mode for scaling |

### ASP.NET Core Integration — Hosting

Deploy n8n alongside your ASP.NET Core app in the same Docker Compose stack or on the same network. Example addition to your existing compose:

```yaml
services:
  # ... your existing services (api, postgres, etc.)
  
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: your-postgres-service  # reuse your existing DB
      DB_POSTGRESDB_DATABASE: n8n
      WEBHOOK_URL: https://n8n.yourdomain.com/
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - your-app-network  # same network as your API
```

---

## C. Webhook Integration

### Overview

The **Webhook node** is a trigger node that creates HTTP endpoints. When an external service (or your ASP.NET Core backend) sends a request to this endpoint, it starts a workflow.

### Webhook URLs

n8n provides **two URLs** for each Webhook node:

| URL Type | When Active | Use Case |
|----------|-------------|----------|
| **Test URL** | Active when you click "Listen for Test Event" or "Execute workflow" | Development & testing |
| **Production URL** | Active when the workflow is published/activated | Live traffic |

**URL Format:**
```
Test:       https://your-n8n.com/webhook-test/<path>
Production: https://your-n8n.com/webhook/<path>
```

### Node Parameters

#### HTTP Method

Supports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`

#### Path

Default: randomly generated UUID. You can customize:

```
/my-endpoint
/api/:version/users
/:resource/:id
/chatbot/message
```

Route parameters are accessible in the workflow data.

#### Authentication

| Method | Description |
|--------|-------------|
| **None** | No authentication required |
| **Basic Auth** | Username + password |
| **Header Auth** | Custom header name + value (e.g., `X-API-Key: secret`) |
| **JWT Auth** | JSON Web Token validation |

#### Respond Options

| Option | Behavior |
|--------|----------|
| **Immediately** | Returns `200 OK` with message "Workflow got started" — workflow continues async |
| **When Last Node Finishes** | Waits for workflow to complete, returns data from last node |
| **Using 'Respond to Webhook' Node** | Full control over response via a separate node |
| **Streaming response** | Real-time streaming (requires AI/streaming-capable nodes) |

#### Response Data (when "When Last Node Finishes")

| Option | Returns |
|--------|---------|
| **All Entries** | All items from last node as an array |
| **First Entry JSON** | First item as JSON object |
| **First Entry Binary** | Binary file from first item |
| **No Response Body** | Empty response |

### Node Options

| Option | Description |
|--------|-------------|
| **Allowed Origins (CORS)** | Comma-separated allowed origins, `*` for all |
| **Binary Property** | Accept binary data (images, files) — specify property name |
| **Ignore Bots** | Skip requests from link previewers and crawlers |
| **IP(s) Whitelist** | Comma-separated IPs; others get 403 |
| **Raw Body** | Receive raw data (JSON, XML) without parsing |
| **Response Content-Type** | Set response MIME type |
| **Response Headers** | Custom response headers |
| **Response Code** | Custom HTTP status code |

### Max Payload Size

Default: **16 MB**. Configure via `N8N_PAYLOAD_SIZE_MAX` environment variable.

### HTML Response Security (v1.103.0+)

n8n wraps HTML responses in sandboxed `<iframe>` tags. Implications:
- JavaScript can't access top-level `window` or `localStorage`
- Auth headers unavailable — use embedded short-lived tokens instead
- Use **absolute URLs** (relative URLs won't work)

### ASP.NET Core → n8n Webhook Example

```csharp
// In your ASP.NET Core controller or service
public class N8nService
{
    private readonly HttpClient _httpClient;
    
    public N8nService(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("n8n");
    }
    
    public async Task<string> TriggerChatbotWorkflowAsync(
        string userId, string message, string? imageBase64 = null)
    {
        var payload = new
        {
            userId,
            message,
            imageBase64,
            timestamp = DateTime.UtcNow
        };
        
        var response = await _httpClient.PostAsJsonAsync(
            "https://n8n.yourdomain.com/webhook/chatbot-message",
            payload);
        
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }
}
```

### Common Pitfalls — Webhooks

| Issue | Solution |
|-------|----------|
| Test URL returns 404 | You must click "Listen for Test Event" first, or the workflow must be active |
| Production URL returns 404 | Workflow must be **activated** (toggle on) |
| CORS errors from frontend | Set **Allowed Origins** option or configure reverse proxy |
| Webhook not receiving data | Check `WEBHOOK_URL` env var matches your public URL |
| Payload too large | Increase `N8N_PAYLOAD_SIZE_MAX` for large file uploads |

---

## D. AI/LLM Nodes

### Architecture: Cluster Nodes

n8n's AI nodes use a **cluster node architecture** based on LangChain:

```
Root Node (required)          Sub-Nodes (attached)
─────────────────────         ─────────────────────
AI Agent                  ←── Chat Model (e.g., Google Gemini)
Basic LLM Chain           ←── Memory (e.g., Window Buffer)
                          ←── Tools (e.g., HTTP Request, Code)
                          ←── Output Parser
```

**Root nodes** define the AI workflow pattern. **Sub-nodes** provide capabilities to root nodes.

### AI Agent Node

An AI agent is an **autonomous system** that receives data, makes rational decisions, and acts using external tools and APIs.

#### Key Configuration

- Must connect **at least one tool sub-node**
- As of v1.82.0+, all agents work as **Tools Agent** (formerly had separate agent types)
- Connect a **Chat Model** sub-node (required)
- Optionally connect **Memory** and **Output Parser** sub-nodes

#### Agent Workflow Example

```
[Webhook Trigger] → [AI Agent] → [Respond to Webhook]
                         ↓
                   [Google Gemini Chat Model] (sub-node)
                   [Window Buffer Memory] (sub-node)
                   [HTTP Request Tool] (sub-node - calls your API)
```

#### Templates Available
- AI agent chat
- WhatsApp Chatbot with AI
- Customer support agent

### Google Gemini Chat Model (Sub-Node)

Connects to Google's Gemini API as a chat model for AI workflows.

#### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| **Model** | Gemini model to use (`gemini-2.5-flash`, `gemini-2.5-pro`, etc.) | — |
| **Max Tokens** | Maximum output tokens | Model-dependent |
| **Temperature** | Randomness (0.0 = deterministic, 1.0 = creative) | 0.7 |
| **Top K** | Number of highest-probability tokens to consider | 40 |
| **Top P** | Cumulative probability threshold (nucleus sampling) | 0.9 |
| **Safety Settings** | Content filtering categories and thresholds | Default |

#### Credential Setup
1. Go to Google AI Studio → Get API Key
2. In n8n: **Credentials** → **New** → **Google Gemini(PaLM) API**
3. Paste your API key

#### Limitation
- No proxy support for Gemini API calls from n8n

### Basic LLM Chain (Root Node)

A simpler alternative to AI Agent — sends a prompt to an LLM and returns the response. No tools, no autonomous decision-making.

#### Parameters

| Parameter | Description |
|-----------|-------------|
| **Prompt** | The text prompt to send to the LLM. Supports expressions: `{{ $json.message }}` |

#### Sub-Node Connections

| Sub-Node Type | Required? | Purpose |
|---------------|-----------|---------|
| Chat Model | Yes | The LLM to use |
| Output Parser | No | Structure the LLM response |
| Memory | No | Conversation context |

#### Output Parsers

| Parser | Use Case |
|--------|----------|
| **Auto-fixing** | Automatically retries if output doesn't match expected format |
| **Item List** | Parses comma-separated or newline-separated lists |
| **Structured** | Enforces JSON schema on LLM output |

#### Chat Messages

You can add **AI messages** (assistant role) and **System messages** to shape behavior:

```
System: You are a helpful relief volunteer assistant for ReliefConnect.
        Only answer questions about disaster relief and humanitarian aid.
AI:     Hello! I'm here to help with relief coordination. How can I assist?
```

### Window Buffer Memory (Sub-Node)

Maintains conversation history for multi-turn conversations.

#### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| **Session Key** | Unique identifier for the conversation (e.g., `userId` or `sessionId`) | `chat_history` |
| **Context Window Length** | Number of past message pairs to retain | 5 |

#### How Session Key Works

```
# In the Webhook data, pass a unique session identifier:
{{ $json.body.userId }}    →  Session key expression
```

Each unique session key maintains a separate conversation history.

#### Critical Warning

> **Do NOT use Window Buffer Memory in queue mode.** Queue mode distributes executions across workers, and in-memory state is not shared between workers. Use a persistent memory store (Redis, Postgres) instead.

### Building a Chatbot Workflow for ReliefConnect

#### Recommended Architecture

```
[Webhook: POST /chatbot]
    ↓
[AI Agent]
    ├── [Google Gemini Chat Model]  — gemini-2.5-flash
    ├── [Window Buffer Memory]      — session key: {{ $json.body.userId }}
    ├── [HTTP Request Tool]         — calls your ASP.NET Core API
    └── [Custom Code Tool]          — data formatting
    ↓
[Respond to Webhook]               — returns AI response as JSON
```

#### Webhook Configuration
- **HTTP Method:** POST
- **Path:** `/chatbot`
- **Authentication:** Header Auth (`X-API-Key: your-secret`)
- **Respond:** Using 'Respond to Webhook' Node

#### Expected Payload from ASP.NET Core

```json
{
  "userId": "user-123",
  "message": "Where can I find emergency shelter?",
  "conversationId": "conv-456",
  "latitude": 16.0544,
  "longitude": 108.2022
}
```

#### Respond to Webhook Configuration
- **Respond With:** JSON
- **Response Body:** `{{ $json.output }}`

### ASP.NET Core Integration — AI Chatbot

Replace or augment your existing `GeminiService` with n8n:

```csharp
// Instead of calling Gemini directly, route through n8n:
public async Task<ChatResponse> SendMessageAsync(ChatRequest request)
{
    var n8nPayload = new
    {
        userId = request.UserId,
        message = request.Message,
        conversationId = request.ConversationId,
        imageBase64 = request.ImageBase64,
        imageMimeType = request.ImageMimeType
    };
    
    var httpRequest = new HttpRequestMessage(HttpMethod.Post,
        "https://n8n.yourdomain.com/webhook/chatbot");
    httpRequest.Headers.Add("X-API-Key", _n8nApiKey);
    httpRequest.Content = JsonContent.Create(n8nPayload);
    
    var response = await _httpClient.SendAsync(httpRequest);
    var result = await response.Content.ReadFromJsonAsync<N8nChatResponse>();
    
    return new ChatResponse { Reply = result.Output };
}
```

**Benefits of routing through n8n:**
- Visual workflow debugging
- Easy to add tools (weather API, location lookup, database queries)
- Swap LLM models without code changes
- Add conversation memory without managing state in your backend

---

## E. HTTP Request Node

### Overview

The HTTP Request node makes HTTP calls to any API — including your ASP.NET Core backend.

### Parameters

| Parameter | Description |
|-----------|-------------|
| **Method** | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS |
| **URL** | Target endpoint URL |
| **Authentication** | Predefined credential or custom auth |
| **Send Headers** | Custom request headers |
| **Send Query Parameters** | URL query string parameters |
| **Send Body** | Request body configuration |

### Send Body Options

| Option | Description | Use Case |
|--------|-------------|----------|
| **JSON** | Send JSON body | API calls, structured data |
| **Form-Data** | Multipart form data | File uploads |
| **Form URL Encoded** | `application/x-www-form-urlencoded` | Simple form submissions |
| **Binary** | Send binary file data | File/image transfers |
| **Raw** | Custom content with specified content type | XML, plain text, etc. |
| **n8n Binary File** | Send a binary file from a previous node | Pipeline file processing |

### JSON Body — Two Modes

**Using Fields (UI):**
Add key-value pairs through the n8n UI — good for simple payloads.

**Using Raw JSON:**
Write the complete JSON body — good for complex/nested structures:
```json
{
  "userId": "{{ $json.userId }}",
  "location": {
    "lat": {{ $json.latitude }},
    "lng": {{ $json.longitude }}
  },
  "type": "SOS"
}
```

### Authentication Options

| Method | Configuration |
|--------|---------------|
| **Predefined Credential** | Select from saved credentials (recommended) |
| **Generic Auth** | Basic Auth, Header Auth, Bearer Token, OAuth2, etc. |
| **None** | No authentication |

### Calling Your ASP.NET Core API from n8n

Example: Fetch nearby pings from your MapController

**Configuration:**
- Method: `GET`
- URL: `http://your-api:5164/api/map/pings`
- Authentication: Header Auth → `Authorization: Bearer {{ $json.token }}`
- Query Parameters:
  - `latitude`: `{{ $json.lat }}`
  - `longitude`: `{{ $json.lng }}`
  - `radiusKm`: `5`

### Common Pitfalls — HTTP Request

| Issue | Solution |
|-------|----------|
| SSL certificate errors (self-signed) | Enable "Ignore SSL Issues" option (dev only!) |
| Timeout on slow APIs | Increase timeout in node options |
| Binary data not forwarded correctly | Use "Binary" body type, not JSON |
| Expression not evaluating | Use `{{ }}` syntax with correct `$json` path |
| Rate limiting from external APIs | Add a Wait node between requests or use batch processing |

---

## F. IF Node & Conditional Logic

### Overview

The IF node routes data to different paths based on conditions — equivalent to an `if/else` statement.

### Data Type Comparisons

| Data Type | Available Operators |
|-----------|-------------------|
| **String** | equals, not equals, contains, not contains, starts with, ends with, regex match, is empty, is not empty |
| **Number** | equals, not equals, greater than, less than, greater than or equal, less than or equal, is empty, is not empty |
| **Date & Time** | before, after, equals |
| **Boolean** | is true, is false, equals, not equals |
| **Object** | exists, not exists |

### Combining Conditions

- **AND** — All conditions must be true
- **OR** — At least one condition must be true

### Outputs

| Output | Description |
|--------|-------------|
| **True** | Items matching the conditions |
| **False** | Items NOT matching the conditions |

### Multiple Conditions: Use Switch Node

For more than two outputs (>2 branches), use the **Switch** node instead.

### Example: Route by User Role

```
IF condition:
  Value 1: {{ $json.body.userRole }}
  Operation: equals
  Value 2: "Admin"
  
  TRUE  → [Admin workflow branch]
  FALSE → [Regular user branch]
```

### Example: Check SOS Priority

```
Condition 1 (AND):
  {{ $json.body.status }}  equals  "Active"
  {{ $json.body.priority }}  greater than  3

TRUE  → [High priority SOS handler]
FALSE → [Standard handler]
```

### ASP.NET Core Relevance

Use IF nodes to:
- Route chatbot messages based on intent classification
- Filter SOS alerts by severity before processing
- Branch based on user verification status
- Handle different response formats based on request headers

---

## G. Respond to Webhook Node

### Overview

Gives you **full control** over the HTTP response sent back to the webhook caller. Used in combination with a Webhook node set to `Respond > Using 'Respond to Webhook' Node`.

### Respond With Options

| Option | Description |
|--------|-------------|
| **All Incoming Items** | Send all data items as JSON array |
| **First Incoming Item** | Send only the first item |
| **JSON** | Custom JSON response body |
| **Binary File** | Return a file |
| **JWT Token** | Return a signed JWT |
| **No Data** | Empty 200 response |
| **Redirect** | HTTP redirect (301/302) |
| **Text** | Plain text response |

### Options

| Option | Description |
|--------|-------------|
| **Response Code** | HTTP status code (200, 201, 400, 404, 500, etc.) |
| **Response Headers** | Custom headers (`Content-Type`, `X-Custom-Header`, etc.) |
| **Put Response in Field** | Nests the response under a specific JSON key |
| **Enable Streaming** | Stream response chunks in real-time (for AI workflows) |

### Workflow Behavior

> The Respond to Webhook node returns data to the caller **at the point it executes**. The workflow can continue after this node — any subsequent nodes still run, but the caller already has the response.

This is useful for:
1. Sending a quick acknowledgment, then doing heavy processing
2. Returning intermediate results while background tasks continue

### Example: Chatbot Response

```json
// Respond to Webhook configuration:
// Respond With: JSON
// Response Code: 200
// Response Headers: Content-Type: application/json

// Response Body (expression):
{
  "success": true,
  "reply": "{{ $json.output }}",
  "conversationId": "{{ $json.conversationId }}",
  "timestamp": "{{ $now.toISO() }}"
}
```

### Example: Error Response

```json
// Respond With: JSON
// Response Code: 400

{
  "success": false,
  "error": "{{ $json.errorMessage }}",
  "code": "INVALID_REQUEST"
}
```

### Streaming for AI Chatbot

To enable streaming responses (SSE-like):

1. **Webhook node:** Set Respond to `Streaming response`
2. **AI Agent/LLM Chain:** Must support streaming
3. The response streams token-by-token to the caller

Your ASP.NET Core frontend can consume this with `ReadAsStreamAsync()`.

---

## H. n8n REST API

### Overview

n8n exposes a **REST API** for programmatically managing workflows, executions, and credentials. Useful for:
- Activating/deactivating workflows from your backend
- Monitoring execution status
- Creating workflows programmatically
- Integrating n8n management into your admin dashboard

### API Authentication

#### Method 1: API Key (recommended for server-to-server)

1. Go to n8n **Settings** → **API**
2. Create an API key
3. Include in request header:

```
X-N8N-API-KEY: your-api-key-here
```

#### Method 2: JWT/Session (for browser-based access)

Login via `/api/v1/login` and use session cookies.

### Base URL

```
https://your-n8n-instance.com/api/v1/
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workflows` | GET | List all workflows |
| `/workflows` | POST | Create a workflow |
| `/workflows/:id` | GET | Get a specific workflow |
| `/workflows/:id` | PUT | Update a workflow |
| `/workflows/:id/activate` | POST | Activate a workflow |
| `/workflows/:id/deactivate` | POST | Deactivate a workflow |
| `/executions` | GET | List executions |
| `/executions/:id` | GET | Get execution details |
| `/executions/:id` | DELETE | Delete an execution |
| `/credentials` | GET | List credentials |

### Pagination

n8n API responses are paginated:

```
GET /api/v1/workflows?limit=10&cursor=<cursor-from-previous-response>
```

Response includes:
```json
{
  "data": [...],
  "nextCursor": "eyJsaW1pdCI6..."
}
```

### API Playground

n8n includes a built-in **Swagger/OpenAPI playground** at:

```
https://your-n8n-instance.com/api/v1/docs
```

### ASP.NET Core — Managing n8n Workflows

```csharp
public class N8nManagementService
{
    private readonly HttpClient _httpClient;
    
    public N8nManagementService(IHttpClientFactory factory)
    {
        _httpClient = factory.CreateClient("n8n-api");
        _httpClient.BaseAddress = new Uri("https://n8n.yourdomain.com/api/v1/");
        _httpClient.DefaultRequestHeaders.Add("X-N8N-API-KEY", "<your-api-key>");
    }
    
    public async Task<bool> ActivateWorkflowAsync(string workflowId)
    {
        var response = await _httpClient.PostAsync(
            $"workflows/{workflowId}/activate", null);
        return response.IsSuccessStatusCode;
    }
    
    public async Task<List<Execution>> GetRecentExecutionsAsync(int limit = 20)
    {
        var response = await _httpClient.GetFromJsonAsync<ExecutionListResponse>(
            $"executions?limit={limit}");
        return response.Data;
    }
}
```

### Common Pitfalls — API

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check API key is correct and included as `X-N8N-API-KEY` header |
| API disabled | Self-hosted: API is enabled by default. Check `N8N_PUBLIC_API_DISABLED` env var |
| Pagination missing items | Use `nextCursor` from response, not manual `offset` |
| Rate limits | n8n doesn't enforce API rate limits by default, but your reverse proxy might |

---

## I. Authentication & Security

### Webhook Authentication

#### Basic Auth

```
Username: myapp
Password: secret123
```

The caller must include `Authorization: Basic <base64(user:pass)>` header.

#### Header Auth

```
Header Name: X-API-Key
Header Value: your-secret-key
```

The caller must include `X-API-Key: your-secret-key` header.

#### JWT Auth

n8n validates the JWT token in the `Authorization: Bearer <token>` header. Configure:
- Secret or public key for validation
- Algorithm (HS256, RS256, etc.)
- Optional: required claims

### Platform Security

#### SSL/HTTPS

- **Strongly recommended** for production
- Use a reverse proxy (Nginx, Caddy, Traefik) with Let's Encrypt
- n8n only accessible via HTTPS when properly configured

#### SSO (Single Sign-On)

Available on Business/Enterprise editions:

| Protocol | Support |
|----------|---------|
| **SAML** | Full support |
| **OIDC** (OpenID Connect) | Full support |
| **LDAP** | Full support |

#### Two-Factor Authentication (2FA)

n8n supports 2FA with TOTP (Time-based One-Time Password) for user accounts.

#### RBAC (Role-Based Access Control)

| Feature | Edition |
|---------|---------|
| **Role types** (owner, admin, member) | Business+ |
| **Projects** (workflow isolation) | Business+ |
| **Custom roles** | Enterprise only |

### Security Best Practices

1. **Always set `N8N_ENCRYPTION_KEY`** — Without it, n8n auto-generates one. If the container is recreated, you lose access to all saved credentials.

2. **Use HTTPS** — Webhook data and API keys travel in plaintext over HTTP.

3. **Restrict API access** — Set `N8N_PUBLIC_API_DISABLED=true` if you don't need the API, or restrict by IP.

4. **IP whitelist webhooks** — Use the IP(s) Whitelist option on Webhook nodes for production.

5. **Audit credentials** — n8n stores credentials encrypted in the database. Rotate API keys regularly.

6. **SSRF Protection** — n8n has built-in SSRF protection to prevent internal network scanning via HTTP Request nodes.

### ASP.NET Core ↔ n8n Security

For your ReliefConnect integration:

```csharp
// Register n8n HTTP clients with proper auth
builder.Services.AddHttpClient("n8n-webhook", client =>
{
    client.BaseAddress = new Uri(config["N8n:WebhookBaseUrl"]!);
    client.DefaultRequestHeaders.Add("X-API-Key", config["N8n:WebhookApiKey"]!);
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddHttpClient("n8n-api", client =>
{
    client.BaseAddress = new Uri(config["N8n:ApiBaseUrl"]!);
    client.DefaultRequestHeaders.Add("X-N8N-API-KEY", config["N8n:ApiKey"]!);
    client.Timeout = TimeSpan.FromSeconds(10);
});
```

Store n8n keys in `appsettings.json` (dev) or environment variables / Azure Key Vault / `dotnet user-secrets` (production):

```json
{
  "N8n": {
    "WebhookBaseUrl": "https://n8n.yourdomain.com/webhook/",
    "WebhookApiKey": "your-webhook-secret",
    "ApiBaseUrl": "https://n8n.yourdomain.com/api/v1/",
    "ApiKey": "your-n8n-api-key"
  }
}
```

---

## J. Best Practices & Common Pitfalls

### Workflow Design

| Practice | Why |
|----------|-----|
| Use **Respond to Webhook** for API-like workflows | Full control over response format and status codes |
| Set Webhook to **Respond Immediately** for fire-and-forget | Don't block callers if they don't need the result |
| Use **error workflows** | Set a global error workflow in Settings to catch failures |
| Keep workflows small and focused | Split complex logic into sub-workflows for maintainability |
| Use **Sticky Notes** | Document what each section of the workflow does |
| Use **Tags** | Organize workflows by feature (chatbot, SOS, admin, etc.) |

### Performance

| Practice | Why |
|----------|-----|
| Use **queue mode** for scaling | Distributes executions across worker processes |
| Set execution data pruning | Prevents database bloat: `EXECUTIONS_DATA_PRUNE=true` |
| Limit context window in Memory nodes | Large histories increase token costs and latency |
| Use `N8N_PAYLOAD_SIZE_MAX` wisely | Don't set too high — large payloads consume memory |
| Cache static data | Use Code nodes to cache API responses when appropriate |

### Error Handling

| Practice | Why |
|----------|-----|
| Set **Continue on Fail** on non-critical nodes | Prevents entire workflow from stopping |
| Use **IF node** after API calls to check status | Route errors to dedicated error handling branches |
| Configure **workflow timeout** | Prevent runaway workflows: `EXECUTIONS_TIMEOUT=300` (seconds) |
| Use **Stop and Error** node | Explicitly fail with a custom error message |

### n8n + ASP.NET Core Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                    │
│  - Sends chat messages to ASP.NET Core API                  │
│  - Receives responses normally                              │
└────────────────┬────────────────────────────────────────────┘
                 │ POST /api/chatbot/message
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  ASP.NET Core API (ReliefConnect)                           │
│  - Validates request, checks auth                           │
│  - Forwards to n8n webhook with user context                │
│  - Returns n8n response to frontend                         │
└────────────────┬────────────────────────────────────────────┘
                 │ POST /webhook/chatbot (with X-API-Key)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  n8n Workflow                                               │
│                                                             │
│  [Webhook] → [AI Agent] → [Respond to Webhook]             │
│                  ↓                                          │
│            ┌─── Sub-Nodes ───┐                              │
│            │ Gemini Chat Model│                              │
│            │ Window Buffer Mem│                              │
│            │ HTTP Request Tool│──→ ASP.NET Core API          │
│            │ Code Tool        │   (fetch user data, pings)  │
│            └─────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

### Common Pitfalls Summary

| # | Pitfall | Solution |
|---|---------|----------|
| 1 | Forgetting to activate workflow | Production webhooks only work on **active** workflows |
| 2 | Test URL vs Production URL confusion | Test URLs have `/webhook-test/` prefix |
| 3 | Lost credentials after Docker rebuild | Always persist `/home/node/.n8n` volume and back up `N8N_ENCRYPTION_KEY` |
| 4 | Memory node in queue mode | Use persistent memory stores (Redis, Postgres), not in-memory |
| 5 | Webhook URL unreachable | Set `WEBHOOK_URL` environment variable to public HTTPS URL |
| 6 | No error handling | Add error workflows and use Continue on Fail |
| 7 | Hardcoded URLs in workflows | Use environment variables via n8n's variable system |
| 8 | Large payload failures | Check and increase `N8N_PAYLOAD_SIZE_MAX` |
| 9 | AI responses inconsistent | Set lower `Temperature` (0.1-0.3) for deterministic outputs |
| 10 | CORS errors calling webhooks | Set Allowed Origins in Webhook node options |

### Migration Path from Direct Gemini Calls

Your current `GeminiService` calls Gemini directly. To migrate to n8n:

1. **Keep your existing endpoint** (`/api/chatbot/message`) — no frontend changes needed
2. **Create n8n workflow** with Webhook → AI Agent → Respond to Webhook
3. **Update `ChatbotController`** to forward requests to n8n webhook instead of `GeminiService`
4. **Benefits gained:**
   - Visual debugging of AI conversations
   - Easy tool addition (no C# code changes)
   - Model swapping via UI (Gemini → GPT → Claude)
   - Built-in conversation memory management
   - Workflow error monitoring dashboard

---

## Quick Reference Card

### URLs

| Resource | URL |
|----------|-----|
| n8n Editor | `https://n8n.yourdomain.com/` |
| Webhook Base | `https://n8n.yourdomain.com/webhook/` |
| Test Webhook | `https://n8n.yourdomain.com/webhook-test/` |
| REST API | `https://n8n.yourdomain.com/api/v1/` |
| API Docs | `https://n8n.yourdomain.com/api/v1/docs` |

### Key Docker Commands

```bash
docker compose up -d          # Start
docker compose stop           # Stop
docker compose logs -f n8n    # Logs
docker compose pull && docker compose up -d  # Update
```

### Key Environment Variables (minimal production)

```env
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=<secret>
N8N_ENCRYPTION_KEY=<32-char-random>
WEBHOOK_URL=https://n8n.yourdomain.com/
GENERIC_TIMEZONE=Asia/Ho_Chi_Minh
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=336
```

---

## K. Dify Knowledge Base & RAG Integration

> **Source references:** Dify GitHub source code (`api/controllers/service_api/dataset/hit_testing.py`, `api/services/entities/knowledge_entities/knowledge_entities.py`, `api/services/dataset_service.py`) + Dify blog articles on hybrid search + n8n official HTTP Request node documentation.

---

### K.1 What is Dify?

[Dify](https://dify.ai) is an open-source LLM application platform (137k+ GitHub stars, actively maintained by LangGenius Inc.) that provides:

- **Chatflow / Chatbot** — Conversational applications with RAG pipelines, tool use, and memory
- **Workflow** — Directed acyclic graph (DAG) automations with AI nodes
- **Knowledge Base** — Document store with vector indexing, hybrid search, and reranking
- **Agent** — ReAct / function-calling agents with tools
- **Text Generator** — Completion-style applications

#### Key Technical Stack

| Component | Technology |
|-----------|------------|
| Vector Database | Qdrant (default), Weaviate, Milvus, PGVector, Chroma, OpenSearch |
| Embedding Models | OpenAI text-embedding-3, Cohere, Jina, local models |
| Reranking | Cohere Rerank, bge-reranker, NVIDIA NIM |
| Full-text Search | Elasticsearch / OpenSearch BM25 |
| API Base URL (Cloud) | `https://api.dify.ai/v1` |
| API Base URL (Self-hosted) | `http://{your-host}/v1` |
| Auth | `Authorization: Bearer {api-key}` header |

#### No Official n8n Dify Node

**Confirmed:** There is no official n8n Dify integration node (the marketplace URL `n8n.io/integrations/dify/` returns 404). You **must** use the **HTTP Request node** to call Dify APIs. This is actually fine — the Dify REST API is well-documented and the HTTP Request node gives you full control.

---

### K.2 Dify Knowledge Base API

#### K.2.1 Endpoint

```
POST /v1/datasets/{dataset_id}/retrieve
```

Also supported (alias): `POST /v1/datasets/{dataset_id}/hit-testing`

**Full URL example:**
```
POST https://api.dify.ai/v1/datasets/abc123def456.../retrieve
Authorization: Bearer {dataset-api-key}
Content-Type: application/json
```

> **Important:** Each Dify knowledge base (dataset) has its own separate API key, distinct from your chatflow app API key. Get it from: Dify Dashboard → Knowledge → Select Dataset → API Access.

#### K.2.2 Complete Request Schema

```json
{
  "query": "string — the user's question or search input",
  "retrieval_model": {
    "search_method": "hybrid_search",
    "reranking_enable": true,
    "reranking_mode": "reranking_model",
    "reranking_model": {
      "reranking_provider_name": "cohere",
      "reranking_model_name": "rerank-multilingual-v3.0"
    },
    "top_k": 5,
    "score_threshold_enabled": true,
    "score_threshold": 0.5,
    "weights": null
  }
}
```

#### K.2.3 RetrievalModel Field Reference

Confirmed from `knowledge_entities.py` source code:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `search_method` | `string` | ✅ | `"semantic_search"`, `"full_text_search"`, or `"hybrid_search"` |
| `reranking_enable` | `boolean` | ✅ | Whether to apply reranking to results |
| `reranking_mode` | `string \| null` | ❌ | `"reranking_model"` or `"weighted_score"` (used with weighted hybrid) |
| `reranking_model` | `object \| null` | ❌ | Required when `reranking_enable=true` and `reranking_mode="reranking_model"` |
| `reranking_model.reranking_provider_name` | `string` | — | Provider name, e.g., `"cohere"`, `"xinference"` |
| `reranking_model.reranking_model_name` | `string` | — | Model name, e.g., `"rerank-multilingual-v3.0"` |
| `top_k` | `integer` | ✅ | Number of chunks to retrieve; default `4` |
| `score_threshold_enabled` | `boolean` | ✅ | Whether to apply a minimum relevance score filter |
| `score_threshold` | `float \| null` | ❌ | Minimum score (0.0–1.0); only applied when `score_threshold_enabled=true` |
| `weights` | `object \| null` | ❌ | Used with weighted hybrid search (see K.2.4) |

#### K.2.4 Weighted Hybrid Search (Custom Ratios)

When using `search_method: "hybrid_search"` with `reranking_mode: "weighted_score"`, you can tune the balance between vector and keyword search:

```json
{
  "query": "...",
  "retrieval_model": {
    "search_method": "hybrid_search",
    "reranking_enable": false,
    "reranking_mode": "weighted_score",
    "top_k": 5,
    "score_threshold_enabled": false,
    "weights": {
      "vector_setting": {
        "vector_weight": 0.7
      },
      "keyword_setting": {
        "keyword_weight": 0.3
      }
    }
  }
}
```

> `vector_weight + keyword_weight` should equal `1.0`. Default (when not specified) is typically 0.5/0.5 or RRF (Reciprocal Rank Fusion).

#### K.2.5 Search Method Selection Guide

| Scenario | Recommended `search_method` | Reason |
|----------|------------------------------|--------|
| General semantic questions (Vietnamese) | `hybrid_search` | Best overall accuracy |
| Exact name/ID/code lookup | `full_text_search` | BM25 excels at exact term matching |
| Multilingual Q&A | `hybrid_search` + Cohere Rerank | Handles Vietnamese-English mixed content |
| Low-latency / free tier | `semantic_search` | No BM25 index needed (ECONOMY tier) |
| After keyword search misses | `hybrid_search` | Combines semantic + keyword for robustness |

#### K.2.6 Default Values (from source code)

```python
# api/services/dataset_service.py defaults:
default_retrieval_model = {
    "search_method": "semantic_search",
    "reranking_enable": False,
    "reranking_model": {
        "reranking_provider_name": "",
        "reranking_model_name": ""
    },
    "top_k": 4,
    "score_threshold_enabled": False,
}
```

#### K.2.7 Response Schema

```json
{
  "query": {
    "content": "original query string"
  },
  "records": [
    {
      "segment": {
        "id": "UUID",
        "position": 1,
        "document_id": "UUID",
        "content": "The actual text content of the retrieved chunk...",
        "sign_content": "...",
        "word_count": 142,
        "tokens": 178,
        "keywords": ["keyword1", "keyword2"],
        "index_node_id": "...",
        "index_node_hash": "...",
        "hit_count": 3,
        "enabled": true,
        "disabled_at": null,
        "status": "completed",
        "document": {
          "id": "UUID",
          "data_source_type": "upload_file",
          "name": "relief_aid_policy.pdf",
          "doc_type": null
        }
      },
      "score": 0.87,
      "tsne_position": null
    }
  ]
}
```

Key fields to extract in n8n:
- `{{ $json.records[0].segment.content }}` — The retrieved text
- `{{ $json.records[0].score }}` — Relevance score (0.0–1.0)
- `{{ $json.records[0].segment.document.name }}` — Source document name

---

### K.3 Dify Chatflow / Application API

#### K.3.1 Chatflow Chat Messages Endpoint

```
POST /v1/chat-messages
Authorization: Bearer {chatflow-app-api-key}
Content-Type: application/json
```

> **Note:** This API key is from your Chatflow **app** (not the dataset). Get it from: Dify Dashboard → Your App → API Access.

#### K.3.2 Request Body

```json
{
  "inputs": {},
  "query": "Làm thế nào để nhận viện trợ cứu trợ?",
  "response_mode": "blocking",
  "conversation_id": "optional-UUID-for-continuing-conversation",
  "user": "user-123"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `inputs` | `object` | Key-value pairs for workflow variables (can be `{}`) |
| `query` | `string` | The user's message |
| `response_mode` | `string` | `"blocking"` (wait for full response) or `"streaming"` (SSE) |
| `conversation_id` | `string \| null` | Continue existing conversation; omit for new conversation |
| `user` | `string` | User identifier for logging/memory scoping |

#### K.3.3 Chatflow Response

```json
{
  "message_id": "UUID",
  "conversation_id": "UUID",
  "mode": "chat",
  "answer": "Để nhận viện trợ cứu trợ, bạn cần...",
  "metadata": {
    "usage": {
      "total_tokens": 234,
      "total_price": "0.00012"
    },
    "retriever_resources": [
      {
        "position": 1,
        "dataset_id": "...",
        "dataset_name": "Relief Aid Policies",
        "document_id": "...",
        "document_name": "policies_2025.pdf",
        "segment_id": "...",
        "score": 0.85,
        "content": "Relief aid distribution process..."
      }
    ]
  },
  "created_at": 1735000000
}
```

Key fields:
- `{{ $json.answer }}` — The AI's response text
- `{{ $json.conversation_id }}` — Save for follow-up messages
- `{{ $json.metadata.retriever_resources }}` — Source citations from Knowledge Base

#### K.3.4 Workflow Run Endpoint (for Dify Workflows, not Chatflows)

If you are calling a Dify **Workflow** (not a Chatflow app):

```
POST /v1/workflows/run
Authorization: Bearer {workflow-app-api-key}
Content-Type: application/json
```

```json
{
  "inputs": {
    "query": "How do I register for relief aid?",
    "user_role": "person_in_need"
  },
  "response_mode": "blocking",
  "user": "user-123"
}
```

---

### K.4 Hybrid Search & Reranking — Technical Details

#### K.4.1 Why Hybrid Search?

Pure semantic search (vector similarity) fails on:
- **Exact names and IDs**: `"Trung tâm cứu trợ Bình Dương"` — BM25 matches exactly; vector search may miss
- **Technical codes**: Product numbers, zone IDs, form codes
- **Rare terms**: Words not well-represented in embedding models

Pure keyword search (BM25) fails on:
- **Synonyms**: `"giúp đỡ"` vs `"hỗ trợ"` vs `"viện trợ"` — all mean aid/assistance
- **Cross-language queries**: Vietnamese question matching English document
- **Paraphrase matching**: `"I need food"` should match `"food distribution program"`

**Hybrid search** combines both: vector results and BM25 results are merged and re-ranked.

#### K.4.2 Result Fusion Methods

| Method | Description | Best For |
|--------|-------------|----------|
| **RRF** (Reciprocal Rank Fusion) | Rank-based fusion, score-independent | General use, default |
| **Weighted Score** | `α × vector_score + (1−α) × bm25_score` | When you want fine-grained tuning |

Dify supports both via `reranking_mode`:
- `"reranking_model"` → Use a cross-encoder model (Cohere, bge-reranker) to re-score all candidates
- `"weighted_score"` → Use linear combination with `weights` object

#### K.4.3 Reranking Models

A **reranker** (cross-encoder) takes `(query, candidate_chunk)` pairs and produces a relevance score. More accurate than bi-encoder similarity but slower (runs on merged candidate set, not full corpus).

| Model | Provider | Vietnamese | Notes |
|-------|----------|-----------|-------|
| `rerank-multilingual-v3.0` | Cohere | ✅ **Excellent** | Best multilingual option; 100+ languages |
| `rerank-english-v3.0` | Cohere | ❌ | English only |
| `bge-reranker-large` | HuggingFace/Xinference | ⚠️ Limited | Primarily Chinese/English; weaker on Vietnamese |
| `bge-reranker-v2-m3` | HuggingFace/Xinference | ✅ Good | Multilingual version; good Vietnamese support |
| NVIDIA NIM Reranker | NVIDIA | ❌ | English-focused |

**Recommendation for ReliefConnect (Vietnamese platform):** Use `cohere/rerank-multilingual-v3.0`.

#### K.4.4 Performance Data (from Dify v0.3.31 release)

Testing with Ragas evaluation framework after enabling hybrid search + Cohere reranker:

| Metric | Pure Vector | Hybrid + Rerank | Improvement |
|--------|-------------|-----------------|-------------|
| Ragas Score | baseline | +18.44% | ↑ |
| Context Precision | baseline | +20.00% | ↑ |
| Faithfulness | baseline | +35.71% | ↑ |

#### K.4.5 `top_k` Tuning Guide

`top_k` controls how many chunks are passed to the LLM's context window.

| `top_k` | Pros | Cons |
|---------|------|------|
| 2-3 | Fast, focused, low cost | May miss relevant info |
| 5-8 | Good balance | Moderate cost |
| 10+ | High recall | Context overflow risk, higher cost, distraction |

**Recommended for ReliefConnect:**
- Simple FAQ queries: `top_k = 3`
- Complex policy questions: `top_k = 6`
- With reranker: can safely use `top_k = 8` (reranker filters noise)

#### K.4.6 Chunking Strategy for Vietnamese

Vietnamese text characteristics to consider:
- Average sentence length: 15-25 words (shorter than English)
- Compound words formed by multi-syllable combinations
- No space between syllables within compound words requires context

| Setting | Recommended Value | Why |
|---------|------------------|-----|
| `max_tokens` (chunk size) | `800–1024` | Enough context without truncating paragraphs |
| `chunk_overlap` | `80–100` | Higher overlap captures cross-boundary context better in Vietnamese |
| `delimiter` | `"\n\n"` | Paragraph-level splitting; respect natural boundaries |
| `indexing_technique` | `"high_quality"` | Use embedding model; `"economy"` is keyword-only |

---

### K.5 Index Structure Types

Dify supports multiple document index structures:

| Index Type | `doc_form` value | Best For |
|------------|-----------------|---------|
| **Text Chunks** (default) | `"text_model"` | General documents, policies, guides |
| **QA Pairs** | `"qa_model"` | FAQ-style content where each entry is Q+A |
| **Parent-Child** | `"parent_child_index"` | Hierarchical documents with sections/subsections |
| **Summary Index** (v1.12.0+) | requires `summary_index_setting` | Long documents needing high-level summary retrieval |

**Recommended for ReliefConnect knowledge base:** `"text_model"` with hybrid search.

---

### K.6 n8n Workflow Designs for Dify Integration

#### K.6.1 Architecture Overview

```
User (ReliefConnect Frontend)
    │
    ▼  HTTP POST /api/chatbot/message
ASP.NET Core ChatbotController
    │
    ▼  HTTP POST {n8n-webhook-url}
n8n Webhook Trigger
    │
    ├──→ [A] HTTP Request → Dify Knowledge Base Retrieve API
    │         └── Returns: retrieved_chunks (array of relevant text)
    │
    ├──→ [B] IF Node: query complexity check
    │         ├── SIMPLE → HTTP Request → Dify Chatflow (Gemini Flash)
    │         └── COMPLEX → HTTP Request → Dify Chatflow (GPT-4o / Gemini Pro)
    │
    ▼
Respond to Webhook → ASP.NET Core → Frontend
```

#### K.6.2 Pattern 1 — Direct Dify Chatflow (Simplest)

**Use case:** Let Dify handle everything — your Dify Chatflow already has Knowledge Retrieval + LLM nodes configured. n8n is just a pass-through with session management.

```
Webhook Trigger
    │
    ▼
HTTP Request Node (Dify Chat Messages)
    Method: POST
    URL: https://api.dify.ai/v1/chat-messages
    Headers:
        Authorization: Bearer {{$env.DIFY_CHATFLOW_API_KEY}}
        Content-Type: application/json
    Body (JSON):
        {
          "inputs": {},
          "query": "{{$json.message}}",
          "response_mode": "blocking",
          "conversation_id": "{{$json.conversationId || ''}}",
          "user": "{{$json.userId}}"
        }
    │
    ▼
Edit Fields Node
    answer = {{$json.answer}}
    conversation_id = {{$json.conversation_id}}
    sources = {{$json.metadata.retriever_resources}}
    │
    ▼
Respond to Webhook
```

#### K.6.3 Pattern 2 — n8n Handles Retrieval + Routing (Advanced)

**Use case:** Route queries to different LLMs based on complexity. Retrieve context from Dify Knowledge Base, then use different AI models from n8n's LangChain nodes.

```
Webhook Trigger
    │
    ▼
IF Node: Is query complex?
    Condition: {{$json.message.length}} > 100 OR contains keywords ["policy", "law", "regulation", "chính sách", "quy định"]
    │
    ├── SIMPLE (true branch) ──────────────────────────────────┐
    │       ▼                                                   │
    │   HTTP Request: Dify KB Retrieve (top_k=3)               │
    │       ▼                                                   │
    │   Basic LLM Chain (Gemini 2.0 Flash)                     │
    │       │                                                   │
    └──────────────────────────── COMPLEX (false branch) ──────┤
                    ▼                                           │
                HTTP Request: Dify KB Retrieve (top_k=8)       │
                    ▼                                           │
                AI Agent (GPT-4o / Gemini Pro)                 │
                    + Tool: Dify KB Retrieve node               │
                    │                                           │
                    ▼───────────────────────────────────────────┘
                Respond to Webhook
```

#### K.6.4 Pattern 3 — n8n Text Classifier for Query Routing

Use n8n's built-in **Text Classifier** node to route queries by intent:

```
Webhook Trigger
    │
    ▼
Text Classifier Node
    Model: Google Gemini Chat Model / OpenAI Chat Model
    Categories:
        - "emergency_sos": user needs immediate help, life-threatening
        - "aid_information": questions about aid programs, eligibility, locations
        - "registration": how to register, submit applications
        - "general_chat": greetings, small talk, unclear intent
    │
    ├── emergency_sos ──→ HTTP POST to ReliefConnect SOS API
    ├── aid_information ──→ HTTP Request: Dify KB + Gemini Flash
    ├── registration ──→ HTTP Request: Dify KB + GPT-4o (complex form guidance)
    └── general_chat ──→ Basic LLM Chain (Gemini Flash, no KB lookup)
```

---

### K.7 n8n HTTP Request Node Configuration for Dify

#### K.7.1 Dify Knowledge Base Retrieve — Full Node Config

```
Node Type: HTTP Request
Name: "Dify: Retrieve Knowledge"

Parameters:
  Method: POST
  URL: https://api.dify.ai/v1/datasets/{{$env.DIFY_DATASET_ID}}/retrieve

Authentication:
  Type: Generic Credential Type
  Credential Type: Header Auth
  Credential Name: "Dify Dataset API Key"
    Name: Authorization
    Value: Bearer {{your-dataset-api-key}}

Send Body: ON
Body Content Type: JSON
Body (Using JSON):
{
  "query": "{{$json.body.message}}",
  "retrieval_model": {
    "search_method": "hybrid_search",
    "reranking_enable": true,
    "reranking_mode": "reranking_model",
    "reranking_model": {
      "reranking_provider_name": "cohere",
      "reranking_model_name": "rerank-multilingual-v3.0"
    },
    "top_k": 6,
    "score_threshold_enabled": true,
    "score_threshold": 0.4
  }
}

Options:
  Timeout: 30000 (30 seconds)
  Response: JSON
```

#### K.7.2 Dify Chatflow Chat Messages — Full Node Config

```
Node Type: HTTP Request
Name: "Dify: Chat with Chatflow"

Parameters:
  Method: POST
  URL: https://api.dify.ai/v1/chat-messages

Authentication:
  Type: Generic Credential Type
  Credential Type: Header Auth
  Credential Name: "Dify Chatflow API Key"
    Name: Authorization
    Value: Bearer {{your-chatflow-api-key}}

Send Body: ON
Body Content Type: JSON
Body (Using JSON):
{
  "inputs": {},
  "query": "{{$('Webhook').item.json.body.message}}",
  "response_mode": "blocking",
  "conversation_id": "{{$('Webhook').item.json.body.conversationId || ''}}",
  "user": "{{$('Webhook').item.json.body.userId || 'anonymous'}}"
}

Options:
  Timeout: 60000 (60 seconds — Dify can take time with large contexts)
  Response: JSON
```

#### K.7.3 Extracting Retrieved Chunks in Subsequent Nodes

After the Dify KB Retrieve node returns, format the context for LLM consumption in a **Code node**:

```javascript
// Code Node (JavaScript)
const records = $input.item.json.records || [];

// Format top chunks as context string
const context = records
  .slice(0, 5)
  .map((r, i) => `[${i+1}] ${r.segment.content} (score: ${r.score.toFixed(2)})`)
  .join('\n\n');

// Collect source citations
const sources = records.map(r => ({
  document: r.segment.document.name,
  score: r.score,
  excerpt: r.segment.content.substring(0, 200)
}));

return [{
  json: {
    context,
    sources,
    queryText: $('Webhook').item.json.body.message
  }
}];
```

Then in a **Basic LLM Chain** node:

```
System prompt:
You are a helpful assistant for ReliefConnect, a humanitarian aid platform serving Vietnamese communities.
Answer based ONLY on the provided context. If the context doesn't contain the answer, say so.
Always respond in the same language as the user's question.

Context:
{{ $('Code').item.json.context }}

User question: {{ $('Code').item.json.queryText }}
```

---

### K.8 Query Complexity Routing

#### K.8.1 Simple vs Complex Query Signals

| Signal | Simple Query | Complex Query |
|--------|-------------|---------------|
| Length | < 50 characters | > 100 characters |
| Intent | Single fact lookup | Multi-step reasoning |
| Language | Single language | Code-switching (Viet-English mix) |
| Subject | FAQ-style | Policy interpretation, legal, medical |
| Keywords | Greetings, "where", "when" | "How should I", "What if", "Explain why", "chính sách", "quy trình", "thủ tục" |

#### K.8.2 IF Node Configuration for Complexity Routing

```
Node Type: IF
Name: "Route by Query Complexity"

Condition 1 (OR logic):
  Value 1: {{ $json.body.message.length }}
  Operation: Is Larger Than
  Value 2: 100

Condition 2:
  Value 1: {{ $json.body.message.toLowerCase() }}
  Operation: Contains
  Value 2: "chính sách"   [OR: "quy định" / "thủ tục" / "policy" / "regulation"]
```

#### K.8.3 LLM Model Assignment by Complexity

| Tier | Model | Use Case | Approx Cost |
|------|-------|----------|-------------|
| **Simple** | Gemini 2.0 Flash | Quick FAQ, greetings, simple lookups | Very low |
| **Simple** | GPT-4o mini | Alternative to Gemini Flash | Low |
| **Complex** | Gemini 2.5 Pro | Complex reasoning, multi-step analysis | Medium |
| **Complex** | GPT-4o | Nuanced policy interpretation | Medium-High |
| **Complex** | Claude 3.5 Sonnet | Long-document analysis, precise instructions | Medium-High |

In n8n, set up two separate sub-paths after the IF node, each with a different **Chat Model** sub-node configured in the **Basic LLM Chain**.

---

### K.9 ReliefConnect-Specific Configuration

#### K.9.1 Recommended Dify Knowledge Base Setup

For ReliefConnect's Vietnamese humanitarian aid platform:

```
Dataset Settings:
  Name: "ReliefConnect Aid Knowledge Base"
  Language: Vietnamese (primary) + English (secondary)
  Indexing Technique: HIGH_QUALITY (embedding-based)
  Embedding Model: text-embedding-3-large (OpenAI) OR jina-embeddings-v3 (multilingual)

Document Chunking:
  Delimiter: "\n\n"  (paragraph-level)
  Max Tokens: 1024
  Chunk Overlap: 100  (higher than default for Vietnamese context continuity)

Retrieval Settings:
  Search Method: hybrid_search
  Reranking: ENABLED
  Reranking Model: cohere / rerank-multilingual-v3.0
  Top K: 6
  Score Threshold: 0.35 (slightly lower tolerance for Vietnamese content)
```

#### K.9.2 n8n Credential Setup for Dify

1. In n8n: **Credentials** → **New** → **Header Auth**
2. Create two credentials:
   - `Dify Knowledge Base API` → Name: `Authorization`, Value: `Bearer {dataset-api-key}`
   - `Dify Chatflow API` → Name: `Authorization`, Value: `Bearer {chatflow-api-key}`
3. Store sensitive values in n8n Variables (Settings → Variables):
   - `DIFY_DATASET_ID` = your dataset UUID
   - `DIFY_BASE_URL` = `https://api.dify.ai/v1` (or your self-hosted URL)

#### K.9.3 ASP.NET Core Integration Pattern

To integrate with ReliefConnect's existing `ChatbotController`:

```csharp
// Option A: Forward chatbot requests to n8n, which handles Dify
// In ReliefConnect.API/Controllers/ChatbotController.cs

[HttpPost("message")]
[Authorize]
public async Task<IActionResult> SendMessage([FromBody] ChatMessageDto dto)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    
    var n8nPayload = new
    {
        message = dto.Message,
        userId = userId,
        conversationId = dto.ConversationId,
        imageBase64 = dto.ImageBase64,
        imageMimeType = dto.ImageMimeType
    };
    
    // Forward to n8n webhook (which calls Dify internally)
    using var client = _httpClientFactory.CreateClient("n8n");
    var response = await client.PostAsJsonAsync(
        _config["N8n:ChatbotWebhookUrl"], 
        n8nPayload);
    
    var result = await response.Content.ReadFromJsonAsync<N8nChatResponse>();
    
    return Ok(new
    {
        answer = result!.Answer,
        conversationId = result.ConversationId,
        sources = result.Sources
    });
}
```

#### K.9.4 Environment Variables to Add

In `appsettings.json` / `appsettings.Development.json`:

```json
{
  "N8n": {
    "ChatbotWebhookUrl": "https://n8n.yourdomain.com/webhook/chatbot-message",
    "WebhookSecret": "your-webhook-secret-for-verification"
  },
  "Dify": {
    "BaseUrl": "https://api.dify.ai/v1",
    "DatasetApiKey": "",
    "ChatflowApiKey": "",
    "DatasetId": ""
  }
}
```

---

### K.10 Troubleshooting Dify + n8n Integration

| Problem | Cause | Solution |
|---------|-------|----------|
| `401 Unauthorized` from Dify | Wrong API key or wrong key type (dataset vs chatflow) | Double-check which key is used for which endpoint |
| `404 Not Found` | Wrong dataset UUID or endpoint path | Verify `dataset_id` in Dify Dashboard; check URL format |
| Empty `records` array | Query doesn't match any chunks, or score_threshold too high | Lower `score_threshold` to 0.3–0.4; check dataset has indexed documents |
| `score_threshold_enabled: true` but all filtered | Threshold too aggressive | Set `score_threshold: 0.3` or disable with `score_threshold_enabled: false` for debugging |
| Slow responses (>10s) | Reranking with large `top_k` | Reduce `top_k` to 5–6; reranker processes `top_k` pairs synchronously |
| Vietnamese text not matching | Keyword search not configured, only semantic | Use `hybrid_search`; verify dataset is indexed with HIGH_QUALITY mode |
| `conversation_id` not working | Sending `null` instead of omitting or empty string | Send `""` (empty string) for new conversations; send saved UUID for follow-ups |
| Dify chatflow returns wrong language | Wrong system prompt language or user message language mismatch | Add explicit instruction: "Always respond in the same language as the user's question" |
| n8n workflow times out | Dify response slow / stuck | Set HTTP Request timeout to 60000ms; check Dify status |

---

### K.11 Complete n8n Workflow JSON Template

The following is a minimal n8n workflow JSON skeleton for the Dify Knowledge Retrieval + Chatflow integration. Import via n8n Editor → **Import** → paste JSON.

```json
{
  "name": "ReliefConnect Chatbot via Dify",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300],
      "parameters": {
        "httpMethod": "POST",
        "path": "chatbot-message",
        "responseMode": "responseNode",
        "options": {
          "allowedOrigins": "https://your-reliefconnect-domain.com"
        }
      }
    },
    {
      "name": "Dify Knowledge Retrieve",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, 300],
      "parameters": {
        "method": "POST",
        "url": "=https://api.dify.ai/v1/datasets/{{ $env.DIFY_DATASET_ID }}/retrieve",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "contentType": "json",
        "body": "={\n  \"query\": \"{{ $json.body.message }}\",\n  \"retrieval_model\": {\n    \"search_method\": \"hybrid_search\",\n    \"reranking_enable\": true,\n    \"reranking_mode\": \"reranking_model\",\n    \"reranking_model\": {\n      \"reranking_provider_name\": \"cohere\",\n      \"reranking_model_name\": \"rerank-multilingual-v3.0\"\n    },\n    \"top_k\": 6,\n    \"score_threshold_enabled\": true,\n    \"score_threshold\": 0.4\n  }\n}",
        "options": { "timeout": 30000 }
      }
    },
    {
      "name": "Dify Chat Messages",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [680, 300],
      "parameters": {
        "method": "POST",
        "url": "https://api.dify.ai/v1/chat-messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "contentType": "json",
        "body": "={\n  \"inputs\": {},\n  \"query\": \"{{ $('Webhook').item.json.body.message }}\",\n  \"response_mode\": \"blocking\",\n  \"conversation_id\": \"{{ $('Webhook').item.json.body.conversationId || '' }}\",\n  \"user\": \"{{ $('Webhook').item.json.body.userId || 'anonymous' }}\"\n}",
        "options": { "timeout": 60000 }
      }
    },
    {
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [900, 300],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"answer\": \"{{ $json.answer }}\",\n  \"conversationId\": \"{{ $json.conversation_id }}\",\n  \"sources\": {{ JSON.stringify($json.metadata?.retriever_resources || []) }}\n}"
      }
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Dify Knowledge Retrieve", "type": "main", "index": 0 }]] },
    "Dify Knowledge Retrieve": { "main": [[{ "node": "Dify Chat Messages", "type": "main", "index": 0 }]] },
    "Dify Chat Messages": { "main": [[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]] }
  }
}
```

> **Note:** This template uses Pattern 1 (Dify handles retrieval internally). For Pattern 2/3 with manual retrieval routing, expand the workflow between `Dify Knowledge Retrieve` and `Dify Chat Messages` with IF nodes and separate LLM chains.
