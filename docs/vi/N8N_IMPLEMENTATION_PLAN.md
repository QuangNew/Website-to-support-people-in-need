# n8n Tích Hợp Workflow — Kế Hoạch Triển Khai

> *Bản dịch tiếng Việt — xem bản gốc tiếng Anh tại [N8N_IMPLEMENTATION_PLAN.md](../N8N_IMPLEMENTATION_PLAN.md)*

> Hướng dẫn từng bước cho các nhà phát triển **chưa có kinh nghiệm n8n** để tích hợp n8n workflow làm nhà cung cấp AI chatbot chính trong ReliefConnect.
>
> Phiên bản 1.0 · Ngày 08/04/2026

---

## Mục Lục

1. [n8n Là Gì?](#1-n8n-là-gì)
2. [Tại Sao Dùng n8n Cho ReliefConnect?](#2-tại-sao-dùng-n8n-cho-reliefconnect)
3. [Tổng Quan Kiến Trúc](#3-tổng-quan-kiến-trúc)
4. [Yêu Cầu Tiên Quyết](#4-yêu-cầu-tiên-quyết)
5. [Giai Đoạn 1: Cài Đặt n8n (Môi Trường Phát Triển)](#5-giai-đoạn-1-cài-đặt-n8n-môi-trường-phát-triển)
6. [Giai Đoạn 2: Xây Dựng Workflow Chatbot Cơ Bản](#6-giai-đoạn-2-xây-dựng-workflow-chatbot-cơ-bản)
7. [Giai Đoạn 2B: Cấu Hình Dify Knowledge Base (RAG)](#7-giai-đoạn-2b-cấu-hình-dify-knowledge-base-rag)
8. [Giai Đoạn 3: Tích Hợp Backend](#8-giai-đoạn-3-tích-hợp-backend)
9. [Giai Đoạn 3B: Thêm RAG + Phân Luồng Theo Độ Phức Tạp](#9-giai-đoạn-3b-thêm-rag--phân-luồng-theo-độ-phức-tạp)
10. [Giai Đoạn 4: Chuyển Dự Phòng Nhà Cung Cấp Kép](#10-giai-đoạn-4-chuyển-dự-phòng-nhà-cung-cấp-kép)
11. [Giai Đoạn 5: Triển Khai Môi Trường Production](#11-giai-đoạn-5-triển-khai-môi-trường-production)
12. [Giai Đoạn 6: Workflow Nâng Cao](#12-giai-đoạn-6-workflow-nâng-cao)
13. [Chiến Lược Kiểm Thử](#13-chiến-lược-kiểm-thử)
14. [Xử Lý Sự Cố](#14-xử-lý-sự-cố)
15. [Bảng Thuật Ngữ](#15-bảng-thuật-ngữ)

---

## 1. n8n Là Gì?

**n8n** (đọc là "n-tám-n") là nền tảng tự động hóa workflow mã nguồn mở với trình chỉnh sửa trực quan dạng node. Hãy tưởng tượng đây là một công cụ xây dựng pipeline có thể lập trình, nơi bạn kết nối các **node** (hành động) với các **kết nối** (luồng dữ liệu) để tạo ra **workflow** tự động.

### Các Khái Niệm Chính

| Khái Niệm | Là Gì | So Sánh |
|-----------|-------|---------|
| **Node** | Một hành động đơn lẻ (ví dụ: "Gọi Gemini API", "Gửi HTTP Request") | Một hàm trong code |
| **Kết Nối** | Đường truyền dữ liệu giữa hai node | Lời gọi hàm truyền giá trị trả về |
| **Workflow** | Chuỗi node hoàn chỉnh | Một chương trình / pipeline |
| **Trigger** | Sự kiện bắt đầu workflow (ví dụ: nhận webhook) | HTTP endpoint / event handler |
| **Execution** | Một lần chạy workflow với dữ liệu đầu vào cụ thể | Một chu kỳ request/response |
| **Credential** | Bí mật xác thực đã lưu (API key, OAuth token) | Biến môi trường / secret |

### Giao Diện Trực Quan

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌───────────────────┐
│   Webhook    │────▶│   Xử Lý      │────▶│  Google Gemini  │────▶│  Phản Hồi         │
│   (trigger)  │     │   Đầu Vào    │     │  (mô hình AI)   │     │  Webhook          │
└─────────────┘     └──────────────┘     └─────────────────┘     └───────────────────┘
```

Bạn xây dựng luồng này bằng cách kéo thả node lên canvas, cấu hình từng node và vẽ kết nối giữa chúng.

### n8n So Với Viết Code Trực Tiếp

| Khía Cạnh | Code Trực Tiếp | n8n Workflow |
|-----------|--------------|-------------|
| Đổi mô hình AI | Thay code + deploy | Nhấp → chọn mô hình mới |
| Thêm RAG/memory | Viết code tích hợp | Kéo thả Memory node |
| Xử lý lỗi | Khối try/catch | Tích hợp retry + error workflow |
| Giám sát | Ghi log tùy chỉnh | Dashboard với lịch sử execution |
| Thay đổi không cần developer | Không thể | Trình chỉnh sửa trực quan cho mọi người |
| Chuỗi AI nhiều bước | Code orchestration phức tạp | Kết nối node trực quan |

---

## 2. Tại Sao Dùng n8n Cho ReliefConnect?

### Kiến Trúc Hiện Tại (Gemini API Trực Tiếp)

```
Frontend ──▶ ASP.NET API ──▶ GeminiService ──▶ Google Gemini API
                                                    ↓
Frontend ◀── ASP.NET API ◀── Phản Hồi ◀────────────┘
```

**Hạn Chế**:
- Thay đổi mô hình AI yêu cầu thay code và deploy lại
- Không có tính năng debug trực quan các cuộc trò chuyện AI
- Thêm tính năng (RAG, memory, chuỗi nhiều bước) đòi hỏi nhiều code
- Người không phải developer không thể điều chỉnh hành vi chatbot

### Kiến Trúc Mục Tiêu (n8n + Dự Phòng)

```
                              ┌──────────────────────┐
                              │      n8n Server       │
                              │  ┌─────────────────┐  │
Frontend ──▶ ASP.NET API ─────┤  │  AI Chatbot     │  │
                         │    │  │  Workflow        │  │
                         │    │  └─────────────────┘  │
                         │    └──────────────────────┘
                         │              │
                         │    (khi n8n ngừng hoạt động)
                         │              │
                         └──▶ GeminiService (dự phòng)
```

**Lợi Ích**:
- Đổi mô hình AI (Gemini → GPT → Claude) không cần thay code
- Debug luồng hội thoại trực quan trong dashboard n8n
- Thêm RAG, memory buffer và chuỗi nhiều bước trực quan
- Quản trị viên/nhóm sản phẩm có thể điều chỉnh hành vi chatbot không cần developer
- Ghi log execution và cơ chế retry tích hợp sẵn

---

## 3. Tổng Quan Kiến Trúc

### Thiết Kế Nhà Cung Cấp Kép

```
┌─────────────────────────────────────────────────────────────┐
│                    ASP.NET Core API                          │
│                                                             │
│  ChatbotController                                          │
│       │                                                     │
│       ▼                                                     │
│  IChatbotProvider (interface mới)                           │
│       │                                                     │
│       ├──▶ N8nChatbotProvider (chính)                       │
│       │       ├── Health check: GET {n8n}/healthz           │
│       │       └── Chat:   POST {n8n}/webhook/chatbot        │
│       │                                                     │
│       └──▶ GeminiChatbotProvider (dự phòng)                 │
│               └── GeminiService hiện có (không thay đổi)   │
│                                                             │
│  DualChatbotProvider (bộ điều phối)                         │
│       - Kiểm tra health n8n (cache 30 giây)                 │
│       - Chọn n8n nếu healthy                               │
│       - Chuyển sang Gemini khi n8n lỗi                     │
│       - Ghi log lựa chọn nhà cung cấp                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Yêu Cầu Tiên Quyết

### Yêu Cầu Phần Mềm

| Phần Mềm | Phiên Bản | Mục Đích |
|----------|----------|---------|
| Docker Desktop | Mới nhất | Chạy n8n trong container |
| Node.js | 18+ | n8n CLI (thay thế Docker) |
| .NET SDK | 10.0 | Backend ASP.NET Core |
| pnpm | 10.x | Quản lý package frontend |

### Tài Khoản & Khóa

| Tài Khoản | Mục Đích | Cách Lấy |
|----------|---------|---------|
| Google Gemini API Key | Phản hồi AI chatbot | [Google AI Studio](https://aistudio.google.com/apikey) |
| Tài khoản n8n (tùy chọn) | Hosting trên cloud | [n8n.io](https://n8n.io) (gói miễn phí) |

---

## 5. Giai Đoạn 1: Cài Đặt n8n (Môi Trường Phát Triển)

**Độ phức tạp**: Thấp · **Tệp thay đổi**: 0 (chỉ cơ sở hạ tầng)

### Phương Án A: Docker (Khuyến Nghị)

#### Bước 1: Tạo `docker-compose.n8n.yml`

Tạo tệp này trong thư mục gốc dự án:

```yaml
# docker-compose.n8n.yml
# Server n8n tự động hóa workflow cho chatbot ReliefConnect
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: reliefconnect-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=reliefconnect2026
      - EXECUTIONS_DATA_SAVE_ON_ERROR=all
      - EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
      - EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true
      - GENERIC_TIMEZONE=Asia/Ho_Chi_Minh
      - TZ=Asia/Ho_Chi_Minh
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
    driver: local
```

#### Bước 2: Khởi Động n8n

```powershell
# Khởi động n8n
docker compose -f docker-compose.n8n.yml up -d

# Xác minh đang chạy
docker ps | Select-String "n8n"

# Xem log
docker logs reliefconnect-n8n --tail 50
```

#### Bước 3: Truy Cập n8n

Mở `http://localhost:5678` trong trình duyệt.
- **Lần đầu**: Tạo tài khoản chủ sở hữu (email + mật khẩu)
- **Các lần sau**: Đăng nhập bằng thông tin tài khoản

### Phương Án B: npm (Thay Thế)

```powershell
# Cài đặt n8n toàn cục
npm install -g n8n

# Khởi động n8n
n8n start --port 5678
```

### Xác Minh Cài Đặt

```powershell
# Kiểm tra health
Invoke-RestMethod -Uri "http://localhost:5678/healthz" -Method Get
# Kết quả mong đợi: { "status": "ok" }
```

---

## 6. Giai Đoạn 2: Xây Dựng Workflow Chatbot Cơ Bản

**Độ phức tạp**: Trung bình · **Tệp thay đổi**: 0 (chỉ giao diện n8n)

### Bước 1: Tạo Workflow Mới

1. Trong n8n, nhấp **"Add workflow"** (nút +, góc trên trái)
2. Đặt tên: `ReliefConnect Chatbot`

### Bước 2: Thêm Webhook Trigger

1. Nhấp nút **"+"** trên canvas
2. Tìm kiếm **"Webhook"** và thêm vào
3. Cấu hình:

| Cài Đặt | Giá Trị |
|---------|--------|
| HTTP Method | POST |
| Path | `chatbot` |
| Authentication | Header Auth |
| Name | `X-N8N-Auth` |
| Value | `khóa-bí-mật-của-bạn` (tạo khóa ngẫu nhiên mạnh) |
| Response Mode | **Response Node** (quan trọng!) |

> **URL webhook sẽ là**: `http://localhost:5678/webhook/chatbot` (production) hoặc `http://localhost:5678/webhook-test/chatbot` (kiểm thử)

### Bước 3: Thêm Node Xử Lý Đầu Vào (Set Node)

1. Thêm node **"Set"** sau Webhook
2. Cấu hình các trường đầu ra:

| Tên Trường | Giá Trị (Biểu Thức) | Kiểu |
|-----------|-------------------|------|
| `userMessage` | `{{ $json.body.message }}` | String |
| `hasImage` | `{{ $json.body.imageBase64 ? true : false }}` | Boolean |
| `imageBase64` | `{{ $json.body.imageBase64 ?? '' }}` | String |
| `imageMimeType` | `{{ $json.body.imageMimeType ?? '' }}` | String |
| `conversationHistory` | `{{ $json.body.history ?? [] }}` | Array |

### Bước 4: Thêm Node Phát Hiện Từ Khóa Khẩn Cấp (IF Node)

1. Thêm node **"IF"** sau Set node
2. Cấu hình điều kiện:

```
Value 1: {{ $json.userMessage.toLowerCase() }}
Operation: Contains
Value 2: (thêm điều kiện OR cho từng từ khóa)
```

Từ khóa khẩn cấp (thêm dưới dạng điều kiện OR):
- `đau tim`, `ngộ độc`, `chảy máu`, `ngừng thở`, `cấp cứu`
- `heart attack`, `poisoning`, `bleeding`, `emergency`, `accident`

3. Đặt tên đầu ra True: `Khẩn Cấp`
4. Đặt tên đầu ra False: `Bình Thường`

### Bước 5: Thêm Google Gemini Credential

1. Vào **Settings → Credentials**
2. Nhấp **"Add Credential"**
3. Tìm kiếm **"Google Gemini (PaLM) API"**
4. Cấu hình:

| Cài Đặt | Giá Trị |
|---------|--------|
| API Key | Gemini API key của bạn |

5. Lưu và đặt tên: `ReliefConnect Gemini`

### Bước 6: Thêm AI Agent Node (Đường Bình Thường)

1. Từ đầu ra **False** (Bình Thường) của IF node, thêm node **"AI Agent"**
2. Cấu hình:

| Cài Đặt | Giá Trị |
|---------|--------|
| Agent Type | Conversational Agent |
| System Message | (dán system prompt bên dưới) |
| Input Text | `{{ $('Set').item.json.userMessage }}` |

**System Message:**
```
Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam.
Nhiệm vụ: giúp người dùng tìm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, trả lời câu hỏi về tình hình thiên tai.
Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt. Nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh.
Không trả lời các nội dung nhạy cảm, chính trị, vi phạm pháp luật.
```

3. **Sub-node** — Thêm vào AI Agent node:
   - **Chat Model**: Google Gemini Chat Model
     - Model: `gemini-2.5-flash`
     - Temperature: `0.7`
     - Max Tokens: `1024`
   - **Memory**: Window Buffer Memory
     - Context Window Length: `20`

### Bước 7: Thêm Phản Hồi Khẩn Cấp (Set Node)

Từ đầu ra **True** (Khẩn Cấp), thêm Set node:

| Tên Trường | Giá Trị | Kiểu |
|-----------|--------|------|
| `response` | `{{ $json.output }}` | String |
| `hasSafetyWarning` | `true` | Boolean |

### Bước 8: Thêm Phản Hồi Bình Thường (Set Node)

Sau AI Agent (đường bình thường), thêm Set node:

| Tên Trường | Giá Trị | Kiểu |
|-----------|--------|------|
| `response` | `{{ $json.output }}` | String |
| `hasSafetyWarning` | `false` | Boolean |

### Bước 9: Thêm Node Respond to Webhook

1. Thêm node **"Respond to Webhook"**
2. Kết nối CẢ HAI Set node phản hồi với nó
3. JSON body:

```json
{
  "response": "{{ $json.response }}",
  "hasSafetyWarning": {{ $json.hasSafetyWarning }}
}
```

### Bước 10: Kiểm Thử Workflow

```powershell
$body = @{
    message = "Xin chào, tôi cần giúp đỡ"
    history = @()
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:5678/webhook-test/chatbot" `
    -Method Post `
    -ContentType "application/json" `
    -Headers @{ "X-N8N-Auth" = "khóa-bí-mật-của-bạn" } `
    -Body $body
```

### Bước 11: Kích Hoạt Workflow

1. Bật công tắc **"Active"** ở góc trên phải của trình chỉnh sửa workflow
2. URL production sẽ là: `http://localhost:5678/webhook/chatbot`

> **Quan trọng**: URL test (`/webhook-test/`) chỉ hoạt động khi workflow đang mở trong trình chỉnh sửa. URL production (`/webhook/`) hoạt động khi workflow đã được kích hoạt.

---

## 7. Giai Đoạn 2B: Cấu Hình Dify Knowledge Base (RAG)

**Độ phức tạp**: Trung bình · **Tệp thay đổi**: n8n workflow + thiết lập Dify UI

> **Giai đoạn này thêm Retrieval-Augmented Generation** — chatbot sẽ tìm kiếm cơ sở kiến thức trước khi tạo phản hồi, cho ra câu trả lời có căn cứ, có trích dẫn. Thực hiện sau Giai Đoạn 2.

### Bước 1: Tạo Tài Khoản Dify và Knowledge Base

1. Đăng ký tại [dify.ai](https://dify.ai) (cloud) hoặc triển khai self-hosted qua Docker
2. Vào **Knowledge** → **Create Knowledge**
3. Tên: `ReliefConnect Aid Knowledge Base`
4. Tải lên tài liệu:
   - Quy trình cứu trợ thiên tai (PDF/DOCX)
   - Hướng dẫn sử dụng nền tảng (Markdown)
   - Quy tắc đủ điều kiện nhận viện trợ
   - Danh bạ liên lạc khẩn cấp
   - Tổng hợp câu hỏi thường gặp

### Bước 2: Cấu Hình Cài Đặt Lập Chỉ Mục

| Cài Đặt | Giá Trị |
|---------|--------|
| Index Method | **High Quality** (dùng embedding model) |
| Embedding Model | `text-embedding-3-large` hoặc `jina-embeddings-v3` |
| Max Tokens Per Chunk | `1024` |
| Chunk Overlap | `100` |
| Separator | `\n\n` |

> **Tại sao High Quality?** Bắt buộc để dùng hybrid/semantic search. Economy mode chỉ hỗ trợ BM25 keyword search.

### Bước 3: Cấu Hình Cài Đặt Truy Xuất

| Cài Đặt | Giá Trị |
|---------|--------|
| Search Method | Hybrid Search |
| Reranking Model | Cohere — `rerank-multilingual-v3.0` |
| Top K | 6 |
| Score Threshold | 0.35 |

### Bước 4: Lấy Dify API Keys

1. **Dataset API Key** (để truy xuất): Knowledge Settings → API Access
2. **Chatflow API Key** (để tạo nội dung): Create App → API Access

> Đây là **hai khóa khác nhau** — không nhầm lẫn hai loại này.

### Bước 5: Tạo Hai Ứng Dụng Dify Chatflow

**Chatflow Đơn Giản** (cho truy vấn thông thường):
- Model: `gemini-2.0-flash` hoặc `gpt-4o-mini`
- Temperature: 0.5
- Thêm biến text input: `retrieved_context`
- System prompt bao gồm placeholder `{retrieved_context}`

**Chatflow Phức Tạp** (cho truy vấn chính sách/y tế/nhiều bước):
- Model: `gemini-2.5-pro` hoặc `gpt-4o`
- Temperature: 0.3 (thấp hơn = suy luận chính xác hơn)
- Cùng template system prompt với `{retrieved_context}`

### Bước 6: Kiểm Thử Truy Xuất Qua Dashboard Dify

1. Knowledge → Dataset của bạn → **Retrieval Testing**
2. Nhập các truy vấn test (tiếng Việt và tiếng Anh)
3. Xác minh các đoạn văn bản liên quan được trả về với điểm > 0.35

### Bước 7: Thêm Dify Credentials vào n8n

Trong n8n → Settings → Credentials → Create New:

| Loại Credential | Tên | Header Name | Header Value |
|----------------|-----|-------------|-------------|
| Header Auth | `Dify Dataset Key` | `Authorization` | `Bearer YOUR_DATASET_KEY` |
| Header Auth | `Dify Simple Chatflow Key` | `Authorization` | `Bearer YOUR_SIMPLE_KEY` |
| Header Auth | `Dify Complex Chatflow Key` | `Authorization` | `Bearer YOUR_COMPLEX_KEY` |

### Bước 8: Thêm Biến Môi Trường n8n

Trong `docker-compose.n8n.yml`, thêm:

```yaml
environment:
  # ... các biến hiện có ...
  - DIFY_BASE_URL=https://api.dify.ai/v1
  - DIFY_DATASET_ID=dataset-id-của-bạn
```

---

## 8. Giai Đoạn 3: Tích Hợp Backend

**Độ phức tạp**: Trung bình · **Tệp thay đổi**: 5–7 tệp

### Bước 1: Thêm Cấu Hình

Thêm cài đặt n8n vào `appsettings.Development.json`:

```json
{
  "N8n": {
    "BaseUrl": "http://localhost:5678",
    "WebhookPath": "/webhook/chatbot",
    "AuthToken": "khóa-bí-mật-của-bạn",
    "HealthCheckPath": "/healthz",
    "TimeoutSeconds": 30,
    "HealthCacheDurationSeconds": 30
  }
}
```

### Bước 2: Tạo Interface IChatbotProvider

Tạo `src/ReliefConnect.Core/Interfaces/IChatbotProvider.cs`:

```csharp
namespace ReliefConnect.Core.Interfaces;

public interface IChatbotProvider
{
    Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null);

    Task<bool> IsAvailableAsync();
    string ProviderName { get; }
}
```

### Bước 3: Tạo N8nChatbotProvider

Tạo `src/ReliefConnect.Infrastructure/Services/N8nChatbotProvider.cs`:

```csharp
public class N8nChatbotProvider : IChatbotProvider
{
    private readonly HttpClient _http;
    private readonly string _webhookUrl;
    private readonly string _healthUrl;
    private readonly string _authToken;
    private readonly ILogger<N8nChatbotProvider> _logger;
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
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(int.Parse(config["N8n:TimeoutSeconds"] ?? "30")) };
        _logger = logger;
    }

    public async Task<bool> IsAvailableAsync()
    {
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
            history = conversationHistory?.Select(h => new { role = h.Role, content = h.Content }).ToArray()
                      ?? Array.Empty<object>(),
            imageBase64,
            imageMimeType
        };
        var request = new HttpRequestMessage(HttpMethod.Post, _webhookUrl);
        request.Headers.Add("X-N8N-Auth", _authToken);
        request.Content = JsonContent.Create(payload);
        var response = await _http.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"n8n trả về {response.StatusCode}");
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var responseText = root.GetProperty("response").GetString() ?? "";
        var hasSafetyWarning = root.TryGetProperty("hasSafetyWarning", out var sw) && sw.GetBoolean();
        return (responseText, hasSafetyWarning);
    }
}
```

### Bước 4: Tạo GeminiChatbotProvider (Adapter)

Tạo `src/ReliefConnect.Infrastructure/Services/GeminiChatbotProvider.cs`:

```csharp
public class GeminiChatbotProvider : IChatbotProvider
{
    private readonly IGeminiService _gemini;
    public string ProviderName => "Direct Gemini API";
    public GeminiChatbotProvider(IGeminiService gemini) { _gemini = gemini; }
    public Task<bool> IsAvailableAsync() => Task.FromResult(true); // Luôn khả dụng
    public Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null)
        => _gemini.SendMessageAsync(userMessage, conversationHistory, imageBase64, imageMimeType);
}
```

### Bước 5: Tạo DualChatbotProvider (Bộ Điều Phối)

Tạo `src/ReliefConnect.Infrastructure/Services/DualChatbotProvider.cs`:

```csharp
public class DualChatbotProvider : IChatbotProvider
{
    private readonly N8nChatbotProvider _n8n;
    private readonly GeminiChatbotProvider _gemini;
    private readonly ILogger<DualChatbotProvider> _logger;
    public string ProviderName => "Dual (n8n + Gemini)";

    public DualChatbotProvider(N8nChatbotProvider n8n, GeminiChatbotProvider gemini,
        ILogger<DualChatbotProvider> logger)
    { _n8n = n8n; _gemini = gemini; _logger = logger; }

    public async Task<bool> IsAvailableAsync()
        => await _n8n.IsAvailableAsync() || await _gemini.IsAvailableAsync();

    public async Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null)
    {
        if (await _n8n.IsAvailableAsync())
        {
            try
            {
                _logger.LogInformation("Routing chatbot request to n8n workflow");
                return await _n8n.SendMessageAsync(userMessage, conversationHistory, imageBase64, imageMimeType);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "n8n workflow failed, falling back to direct Gemini API");
            }
        }
        else { _logger.LogInformation("n8n unavailable, using direct Gemini API"); }
        return await _gemini.SendMessageAsync(userMessage, conversationHistory, imageBase64, imageMimeType);
    }
}
```

### Bước 6: Đăng Ký vào DI Container

Thêm vào `Program.cs`:

```csharp
builder.Services.AddSingleton<IGeminiService, GeminiService>();
builder.Services.AddSingleton<N8nChatbotProvider>();
builder.Services.AddSingleton<GeminiChatbotProvider>();
builder.Services.AddSingleton<IChatbotProvider, DualChatbotProvider>();
```

### Bước 7: Cập Nhật ChatbotController

```csharp
// Trước:
private readonly IGeminiService _gemini;

// Sau:
private readonly IChatbotProvider _chatbot;

// Cập nhật phương thức SendMessage:
var (response, hasSafetyWarning) = await _chatbot.SendMessageAsync(
    dto.Content, historyTuples, dto.ImageBase64, dto.ImageMimeType);
```

---

## 9. Giai Đoạn 3B: Thêm RAG + Phân Luồng Theo Độ Phức Tạp

**Độ phức tạp**: Trung bình-Cao · **Tệp thay đổi**: n8n workflow (nâng cấp từ Giai Đoạn 2)

> **Giai đoạn này nâng cấp workflow Giai Đoạn 2 cơ bản** thành pipeline RAG đầy đủ với truy xuất Dify KB và phân luồng mô hình AI. Yêu cầu Giai Đoạn 2B phải hoàn thành.

### Tổng Quan: Những Gì Thay Đổi

Workflow Giai Đoạn 2 (cơ bản):
```
Webhook → Set Input → IF Khẩn Cấp → AI Agent (Gemini) → Phản Hồi
```

Workflow Giai Đoạn 3B (RAG đầy đủ + phân luồng):
```
Webhook → Set Input → Dify KB Retrieve (hybrid 60/40) → Format Context → IF Phức Tạp → Dify Complex Chatflow → Merge → Phản Hồi
                                                                           └──────────→ Dify Simple Chatflow   ↗
```

### Bước 1: Nhân Bản và Đổi Tên Workflow Cơ Bản

1. Trong n8n, mở workflow Giai Đoạn 2
2. Nhấp menu **⋮** → **Duplicate**
3. Đổi tên bản sao mới thành: `ReliefConnect Chatbot — RAG`
4. Vô hiệu hóa workflow Giai Đoạn 2 gốc

### Bước 2: Xóa AI Agent Node

Xóa (hoặc ngắt kết nối) AI Agent node hiện có — các ứng dụng Dify Chatflow sẽ xử lý tạo nội dung AI.

### Bước 3: Thêm Node Truy Xuất Dify Knowledge Base

Chèn sau Set Input node:

1. Thêm node **HTTP Request**
2. Tên: `Dify Hybrid Search`
3. Cấu hình:

| Cài Đặt | Giá Trị |
|---------|--------|
| Method | POST |
| URL | `https://api.dify.ai/v1/datasets/{{ $env.DIFY_DATASET_ID }}/retrieve` |
| Authentication | Header Auth → credential `Dify Dataset Key` |
| Timeout | 30000ms |

**Request body** (JSON):
```json
{
  "query": "{{ $('Set Input').item.json.userMessage }}",
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
```

### Bước 4: Thêm Node Định Dạng Ngữ Cảnh (Code Node)

1. Thêm node **Code** sau Dify Hybrid Search
2. Tên: `Format Context`
3. Ngôn ngữ: JavaScript

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

### Bước 5: Thay Thế IF Node (Phân Luồng Theo Độ Phức Tạp)

**IF Node: "Truy Vấn Phức Tạp?"**

Điều kiện (BẤT KỲ = True → Đường Phức Tạp):
- Độ dài tin nhắn > `100`
- Có hình ảnh = `true`
- Tin nhắn chứa: `chính sách`, `quy định`, `thủ tục`, `policy`
- `hasEmergency = true`

**Nhánh True** → Phức Tạp (AI mạnh)
**Nhánh False** → Đơn Giản (AI bình thường)

### Bước 6: Thêm Node Dify Complex Chatflow (Đường True)

1. Thêm node **HTTP Request** trên đầu ra True
2. Tên: `Dify Complex AI`
3. URL: `https://api.dify.ai/v1/chat-messages`
4. Authentication: `Dify Complex Chatflow Key`
5. Timeout: 90000ms

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

### Bước 7: Thêm Node Dify Simple Chatflow (Đường False)

Cấu hình tương tự nhưng:
- Dùng `Dify Simple Chatflow Key`
- Timeout: 30000ms

### Bước 8: Merge → Tạo Phản Hồi Cuối → Phản Hồi Webhook

1. Thêm node **Merge** kết nối cả hai đường AI
2. Set node sau Merge:

| Trường | Giá Trị |
|--------|--------|
| `response` | `{{ $json.answer }}` |
| `conversationId` | `{{ $json.conversation_id }}` |
| `hasSafetyWarning` | `{{ $('Format Context').item.json.hasEmergency }}` |
| `sources` | `{{ JSON.stringify($('Format Context').item.json.sources) }}` |
| `provider` | `n8n+dify` |

3. Respond to Webhook:
```json
{
  "response": "{{ $json.response }}",
  "hasSafetyWarning": {{ $json.hasSafetyWarning }},
  "conversationId": "{{ $json.conversationId }}",
  "sources": {{ $json.sources }},
  "provider": "{{ $json.provider }}"
}
```

### Bước 9: Kích Hoạt và Kiểm Thử

```powershell
# Kiểm thử truy vấn phức tạp (câu hỏi chính sách → Dify Complex AI)
$body = @{
    message = "Thủ tục nộp hồ sơ xin cứu trợ y tế và điều kiện đủ điều kiện nhận là gì?"
    history = @()
    userId = "test-user"
    conversationId = ""
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:5678/webhook/chatbot" `
    -Method Post `
    -Headers @{ "X-ReliefConnect-Auth" = "khóa-bí-mật" } `
    -Body $body -ContentType "application/json"

# Kiểm thử truy vấn đơn giản (→ Dify Simple AI)
$simpleBody = @{
    message = "SOS là gì?"
    history = @()
    userId = "test-user"
    conversationId = ""
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:5678/webhook/chatbot" `
    -Method Post `
    -Headers @{ "X-ReliefConnect-Auth" = "khóa-bí-mật" } `
    -Body $simpleBody -ContentType "application/json"
```

> Xem thông số đầy đủ tại [RAG_SYSTEM_ARCHITECTURE.md — Mục 7](../RAG_SYSTEM_ARCHITECTURE.md).

---

## 10. Giai Đoạn 4: Chuyển Dự Phòng Nhà Cung Cấp Kép

### Logic Health Check

```
Yêu cầu đến ChatbotController
    │
    ▼
DualChatbotProvider.SendMessageAsync()
    │
    ├── n8n.IsAvailableAsync() = TRUE → n8n.SendMessageAsync()
    │                                    ├── Thành công → Trả về phản hồi ✓
    │                                    └── Exception → Ghi log → gemini.SendMessageAsync()
    │
    └── n8n.IsAvailableAsync() = FALSE → gemini.SendMessageAsync()
```

### Endpoint Trạng Thái Admin

```csharp
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

## 11. Giai Đoạn 5: Triển Khai Môi Trường Production

### Cài Đặt n8n Production

#### Phương Án A: Docker trên VPS (Khuyến Nghị)

```yaml
# docker-compose.n8n-production.yml
version: '3.8'
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${N8N_HOST}/
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_ADMIN_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_ADMIN_PASSWORD}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=${DB_HOST}
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${DB_USER}
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
      - GENERIC_TIMEZONE=Asia/Ho_Chi_Minh
```

**Caddyfile** (HTTPS tự động):
```
n8n.yourdomain.com {
    reverse_proxy n8n:5678
}
```

#### Phương Án B: n8n Cloud

Sử dụng [n8n.io cloud](https://n8n.io/pricing) cho hosting được quản lý:
- Không cần quản lý Docker
- Cập nhật và sao lưu tự động
- Cập nhật `N8n:BaseUrl` trong `appsettings.json` sang URL cloud

### Danh Sách Kiểm Tra Bảo Mật

- [ ] Webhook n8n sử dụng HTTPS
- [ ] `AuthToken` là chuỗi ngẫu nhiên 64+ ký tự
- [ ] Thông tin xác thực n8n basic auth mạnh và độc nhất
- [ ] `N8N_ENCRYPTION_KEY` đã được đặt
- [ ] Bật xóa dữ liệu execution (168 giờ = 7 ngày)
- [ ] Bảng quản trị n8n không công khai (hoặc được bảo vệ bằng VPN/IP whitelist)

---

## 12. Giai Đoạn 6: Workflow Nâng Cao

### 12.1 RAG Đầy Đủ với Dify (Triển Khai ở Giai Đoạn 3B)

Xem:
- **[Giai Đoạn 2B](#7-giai-đoạn-2b-cấu-hình-dify-knowledge-base-rag)** — Thiết lập Dify Knowledge Base
- **[Giai Đoạn 3B](#9-giai-đoạn-3b-thêm-rag--phân-luồng-theo-độ-phức-tạp)** — Nâng cấp n8n workflow
- **[RAG_SYSTEM_ARCHITECTURE.md](../RAG_SYSTEM_ARCHITECTURE.md)** — Thông số kỹ thuật đầy đủ

### 12.2 Phân Luồng Đa Ngôn Ngữ

```
Webhook → Phát Hiện Ngôn Ngữ (Code Node) → IF Tiếng Việt → Agent Tiếng Việt
                                           → IF Tiếng Anh → Agent Tiếng Anh
```

### 12.3 Pipeline Phân Tích Hình Ảnh

```
Webhook → Xác Thực Hình Ảnh → Gemini Vision → Trích Xuất Phát Hiện → Định Dạng → Phản Hồi
```

### 12.4 Chuyển Tiếp Lên Người Điều Hành

```
AI Agent → Kiểm Tra Độ Tin Cậy → IF Thấp → Tạo DB Record → Thông Báo Admin qua SignalR
                                → IF Cao → Phản Hồi Người Dùng
```

### 12.5 Phân Tích & Ghi Log

```
... → Phản Hồi AI → Ghi Vào Supabase → Phản Hồi Webhook
                  → IF Khẩn Cấp → Gửi Email Cảnh Báo Cho Admin
```

---

## 13. Chiến Lược Kiểm Thử

### 13.1 Unit Tests

```csharp
[Fact]
public async Task SendMessage_N8nAvailable_UsesN8n()
{
    // Arrange: Mock n8n là available
    // Act: Gọi DualChatbotProvider.SendMessageAsync
    // Assert: Xác minh provider n8n được gọi
}

[Fact]
public async Task SendMessage_N8nDown_FallsBackToGemini()
{
    // Arrange: Mock n8n là unavailable
    // Act: Gọi DualChatbotProvider.SendMessageAsync
    // Assert: Xác minh Gemini provider được gọi
}
```

### 13.2 Integration Tests

```powershell
$body = @{
    message = "How do I create an SOS request?"
    history = @()
} | ConvertTo-Json -Depth 3

$response = Invoke-RestMethod -Uri "http://localhost:5678/webhook/chatbot" `
    -Method Post -ContentType "application/json" `
    -Headers @{ "X-N8N-Auth" = "khóa-bí-mật" } -Body $body

Write-Host "Response: $($response.response)"
Write-Host "Safety Warning: $($response.hasSafetyWarning)"
```

### 13.3 Kiểm Thử Chuyển Dự Phòng

```powershell
# 1. Khởi động n8n → Gửi tin nhắn → Xác minh n8n xử lý
# 2. Dừng n8n     → Gửi tin nhắn → Xác minh Gemini xử lý
# 3. Khởi động n8n → Gửi tin nhắn → Xác minh n8n tiếp tục

docker stop reliefconnect-n8n        # Dừng n8n
# Gửi tin nhắn test → nên dùng Gemini dự phòng

docker start reliefconnect-n8n       # Khởi động lại n8n
# Đợi health cache hết hạn (30 giây)
# Gửi tin nhắn test → nên dùng n8n trở lại
```

---

## 14. Xử Lý Sự Cố

### Các Vấn Đề Thường Gặp

| Triệu Chứng | Nguyên Nhân | Giải Pháp |
|-------------|-------------|----------|
| n8n UI hiện "502 Bad Gateway" | Container n8n không chạy | `docker start reliefconnect-n8n` |
| Webhook trả về 404 | Workflow chưa kích hoạt | Bật công tắc "Active" trong n8n |
| Webhook trả về 401 | Auth token không khớp | Kiểm tra header `X-N8N-Auth` |
| Test hoạt động nhưng Production không | Dùng URL test | Kích hoạt workflow; dùng `/webhook/` |
| n8n hết bộ nhớ | Lịch sử hội thoại quá lớn | Giới hạn history 20 tin nhắn |
| Gemini trả về 429 | API key bị giới hạn tốc độ | Thêm key vào pool API key |
| Health check luôn thất bại | Tường lửa chặn cổng 5678 | Kiểm tra Docker port mapping |
| n8n phản hồi chậm (> 30s) | Gemini model quá tải | Tăng timeout; thử mô hình khác |

### Kiểm Tra Log n8n

```powershell
docker logs reliefconnect-n8n --tail 100
docker logs reliefconnect-n8n -f
```

### Log ASP.NET

```
[INF] Routing chatbot request to n8n workflow
[WRN] n8n workflow failed, falling back to direct Gemini API
[INF] n8n unavailable, using direct Gemini API
```

---

## 15. Bảng Thuật Ngữ

| Thuật Ngữ | Định Nghĩa |
|-----------|-----------|
| **n8n** | Nền tảng tự động hóa workflow mã nguồn mở |
| **Node** | Một thao tác đơn lẻ trong workflow n8n |
| **Workflow** | Chuỗi node kết nối xử lý dữ liệu |
| **Webhook** | HTTP endpoint kích hoạt workflow khi được gọi |
| **Trigger** | Node đầu tiên trong workflow khởi tạo execution |
| **Execution** | Một lần chạy hoàn chỉnh của workflow |
| **Credential** | Bí mật đã lưu (API key, mật khẩu) dùng bởi node |
| **AI Agent** | Node n8n điều phối các lời gọi LLM với tools và memory |
| **Window Buffer Memory** | Memory node lưu N tin nhắn gần nhất cho ngữ cảnh hội thoại |
| **RAG** | Retrieval-Augmented Generation — tăng cường AI bằng tài liệu truy xuất |
| **Health Check** | HTTP request nhẹ để xác minh dịch vụ đang chạy |
| **Failover** | Tự động chuyển sang hệ thống dự phòng khi hệ thống chính thất bại |
| **Dual Provider** | Kiến trúc hỗ trợ hai backend AI với tự động chuyển đổi |

---

## Thời Gian Biểu Triển Khai

| Giai Đoạn | Nhiệm Vụ | Độ Phức Tạp | Phụ Thuộc |
|-----------|---------|------------|----------|
| **Giai Đoạn 1** | Cài đặt n8n cục bộ | Thấp | Docker đã cài |
| **Giai Đoạn 2** | Xây dựng workflow chatbot cơ bản | Trung bình | Giai Đoạn 1 |
| **Giai Đoạn 2B** | Cấu hình Dify Knowledge Base | Trung bình | Tài khoản Dify + tài liệu |
| **Giai Đoạn 3** | Backend IChatbotProvider + DualChatbotProvider | Trung bình | Giai Đoạn 2 |
| **Giai Đoạn 3B** | Thêm RAG + phân luồng độ phức tạp vào n8n | Trung bình-Cao | Giai Đoạn 2B + 3 |
| **Giai Đoạn 4** | Health check + logic chuyển dự phòng | Thấp | Giai Đoạn 3 |
| **Giai Đoạn 5** | Triển khai production | Trung bình | Giai Đoạn 4 + VPS/Cloud |
| **Giai Đoạn 6** | Workflow nâng cao (phân tích, chuyển tiếp) | Cao | Giai Đoạn 5 |

---

*Tài liệu này được thiết kế cho các developer chưa có kinh nghiệm n8n. Hãy thực hiện các giai đoạn theo thứ tự để quá trình triển khai diễn ra thuận lợi nhất.*
