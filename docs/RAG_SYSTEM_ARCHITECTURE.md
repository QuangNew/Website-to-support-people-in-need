# RAG System Architecture — ReliefConnect Chatbot

> Full specification for the Retrieval-Augmented Generation (RAG) pipeline powered by Dify Knowledge Base with hybrid search, intelligent query routing, and dual-tier AI model selection.
>
> Version 1.0 · April 8, 2026

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Full Pipeline Architecture](#2-full-pipeline-architecture)
3. [Component Deep-Dive: Hybrid Search (60/40)](#3-component-deep-dive-hybrid-search-6040)
4. [Component Deep-Dive: Dify Knowledge Base](#4-component-deep-dive-dify-knowledge-base)
5. [Component Deep-Dive: Query Complexity Routing](#5-component-deep-dive-query-complexity-routing)
6. [Component Deep-Dive: Dual-Tier AI Models](#6-component-deep-dive-dual-tier-ai-models)
7. [n8n Workflow Design (Step-by-Step)](#7-n8n-workflow-design-step-by-step)
8. [Dify Knowledge Base Setup](#8-dify-knowledge-base-setup)
9. [Backend Integration (ASP.NET Core)](#9-backend-integration-aspnet-core)
10. [Data Flow Reference](#10-data-flow-reference)
11. [API Contract Reference](#11-api-contract-reference)
12. [Performance Tuning](#12-performance-tuning)
13. [Operational Runbook](#13-operational-runbook)

---

## 1. Overview & Goals

### What Problem Does This Solve?

The current chatbot sends every user message directly to a general-purpose LLM. This has three core problems:

| Problem | Impact |
|---------|--------|
| LLM has no platform-specific knowledge | Hallucinations about ReliefConnect procedures |
| Every query uses the expensive Pro model | High cost for simple greetings/FAQ |
| No source citations | Users can't verify AI answers |

### Solution: RAG + Intelligent Routing

```
User Query
    │
    ▼ [Step 1]
Hybrid Search on Dify Knowledge Base
  (60% semantic embedding + 40% keyword/BM25)
    │
    ▼ [Step 2]
Retrieve top-K relevant document chunks
    │
    ▼ [Step 3]
Classify query complexity
    │
    ├── Simple → Normal AI (Gemini Flash) + retrieved context
    └── Complex/Critical → Powerful AI (Gemini Pro / GPT-4o) + retrieved context
    │
    ▼ [Step 4]
Return grounded, cited response to user
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Grounded answers** | Every response is augmented with knowledge base content |
| **Cost efficiency** | Route 80% of typical queries (simple FAQ) to cheap fast model |
| **Accuracy** | Complex policy/medical queries use full reasoning model |
| **Transparency** | Citations returned alongside answers |
| **Multilingual** | Vietnamese-first with English fallback |
| **Resilient** | n8n unavailable → direct Gemini fallback (no RAG) |

---

## 2. Full Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             REQUEST PIPELINE                                    │
│                                                                                 │
│  [1] Frontend (ChatbotPage.tsx)                                                 │
│       │  POST /api/chatbot/conversations/{id}/messages                          │
│       │  Body: { content, imageBase64?, imageMimeType? }                        │
│       ▼                                                                         │
│  [2] ASP.NET Core: ChatbotController                                            │
│       │  Validate input, save user message, fetch history                      │
│       │  Call IChatbotProvider.SendMessageAsync()                               │
│       ▼                                                                         │
│  [3] DualChatbotProvider                                                        │
│       │  n8n available? → N8nChatbotProvider                                   │
│       │  n8n down?      → GeminiChatbotProvider (fallback, no RAG)             │
│       ▼                                                                         │
│  [4] n8n Webhook (POST /webhook/chatbot)                                        │
│       │  Receives: { message, history[], userId, imageBase64? }                │
│       ▼                                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                     n8n WORKFLOW                                        │    │
│  │                                                                         │    │
│  │  [4a] Prepare Input                                                     │    │
│  │        │  Set node: extract message, history, image fields             │    │
│  │        ▼                                                                │    │
│  │  [4b] Hybrid Search → Dify Knowledge Base API                          │    │
│  │        │  POST /v1/datasets/{id}/retrieve                              │    │
│  │        │  search_method: "hybrid_search"                               │    │
│  │        │  weights: { vector_weight: 0.6, keyword_weight: 0.4 }        │    │
│  │        │  reranking: Cohere rerank-multilingual-v3.0                   │    │
│  │        │  top_k: 6  score_threshold: 0.35                              │    │
│  │        ▼                                                                │    │
│  │  [4c] Format Retrieved Context                                          │    │
│  │        │  Code node: merge chunks into prompt context                  │    │
│  │        ▼                                                                │    │
│  │  [4d] Classify Query Complexity                                         │    │
│  │        │  IF node OR Text Classifier LLM node                          │    │
│  │        │                                                                │    │
│  │        ├── SIMPLE ──────────────────────────────────────────────────┐  │    │
│  │        │   (len < 80, FAQ-like, direct questions)                    │  │    │
│  │        │   AI: Gemini 2.0 Flash                                      │  │    │
│  │        │   Context: top 3 chunks                                      │  │    │
│  │        │                                                              │  │    │
│  │        └── COMPLEX / CRITICAL ──────────────────────────────────────┐│  │    │
│  │            (len ≥ 80, policy/legal/medical/multi-step)              ││  │    │
│  │            AI: Gemini 2.5 Pro or GPT-4o                             ││  │    │
│  │            Context: top 6 chunks + conversation history             ││  │    │
│  │                                                      │              ││  │    │
│  │  [4e] Generate Response ◀────────────────────────────┘──────────────┘│  │    │
│  │        │                                                              │  │    │
│  │        ▼                                                             ─┘  │    │
│  │  [4f] Build Response Object                                              │    │
│  │        │  { response, hasSafetyWarning, sources[], provider }           │    │
│  │        ▼                                                                │    │
│  │  [4g] Respond to Webhook                                                │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│       │                                                                         │
│       ▼                                                                         │
│  [5] ASP.NET Core: Save bot message → Return MessageResponseDto                │
│       │                                                                         │
│       ▼                                                                         │
│  [6] Frontend: Display response + source citations                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Deep-Dive: Hybrid Search (60/40)

### What "60% Embedding + 40% Rerank" Means

The 60/40 split describes the **weighted scoring formula** used to combine two independent relevance signals into a single ranked list:

```
final_score = 0.6 × vector_similarity_score + 0.4 × keyword_bm25_score
```

| Component | Weight | Signal Type | Strength |
|-----------|--------|------------|----------|
| **Vector Embedding (Semantic)** | 60% | Dense vector cosine similarity — captures meaning and synonyms | Finds `"hỗ trợ"` when user asks `"viện trợ"` |
| **Keyword/BM25 (Lexical)** | 40% | Term frequency-inverse document frequency — exact token matching | Finds `"Trung tâm cứu trợ Quận 1"` precisely |

### Why 60/40 Specifically?

The 60% semantic / 40% keyword ratio is well-suited for Vietnamese humanitarian content because:

- **Vietnamese synonyms are rich**: Multiple words for "help", "aid", "emergency" — semantic search is critical
- **Proper nouns are exact**: Organization names, zone IDs, phone numbers — keyword search is critical  
- **Slight semantic dominance**: Meaning is generally more important than exact wording in emergency guidance

### Fusion + Reranking (Two-Stage)

The 60/40 hybrid produces an initial ranked list. A **cross-encoder reranker** then re-scores the top-K results:

```
Stage 1: Weighted Hybrid Search
  Candidate pool: 50–100 chunks (from dense + BM25 indexes)
  Fusion: score = 0.6×vector + 0.4×BM25
  Output: sorted list, keep top K×2 candidates

Stage 2: Cross-Encoder Reranking (Cohere rerank-multilingual-v3.0)
  Input: (query, candidate_chunk) pairs
  Model: independently scores each pair with full attention
  Output: final top-K ordered by true relevance
  
Final output: top_k=6 most relevant chunks
```

**Why two stages?** The cross-encoder is slow (O(n) inference per candidate) — running it on all possible chunks is expensive. The hybrid search first narrows candidates to a manageable set, then reranking provides maximum accuracy on that set.

### Dify API Configuration for 60/40

```json
{
  "query": "user message here",
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

> **Note**: When `reranking_mode` is `"weighted_score"`, the `weights` object controls the 60/40 fusion. When `reranking_mode` is `"reranking_model"`, a cross-encoder model is used instead. Setting both `weighted_score` weights AND enabling a reranking model achieves the full two-stage pipeline.

### Score Threshold Guidance

| Threshold | Effect on Vietnamese Content |
|-----------|----------------------------|
| `0.20` | Very permissive — many weakly related chunks included |
| `0.35` | **Recommended** — good balance for humanitarian Q&A |
| `0.50` | Strict — may miss relevant chunks with paraphrase queries |
| `0.70` | Very strict — only near-exact matches pass |

---

## 4. Component Deep-Dive: Dify Knowledge Base

### What is Dify?

**Dify** is an open-source LLM application development platform. Its **Knowledge** feature provides a managed vector database with:
- Document upload, chunking, and embedding
- Hybrid search (semantic + keyword) with optional reranking
- API access to query the knowledge base from external systems
- Built-in workflow builder with Knowledge Retrieval nodes

### Knowledge Base → ReliefConnect Mapping

| Dify Feature | ReliefConnect Use |
|-------------|-----------------|
| **Dataset** (Knowledge) | Humanitarian aid documents, SOS procedures, platform guides |
| **Retrieval API** | Called by n8n to get context for each user query |
| **Chatflow** | Alternative: let Dify manage the entire conversation |
| **Workflow** | Complex multi-step AI pipelines |
| **Question Classifier** | Route queries by intent category |

### Recommended Documents for Knowledge Base

| Document | Purpose | Update Frequency |
|----------|---------|----------------|
| Platform usage guide | Answer "how to use X" questions | With feature releases |
| SOS procedures | What to do, who to call, emergency steps | When procedures change |
| Relief aid eligibility | Who qualifies for what programs | Monthly |
| Contact directory | Emergency numbers, zone offices, hotlines | Quarterly |
| FAQ compilation | Common user questions | Continuously |
| Volunteer handbook | Task acceptance, safety protocols | With policy changes |
| Legal/policy documents | Vietnamese disaster relief law, regulations | When laws change |

### Document Indexing Settings

```
Indexing Technique: HIGH_QUALITY
  → Uses embedding model to create semantic vectors
  → Required for semantic/hybrid search
  (vs. ECONOMY = BM25 keyword only)

Chunking:
  Method: Automatic (paragraph-based)
  Max Tokens Per Chunk: 1024
  Chunk Overlap: 100 tokens
  Separator: "\n\n" (paragraph breaks)
  
Embedding Model: 
  Primary: text-embedding-3-large (OpenAI) — high quality vectors
  Alternative: jina-embeddings-v3 — multilingual, self-hostable
```

### Knowledge Base API Endpoints

**Base URL**: `https://api.dify.ai/v1` (cloud) or `http://your-dify-instance/v1` (self-hosted)

**Authentication**: `Authorization: Bearer {dataset-api-key}` (NOT the chatflow API key — they are different!)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/datasets/{id}/retrieve` | POST | Query knowledge base (our main RAG call) |
| `/datasets/{id}/documents` | GET | List documents in dataset |
| `/datasets/{id}/documents` | POST | Upload new document |
| `/datasets` | GET | List all datasets |

---

## 5. Component Deep-Dive: Query Complexity Routing

### Routing Decision Matrix

| Query Characteristic | Score | AI Tier |
|---------------------|-------|---------|
| Length < 60 characters | +0 | — |
| Length 60–120 characters | +1 | — |
| Length > 120 characters | +2 | → Complex |
| Single question word (what, where, when, khi nào, ở đâu) | +0 | — |
| Multi-clause sentence | +1 | — |
| Conditional ("if X, then Y") | +2 | → Complex |
| Keyword: chính sách, quy định, thủ tục, policy, regulation | +2 | → Complex |
| Keyword: y tế, bệnh, medical, health condition | +1 | — |
| Keyword: khẩn cấp, cấp cứu, emergency | +3 | → Complex |
| Image attached | +2 | → Complex |
| Total score ≥ 3 | — | **Complex → Powerful AI** |
| Total score < 3 | — | **Simple → Normal AI** |

### n8n IF Node Implementation

The simplest implementation uses keyword and length checks in an IF node:

```
IF Node: "Is Complex?"
Condition 1 (OR):
  - message.length > 100                           → +weight for length
Condition 2 (OR):
  - message contains "chính sách" OR "policy"      → policy question  
  - message contains "quy định" OR "regulation"    → legal question
  - message contains "thủ tục" OR "procedure"      → procedural question
  - message contains "cấp cứu" OR "emergency"      → crisis question
  - imageBase64 is not empty                        → multimodal = complex
```

### LLM-Based Classification (Advanced)

For more nuanced routing, use a small AI call before the main generate step:

```
Classify prompt:
"Classify this user query as one of: [simple, complex].
Simple: direct factual question, short, single topic.
Complex: requires reasoning, policy interpretation, multi-step answer, medical/legal, or contains an image.
Query: {user_message}
Answer with only the word 'simple' or 'complex'."
```

Use Gemini Flash (cheapest model) for the classification call — adds ~$0.00001 per request.

---

## 6. Component Deep-Dive: Dual-Tier AI Models

### Model Tiers

| Tier | Models | When Used | Relative Cost |
|------|--------|-----------|--------------|
| **Normal (Tier 1)** | Gemini 2.0 Flash | Simple FAQ, greetings, short factual Q | 1× |
| **Powerful (Tier 2)** | Gemini 2.5 Pro | Complex policy, medical, multi-step | ~20× |
| **Powerful (Tier 2 alt)** | GPT-4o | Alternative powerful model | ~15× |
| **Powerful (Tier 2 alt)** | Claude 3.5 Sonnet | Long document analysis | ~12× |

### Expected Traffic Distribution

Based on typical humanitarian chatbot usage patterns:

| Query Type | % of Traffic | AI Tier |
|-----------|-------------|---------|
| Simple FAQ (how to register, what is X) | 45% | Normal |
| Platform navigation help | 25% | Normal |
| Complex policy/eligibility questions | 15% | Powerful |
| Medical/emergency guidance | 10% | Powerful |
| Multi-step procedures | 5% | Powerful |

**Net cost**: ~70% of queries use cheap model → ~3-4× lower average cost vs. always-Pro routing.

### Model Configuration in Dify vs. n8n

**Option A — Dify manages models**: Create two separate Dify Chatflow apps:
- `chatflow-simple` configured with `gemini-2.0-flash`  
- `chatflow-complex` configured with `gemini-2.5-pro`

n8n routes via IF node to call the appropriate Dify chatflow URL.

**Option B — n8n manages models**: n8n uses LangChain AI Agent/Chain nodes with two different Chat Model sub-nodes. Dify is only used for knowledge retrieval; n8n handles both AI calls.

**Recommended**: Option A for simpler workflow maintenance. Option B for more control and lower latency.

---

## 7. n8n Workflow Design (Step-by-Step)

### Complete Workflow: Full RAG + Routing

#### Node 1: Webhook Trigger

```
Type: Webhook
HTTP Method: POST
Path: chatbot
Authentication: Header Auth
  Header Name: X-ReliefConnect-Auth
  Header Value: {64-char shared secret}
Response Mode: Respond Using Response Node
```

**Expected input payload:**
```json
{
  "message": "Tôi cần nộp hồ sơ xin viện trợ thì thủ tục như thế nào?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "model", "content": "..." }
  ],
  "userId": "user-uuid-here",
  "conversationId": "optional-uuid-or-empty",
  "imageBase64": null,
  "imageMimeType": null
}
```

---

#### Node 2: Set — Prepare Input Fields

```
Type: Set
Name: Prepare Input
Fields:
  userMessage     = {{ $json.body.message }}
  userId          = {{ $json.body.userId || 'anonymous' }}
  conversationId  = {{ $json.body.conversationId || '' }}
  hasImage        = {{ !!$json.body.imageBase64 }}
  imageBase64     = {{ $json.body.imageBase64 || '' }}
  imageMimeType   = {{ $json.body.imageMimeType || '' }}
```

---

#### Node 3: HTTP Request — Dify Knowledge Base Retrieve

```
Type: HTTP Request
Name: Dify Hybrid Search
Method: POST
URL: https://api.dify.ai/v1/datasets/{{ $env.DIFY_DATASET_ID }}/retrieve
Auth: Header Auth → Authorization: Bearer {DIFY_DATASET_API_KEY}
Content-Type: application/json
Body:
{
  "query": "{{ $('Prepare Input').item.json.userMessage }}",
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
Timeout: 30000ms
```

---

#### Node 4: Code — Format Retrieved Context

```javascript
// Type: Code (JavaScript)
// Name: Format Context

const records = $input.item.json.records || [];
const query = $('Prepare Input').item.json.userMessage;

// Build formatted context string
const contextChunks = records
  .slice(0, 6)
  .map((r, i) => {
    const docName = r.segment?.document?.name || 'Unknown';
    const score = (r.score || 0).toFixed(3);
    return `--- Source ${i+1}: ${docName} (relevance: ${score}) ---\n${r.segment.content}`;
  });

const context = contextChunks.length > 0
  ? contextChunks.join('\n\n')
  : '';

// Source citations for response
const sources = records.map(r => ({
  documentName: r.segment?.document?.name || 'Unknown',
  score: r.score || 0,
  excerpt: (r.segment?.content || '').substring(0, 200) + '...'
}));

// Check emergency keywords
const emergencyKeywords = [
  'đau tim', 'ngộ độc', 'chảy máu', 'ngừng thở', 'tai nạn', 'cấp cứu',
  'heart attack', 'poisoning', 'bleeding', 'emergency', 'accident'
];
const hasEmergency = emergencyKeywords.some(kw =>
  query.toLowerCase().includes(kw)
);

return [{
  json: {
    context,
    sources,
    hasEmergency,
    hasKnowledgeBase: contextChunks.length > 0,
    chunkCount: records.length,
    userMessage: query
  }
}];
```

---

#### Node 5: IF — Route by Complexity

```
Type: IF
Name: Route by Complexity
Conditions (ANY must be true for "Complex" path):
  - {{ $('Prepare Input').item.json.userMessage.length }} > 100
  - {{ $('Prepare Input').item.json.hasImage }} === true
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('chính sách') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('quy định') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('thủ tục') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('policy') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('regulation') }}
  - {{ $('Format Context').item.json.hasEmergency }} === true

True branch  → "Complex" (connects to Node 6A)
False branch → "Simple"  (connects to Node 6B)
```

---

#### Node 6A: HTTP Request — Complex Query (Dify Powerful Chatflow)

```
Type: HTTP Request
Name: Dify Complex Chatflow (Powerful AI)
Method: POST
URL: https://api.dify.ai/v1/chat-messages
Auth: Header Auth → Authorization: Bearer {DIFY_CHATFLOW_COMPLEX_API_KEY}
Body:
{
  "inputs": {
    "retrieved_context": "{{ $('Format Context').item.json.context }}"
  },
  "query": "{{ $('Prepare Input').item.json.userMessage }}",
  "response_mode": "blocking",
  "conversation_id": "{{ $('Prepare Input').item.json.conversationId }}",
  "user": "{{ $('Prepare Input').item.json.userId }}"
}
Timeout: 90000ms (complex queries take longer)
```

---

#### Node 6B: HTTP Request — Simple Query (Dify Normal Chatflow)

```
Type: HTTP Request
Name: Dify Simple Chatflow (Normal AI)
Method: POST
URL: https://api.dify.ai/v1/chat-messages
Auth: Header Auth → Authorization: Bearer {DIFY_CHATFLOW_SIMPLE_API_KEY}
Body:
{
  "inputs": {
    "retrieved_context": "{{ $('Format Context').item.json.context }}"
  },
  "query": "{{ $('Prepare Input').item.json.userMessage }}",
  "response_mode": "blocking",
  "conversation_id": "{{ $('Prepare Input').item.json.conversationId }}",
  "user": "{{ $('Prepare Input').item.json.userId }}"
}
Timeout: 30000ms
```

---

#### Node 7: Merge — Combine Both Paths

```
Type: Merge
Name: Merge Responses
Mode: Append (merge outputs from both paths)
```

---

#### Node 8: Set — Build Final Response

```
Type: Set
Name: Build Final Response
Fields:
  response        = {{ $json.answer }}
  conversationId  = {{ $json.conversation_id }}
  hasSafetyWarning = {{ $('Format Context').item.json.hasEmergency }}
  sources         = {{ JSON.stringify($('Format Context').item.json.sources) }}
  provider        = "n8n+dify"
  tier            = {{ $json.model?.includes('flash') ? 'normal' : 'powerful' }}
```

---

#### Node 9: Respond to Webhook

```
Type: Respond to Webhook
Response Code: 200
Response Mode: JSON

Response Body:
{
  "response": "{{ $json.response }}",
  "hasSafetyWarning": {{ $json.hasSafetyWarning }},
  "conversationId": "{{ $json.conversationId }}",
  "sources": {{ $json.sources }},
  "provider": "{{ $json.provider }}"
}
```

---

## 8. Dify Knowledge Base Setup

### Step 1: Create a Dify Account

- **Cloud**: Register at [dify.ai](https://dify.ai)
- **Self-hosted**: Deploy with Docker (see Dify docs)

### Step 2: Create Knowledge Base

1. Dashboard → **Knowledge** → **Create Knowledge**
2. Name: `ReliefConnect Aid Knowledge Base`
3. Upload documents (PDF, DOCX, TXT, Markdown)
4. Select indexing:
   - **Index Method**: High Quality (Embedding)
   - **Embedding Model**: `text-embedding-3-large` or `jina-embeddings-v3`

### Step 3: Configure Retrieval Settings

In the Knowledge Base settings:
- **Search Method**: Hybrid Search
- **Reranking Model**: Cohere — `rerank-multilingual-v3.0`
- **Top K**: 6
- **Score Threshold**: 0.35

### Step 4: Get API Keys

1. **Dataset API Key**: Dify → Knowledge Settings → API Key  
   (Used for `/datasets/{id}/retrieve` calls in n8n)
2. **Chatflow API Key**: Dify → Your App → API Access  
   (Used for `/v1/chat-messages` calls in n8n)

### Step 5: Create Two Chatflow Apps

**Simple Chatflow App** (for Tier 1 queries):
- Model: `gemini-2.0-flash` or `gpt-4o-mini`
- System prompt: Include `{retrieved_context}` variable
- Temperature: 0.5

**Complex Chatflow App** (for Tier 2 queries):
- Model: `gemini-2.5-pro` or `gpt-4o`
- Same system prompt structure with `{retrieved_context}` variable
- Temperature: 0.3 (lower = more precise for complex reasoning)

**System Prompt Template** (same for both, different models):
```
Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam.
Nhiệm vụ: giúp người dùng tìm kiếm thông tin cứu trợ và hướng dẫn sử dụng nền tảng.

Sử dụng thông tin sau từ cơ sở kiến thức để trả lời câu hỏi:
-----
{retrieved_context}
-----

Hướng dẫn:
- Trả lời dựa trên thông tin được cung cấp ở trên.
- Nếu thông tin không có trong cơ sở kiến thức, hãy nói rõ và đề xuất liên hệ hỗ trợ.
- Ưu tiên tiếng Việt; nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh.
- Không trả lời nội dung nhạy cảm, chính trị, vi phạm pháp luật.
- Trường hợp khẩn cấp: cung cấp số điện thoại 113 (Công an), 114 (Cứu hỏa), 115 (Cấp cứu).
```

---

## 9. Backend Integration (ASP.NET Core)

### Updated Request/Response Contract

The `N8nChatbotProvider` sends a richer payload and receives citations back:

**Request to n8n webhook:**
```json
{
  "message": "user message text",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "model", "content": "..." }
  ],
  "userId": "user-uuid",
  "conversationId": "dify-conversation-uuid-or-empty",
  "imageBase64": null,
  "imageMimeType": null
}
```

**Response from n8n webhook:**
```json
{
  "response": "AI-generated answer text",
  "hasSafetyWarning": false,
  "conversationId": "dify-conversation-uuid",
  "sources": [
    {
      "documentName": "relief_aid_policy.pdf",
      "score": 0.87,
      "excerpt": "First 200 chars of relevant chunk..."
    }
  ],
  "provider": "n8n+dify"
}
```

### Updated MessageResponseDto

```csharp
// In ReliefConnect.Core/DTOs/MessageResponseDto.cs
public class MessageResponseDto
{
    public int Id { get; set; }
    public string Content { get; set; } = "";
    public bool IsBotMessage { get; set; }
    public bool HasSafetyWarning { get; set; }
    public DateTime SentAt { get; set; }
    
    // NEW: RAG source citations
    public List<ChatSourceDto>? Sources { get; set; }
    
    // NEW: Which provider processed this
    public string? Provider { get; set; }
}

public class ChatSourceDto
{
    public string DocumentName { get; set; } = "";
    public double Score { get; set; }
    public string Excerpt { get; set; } = "";
}
```

### Conversation ID Persistence

Dify manages its own conversation IDs. The backend needs to persist these per ASP.NET conversation:

```csharp
// Option: Store Dify conversation_id in the Conversation entity
// After first message, save the returned conversation_id
// Pass it on subsequent messages for context continuity
```

---

## 10. Data Flow Reference

### Happy Path (n8n + Dify, both online)

```
1. User types: "Điều kiện để nhận xét nghiệm y tế trong chương trình cứu trợ là gì?"
2. Frontend → POST /api/chatbot/conversations/5/messages
3. ChatbotController saves user message, calls IChatbotProvider
4. DualChatbotProvider: n8n healthy → calls N8nChatbotProvider
5. N8nChatbotProvider: POST n8n webhook with message + history
6. n8n Node 3: POST Dify KB retrieve
   - query: "Điều kiện để nhận xét nghiệm y tế trong chương trình cứu trợ là gì?"
   - hybrid_search: 60% semantic + 40% BM25
   - Reranker: Cohere sorts top chunks
   - Returns: 6 chunks from "medical_aid_policy.pdf" with scores 0.85–0.71
7. n8n Node 4: Format context from 6 chunks
8. n8n Node 5: IF check
   - Length: 73 chars → normal
   - BUT contains "y tế" → +1, also "chương trình" → borderline
   - Decision: COMPLEX (medical + eligibility = high stakes)
9. n8n Node 6A: POST Dify Complex Chatflow (Gemini Pro)
   - Input includes retrieved_context with 6 chunks
   - Gemini 2.5 Pro generates detailed, accurate response
10. n8n Node 9: Respond with answer + hasSafetyWarning + sources
11. ChatbotController saves bot message, returns to frontend
12. Frontend displays answer with source citations panel
```

### Fallback Path (n8n down, Gemini direct)

```
1. User types any message
2. DualChatbotProvider: n8n health check FAILS (cached)
3. Falls back to GeminiChatbotProvider
4. GeminiService: calls Gemini 2.5 Flash directly (no RAG)
5. Response returned — no source citations, no routing
6. User gets answer (less grounded, but available)
```

---

## 11. API Contract Reference

### n8n Webhook

```
POST {N8N_BASE_URL}/webhook/chatbot
Content-Type: application/json
X-ReliefConnect-Auth: {shared-secret}

Request:
{
  "message": string,           // Required
  "history": [{                // Required (empty array if new)
    "role": "user" | "model",
    "content": string
  }],
  "userId": string,            // Required for Dify memory scoping
  "conversationId": string,    // Optional: "" for new, UUID for continuation
  "imageBase64": string | null,
  "imageMimeType": string | null
}

Response 200:
{
  "response": string,
  "hasSafetyWarning": boolean,
  "conversationId": string,    // Save this for next message
  "sources": [{
    "documentName": string,
    "score": number,
    "excerpt": string
  }],
  "provider": string           // "n8n+dify" | "n8n+gemini"
}
```

### Dify Knowledge Base Retrieve

```
POST https://api.dify.ai/v1/datasets/{dataset_id}/retrieve
Authorization: Bearer {DIFY_DATASET_API_KEY}
Content-Type: application/json

Request:
{
  "query": string,
  "retrieval_model": {
    "search_method": "hybrid_search",
    "reranking_enable": true,
    "reranking_mode": "weighted_score",
    "weights": { "vector_weight": 0.6, "keyword_weight": 0.4 },
    "reranking_model": {
      "reranking_provider_name": "cohere",
      "reranking_model_name": "rerank-multilingual-v3.0"
    },
    "top_k": 6,
    "score_threshold_enabled": true,
    "score_threshold": 0.35
  }
}

Response 200:
{
  "query": { "content": string },
  "records": [{
    "segment": {
      "content": string,            // The retrieved text chunk
      "document": { "name": string },
      "word_count": number
    },
    "score": number                 // Relevance score 0.0–1.0
  }]
}
```

### Dify Chatflow Chat Messages

```
POST https://api.dify.ai/v1/chat-messages
Authorization: Bearer {DIFY_CHATFLOW_API_KEY}
Content-Type: application/json

Request:
{
  "inputs": { "retrieved_context": string },
  "query": string,
  "response_mode": "blocking",
  "conversation_id": string,  // "" for new conversation
  "user": string
}

Response 200:
{
  "answer": string,
  "conversation_id": string,
  "message_id": string,
  "metadata": {
    "usage": { "total_tokens": number },
    "retriever_resources": [...]
  }
}
```

---

## 12. Performance Tuning

| Metric | Target | Tuning Lever |
|--------|--------|-------------|
| Total response time | < 8s (simple), < 20s (complex) | Reduce top_k; use faster models |
| Knowledge retrieval | < 2s | Lower top_k; check Dify server load |
| Reranking | < 1.5s | Cohere is fast; reduce candidates |
| Simple AI generation | < 3s | Gemini Flash is ~2-3s |
| Complex AI generation | < 15s | Gemini Pro/GPT-4o typical range |
| Context quality | > 0.5 average score | Tune score_threshold up |
| Routing accuracy | > 90% correct tier | Tune IF conditions; add LLM classifier |

### Optimize for Vietnamese Content

```
1. Use jina-embeddings-v3 for embedding (multilingual specialist)
2. Cohere rerank-multilingual-v3.0 (100+ language cross-encoder)
3. Increase chunk overlap to 100 tokens (Vietnamese context spans)
4. Include Vietnamese synonyms in IF complexity checks
5. Score threshold 0.35 (lower than English defaults) due to Vietnamese embedding space
```

---

## 13. Operational Runbook

### Checking System Health

```powershell
# 1. Check n8n is running
Invoke-RestMethod "http://localhost:5678/healthz"

# 2. Test Dify Knowledge Retrieve directly
$headers = @{ "Authorization" = "Bearer YOUR_DATASET_KEY" }
$body = @{
  query = "test query"
  retrieval_model = @{
    search_method = "hybrid_search"
    top_k = 3
    score_threshold_enabled = $false
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod "https://api.dify.ai/v1/datasets/YOUR_DATASET_ID/retrieve" `
  -Method Post -Headers $headers -Body $body -ContentType "application/json"

# 3. Test full n8n chatbot pipeline
$n8nBody = @{
  message = "Làm sao để đăng ký nhận viện trợ?"
  history = @()
  userId = "test-user"
  conversationId = ""
} | ConvertTo-Json -Depth 3

Invoke-RestMethod "http://localhost:5678/webhook/chatbot" `
  -Method Post `
  -Headers @{ "X-ReliefConnect-Auth" = "YOUR_SECRET" } `
  -Body $n8nBody -ContentType "application/json"
```

### Updating the Knowledge Base

When new documents are available:
1. Dify Dashboard → Knowledge → Your Dataset
2. Click `+ Add File`
3. Upload PDF/DOCX/Markdown file
4. Wait for indexing (status: `indexing` → `completed`)
5. Test retrieval: Dify Dashboard → Knowledge → Your Dataset → Retrieval Testing
6. Enter test queries to verify new content is retrievable

### Adjusting Routing Thresholds

To change what gets routed to powerful AI:
1. Open n8n workflow → IF node (Route by Complexity)
2. Modify the length threshold (currently 100 characters)
3. Add/remove keyword conditions
4. Save and re-activate workflow

No deployment needed — changes are live immediately.

---

*This document should be read alongside [N8N_IMPLEMENTATION_PLAN.md](N8N_IMPLEMENTATION_PLAN.md) and [CHATBOT_DUAL_ARCHITECTURE.md](CHATBOT_DUAL_ARCHITECTURE.md).*
