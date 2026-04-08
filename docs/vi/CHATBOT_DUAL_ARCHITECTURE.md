# Kiến Trúc Chatbot Nhà Cung Cấp Kép

> *Bản dịch tiếng Việt — xem bản gốc tiếng Anh tại [CHATBOT_DUAL_ARCHITECTURE.md](../CHATBOT_DUAL_ARCHITECTURE.md)*

> Thông số kỹ thuật cho backend AI kép n8n + Gemini trong ReliefConnect, bao gồm lớp truy xuất kiến thức RAG tích hợp Dify.
>
> Phiên bản 2.0 · Ngày 08/04/2026

---

## Mục Lục

1. [Tóm Tắt](#1-tóm-tắt)
2. [Kiến Trúc Hiện Tại](#2-kiến-trúc-hiện-tại)
3. [Kiến Trúc Mục Tiêu](#3-kiến-trúc-mục-tiêu)
4. [Lớp RAG: Truy Xuất Kiến Thức Dify](#4-lớp-rag-truy-xuất-kiến-thức-dify)
5. [Interface Contract](#5-interface-contract)
6. [Các Triển Khai Nhà Cung Cấp](#6-các-triển-khai-nhà-cung-cấp)
7. [Chiến Lược Chuyển Dự Phòng](#7-chiến-lược-chuyển-dự-phòng)
8. [Giao Thức Webhook n8n](#8-giao-thức-webhook-n8n)
9. [Tham Chiếu Cấu Hình](#9-tham-chiếu-cấu-hình)
10. [Sơ Đồ Tuần Tự](#10-sơ-đồ-tuần-tự)
11. [Lộ Trình Di Chuyển](#11-lộ-trình-di-chuyển)
12. [Giám Sát & Quan Sát](#12-giám-sát--quan-sát)
13. [Cân Nhắc Bảo Mật](#13-cân-nhắc-bảo-mật)

---

## 1. Tóm Tắt

Chatbot của ReliefConnect hiện nay giao tiếp trực tiếp với Google Gemini API thông qua `GeminiService`. Tài liệu này mô tả **kiến trúc nhà cung cấp kép** giới thiệu n8n workflow làm backend AI chính, với khả năng tự động chuyển dự phòng sang tích hợp Gemini hiện có.

### Mục Tiêu Thiết Kế

| Mục Tiêu | Cách Thực Hiện |
|---------|--------------|
| **Không có downtime** | Tự động chuyển dự phòng sang Gemini khi n8n không liên lạc được |
| **Không thay đổi frontend** | Cùng API `ChatbotController`; việc chuyển đổi nhà cung cấp không hiển thị với client |
| **Tương thích ngược** | `IGeminiService` không thay đổi; interface mới `IChatbotProvider` bọc ngoài nó |
| **Hiển thị vận hành** | Logging và endpoint admin hiển thị nhà cung cấp đang hoạt động |
| **Dễ mở rộng** | Thêm nhà cung cấp thứ ba (ví dụ Azure OpenAI) chỉ cần một `IChatbotProvider` mới |
| **Có căn cứ kiến thức** | n8n truy vấn Dify Knowledge Base (tìm kiếm kết hợp 60/40 + reranker) trước khi tạo phản hồi |
| **Tối ưu chi phí** | Truy vấn đơn giản dùng mô hình rẻ-nhanh; truy vấn phức tạp dùng mô hình mạnh |
| **Hỗ trợ trích dẫn** | Trích dẫn nguồn tài liệu được trả về cùng phản hồi AI |

---

## 2. Kiến Trúc Hiện Tại

```
┌──────────────┐     ┌────────────────────┐     ┌──────────────────────┐
│   Frontend   │────▶│  ChatbotController │────▶│    GeminiService     │
│  ChatbotPage │     │                    │     │  (IGeminiService)    │
│              │◀────│  POST /messages    │◀────│                      │
└──────────────┘     └────────────────────┘     │  - Pool API key      │
                                                │  - System prompt     │
                                                │  - Phát hiện khẩn cấp│
                                                │  - Cài đặt an toàn  │
                                                └──────────┬───────────┘
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │  Google Gemini API   │
                                                │  generativelanguage  │
                                                │  .googleapis.com     │
                                                └──────────────────────┘
```

### Luồng Yêu Cầu Hiện Tại

1. Frontend gửi `POST /api/chatbot/conversations/{id}/messages` với `SendMessageDto`
2. `ChatbotController` xác thực đầu vào, lưu tin nhắn người dùng vào DB
3. Lấy 20 tin nhắn gần nhất để làm ngữ cảnh
4. Gọi `IGeminiService.SendMessageAsync(message, history, image, mimeType)`
5. `GeminiService` chọn API key ít dùng nhất, gọi Gemini REST API
6. Phản hồi được lưu vào DB, trả về frontend

### Hạn Chế

- **Phụ thuộc vào mô hình**: Thay đổi mô hình AI yêu cầu thay code và deploy lại
- **Không có debug trực quan**: Không thể kiểm tra luồng hội thoại AI mà không đọc code
- **Khả năng mở rộng hạn chế**: Thêm RAG, tools, hoặc chuỗi nhiều bước đòi hỏi nhiều code
- **Không tách biệt trách nhiệm**: Phát hiện khẩn cấp, lọc an toàn và tạo AI trộn lẫn trong một service

---

## 3. Kiến Trúc Mục Tiêu

```
┌──────────────┐     ┌────────────────────┐     ┌────────────────────────────────┐
│   Frontend   │────▶│  ChatbotController │────▶│    DualChatbotProvider         │
│  ChatbotPage │     │                    │     │    (IChatbotProvider)           │
│              │◀────│  POST /messages    │◀────│                                 │
└──────────────┘     └────────────────────┘     │  ┌─────────────────────────┐   │
                                                │  │ Cache health check n8n  │   │
                                                │  │ (TTL 30 giây)            │   │
                                                │  └────────┬────────────────┘   │
                                                │           │                    │
                                                │     ┌─────▼─────┐             │
                                                │     │  n8n OK?  │             │
                                                │     └──┬──────┬──┘             │
                                                │    CÓ  │      │ KHÔNG          │
                                                │        ▼      ▼                │
                                                │  ┌─────────┐ ┌───────────┐    │
                                                │  │  N8n     │ │ Gemini    │    │
                                                │  │ Provider │ │ Provider  │    │
                                                │  └────┬────┘ └─────┬─────┘    │
                                                └───────┼────────────┼───────────┘
                                                        │            │
                              ┌─────────────────▼───┐  ┌────▼───────────────┐
                              │  Server n8n Workflow  │  │  Google Gemini API │
                              │  (cổng 5678)          │  │  (trực tiếp)       │
                              │                       │  └───────────────────┘
                              │  PIPELINE RAG:        │
                              │  Webhook              │
                              │  ↓                    │
                              │  Dify KB Retrieve ◦──────────────────▶ Dify KB
                              │  (kết hợp 60%+40%)    │   (Retrieval API)
                              │  ↓                    │
                              │  IF Phức Tạp? ───────────────────▶ Dify Complex
                              │              └───────────────────▶ Dify Simple
                              │  Phản Hồi             │
                              └──────────────────────┘
```

---

## 4. Lớp RAG: Truy Xuất Kiến Thức Dify

> Phần này ghi lại lớp truy xuất kiến thức được thêm vào Phiên bản 2.0. Lớp này hoạt động hoàn toàn trong n8n và trong suốt với backend ASP.NET.

### Lớp RAG Làm Gì

Trước khi gọi bất kỳ mô hình AI nào, n8n truy vấn **Dify Knowledge Base** để lấy các đoạn tài liệu liên quan. Các đoạn này được đưa vào prompt AI làm ngữ cảnh, đảm bảo phản hồi dựa trên kiến thức cụ thể của nền tảng thay vì dữ liệu huấn luyện chung của LLM.

### Tìm Kiếm Kết Hợp: 60% + 40%

| Thành Phần | Trọng Số | Phương Pháp | Ưu Điểm |
|-----------|---------|------------|---------|
| Semantic Embedding | **60%** | Cosine similarity vector dày — nắm bắt ý nghĩa và từ đồng nghĩa | Tìm `"hỗ trợ"` khi người dùng gõ `"viện trợ"` |
| Keyword / BM25 | **40%** | Khớp tần suất từ | Tìm `"Trung tâm cứu trợ Quận 1"` theo cụm từ chính xác |

Sau khi kết hợp, một cross-encoder **Cohere `rerank-multilingual-v3.0`** tái chấm điểm các kết quả hàng đầu, tối ưu hóa độ chính xác cho tiếng Việt.

### Quyết Định Phân Luồng Theo Độ Phức Tạp

| Đặc Điểm Truy Vấn | Tầng AI | Mô Hình |
|-------------------|--------|--------|
| Độ dài < 100 ký tự, FAQ đơn giản | **Bình Thường** | Gemini 2.0 Flash / GPT-4o mini |
| Độ dài ≥ 100 ký tự, chính sách/y tế/nhiều bước | **Mạnh Mẽ** | Gemini 2.5 Pro / GPT-4o |
| Chứa từ khóa khẩn cấp | **Mạnh Mẽ** + `hasSafetyWarning: true` | Gemini 2.5 Pro |
| Chứa hình ảnh | **Mạnh Mẽ** | Gemini 2.5 Pro |

### Hợp Đồng Phản Hồi Cập Nhật

Khi n8n (với RAG) xử lý tin nhắn, phản hồi giờ bao gồm trích dẫn nguồn:

```json
{
  "response": "Câu trả lời do AI tạo ra...",
  "hasSafetyWarning": false,
  "conversationId": "dify-conversation-uuid",
  "sources": [
    { "documentName": "relief_policy.pdf", "score": 0.87, "excerpt": "..." }
  ],
  "provider": "n8n+dify"
}
```

> Xem [RAG_SYSTEM_ARCHITECTURE.md](RAG_SYSTEM_ARCHITECTURE.md) để có thông số kỹ thuật đầy đủ của pipeline RAG.

---

## 5. Interface Contract

### IChatbotProvider

```csharp
namespace ReliefConnect.Core.Interfaces;

public interface IChatbotProvider
{
    /// <summary>Tên hiển thị của nhà cung cấp dùng để ghi log.</summary>
    string ProviderName { get; }

    /// <summary>Kiểm tra xem nhà cung cấp này có khả dụng không.</summary>
    Task<bool> IsAvailableAsync();

    /// <summary>Gửi tin nhắn và nhận phản hồi AI.</summary>
    Task<(string Response, bool HasSafetyWarning)> SendMessageAsync(
        string userMessage,
        IEnumerable<(string Role, string Content)>? conversationHistory = null,
        string? imageBase64 = null,
        string? imageMimeType = null);
}
```

### Các Quyết Định Thiết Kế Chính

| Quyết Định | Lý Do |
|-----------|-------|
| Cùng kiểu trả về với `IGeminiService` | Di chuyển không cần thay đổi `ChatbotController` |
| `IsAvailableAsync()` là phương thức riêng | Cho phép kiểm tra health độc lập với việc gửi tin nhắn |
| Thuộc tính `ProviderName` | Cho phép ghi log có cấu trúc mà không cần kiểm tra kiểu dữ liệu |
| Tham số hình ảnh nullable | Duy trì hỗ trợ đa phương thức hiện có |
| Không có cancellation token | Khớp với chữ ký `IGeminiService` hiện có |

---

## 6. Các Triển Khai Nhà Cung Cấp

### 6.1 N8nChatbotProvider

**Trách Nhiệm**: Giao tiếp HTTP với endpoint webhook n8n

| Khía Cạnh | Chi Tiết |
|-----------|---------|
| Health check | `GET {baseUrl}/healthz` với cache TTL 30s |
| Gửi tin nhắn | `POST {baseUrl}/webhook/chatbot` với JSON body |
| Xác thực | Header `X-N8N-Auth` với bí mật dùng chung |
| Timeout | 30 giây (có thể cấu hình) |
| Xử lý lỗi | Ném `HttpRequestException` khi non-2xx (bắt bởi `DualChatbotProvider`) |

### 6.2 GeminiChatbotProvider

**Trách Nhiệm**: Adapter bọc `IGeminiService` hiện có

| Khía Cạnh | Chi Tiết |
|-----------|---------|
| Health check | Luôn trả về `true` (nhà cung cấp dự phòng) |
| Gửi tin nhắn | Uỷ thác cho `IGeminiService.SendMessageAsync()` |
| Cấu hình | Không có (dùng cấu hình `GeminiService` hiện có) |

### 6.3 DualChatbotProvider

**Trách Nhiệm**: Điều phối và logic chuyển dự phòng

| Khía Cạnh | Chi Tiết |
|-----------|---------|
| Nhà cung cấp chính | `N8nChatbotProvider` |
| Nhà cung cấp dự phòng | `GeminiChatbotProvider` |
| Điều kiện chuyển dự phòng | Lỗi health check n8n HOẶC exception khi gọi n8n |
| Cache health check | 30 giây (ngăn spam health check) |
| Ghi log | Ghi log lựa chọn nhà cung cấp và sự kiện chuyển dự phòng |

---

## 7. Chiến Lược Chuyển Dự Phòng

### Ma Trận Quyết Định

| Health n8n | Gửi n8n | Hành Động | Nhà Cung Cấp Được Dùng |
|-----------|---------|----------|----------------------|
| ✅ Bình thường | ✅ Thành công | Bình thường | n8n |
| ✅ Bình thường | ❌ Lỗi | Chuyển dự phòng | Gemini (ghi log cảnh báo) |
| ❌ Ngừng | — | Dự phòng trực tiếp | Gemini (ghi log thông tin) |
| ❌ Ngừng (cache) | — | Dự phòng từ cache | Gemini (không health check) |

### Hành Vi Cache Health Check

```
T=0s   : Yêu cầu đầu tiên → health check → cache kết quả (TTL 30s)
T=5s   : Yêu cầu thứ hai → dùng kết quả cache (không gọi HTTP)
T=15s  : Yêu cầu thứ ba → dùng kết quả cache (không gọi HTTP)
T=31s  : Yêu cầu thứ tư → cache hết hạn → gọi HTTP mới → cache kết quả
```

### Hành Vi Phục Hồi

Khi n8n hoạt động trở lại:
1. Cache health hết hạn (tối đa 30 giây)
2. Health check tiếp theo thành công
3. Yêu cầu tiếp theo được định tuyến đến n8n
4. Không cần can thiệp thủ công

---

## 8. Giao Thức Webhook n8n

### Định Dạng Yêu Cầu (v2.0 — hỗ trợ RAG)

```http
POST /webhook/chatbot HTTP/1.1
Host: localhost:5678
Content-Type: application/json
X-N8N-Auth: {bí-mật-dùng-chung}

{
  "message": "Xin chào, tôi cần giúp đỡ",
  "history": [
    { "role": "user", "content": "Tin nhắn người dùng trước đó" },
    { "role": "model", "content": "Phản hồi bot trước đó" }
  ],
  "userId": "user-uuid",
  "conversationId": "",
  "imageBase64": "chuỗi-base64-tùy-chọn",
  "imageMimeType": "image/jpeg"
}
```

> `userId` và `conversationId` là các trường mới cần thiết bởi Dify để duy trì ngữ cảnh hội thoại. `conversationId` nên là chuỗi rỗng `""` cho cuộc trò chuyện mới, và UUID trả về bởi Dify cho các tin nhắn tiếp theo trong cùng cuộc trò chuyện.

### Định Dạng Phản Hồi (v2.0 — với trích dẫn RAG)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "response": "Xin chào! Tôi là trợ lý AI của ReliefConnect...",
  "hasSafetyWarning": false,
  "conversationId": "dify-uuid-hoặc-rỗng",
  "sources": [
    { "documentName": "platform_guide.pdf", "score": 0.82, "excerpt": "..." }
  ],
  "provider": "n8n+dify"
}
```

> **Tương thích ngược**: `sources` và `conversationId` là các trường mới tùy chọn. Các trường `response` và `hasSafetyWarning` không thay đổi, nên code frontend hiện có vẫn hoạt động mà không cần sửa.

### Phản Hồi Lỗi

| Mã Trạng Thái | Ý Nghĩa | Hành Động Backend |
|--------------|---------|-------------------|
| 200 | Thành công | Dùng phản hồi |
| 401 | Auth token không khớp | Ghi log lỗi, chuyển dự phòng Gemini |
| 404 | Workflow không tìm thấy/không kích hoạt | Ghi log lỗi, chuyển dự phòng Gemini |
| 500 | Lỗi thực thi workflow | Ghi log lỗi, chuyển dự phòng Gemini |
| Timeout | n8n hoặc Gemini quá chậm | Ghi log lỗi, chuyển dự phòng Gemini |

---

## 9. Tham Chiếu Cấu Hình

### appsettings.json (v2.0 — với Dify)

```json
{
  "N8n": {
    "BaseUrl": "http://localhost:5678",
    "WebhookPath": "/webhook/chatbot",
    "AuthToken": "bí-mật-ngẫu-nhiên-64-ký-tự-của-bạn",
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
    "DatasetId": "dataset-id-của-bạn",
    "DatasetApiKey": "khóa-dataset-api",
    "SimpleChatflowApiKey": "khóa-chatflow-đơn-giản",
    "ComplexChatflowApiKey": "khóa-chatflow-phức-tạp"
  }
}
```

> **Lưu ý**: Các khóa Dify được n8n sử dụng trực tiếp (cấu hình trong credentials n8n, không phải `appsettings.json`). Phần `Dify` trong `appsettings.json` chỉ cần thiết nếu bạn thêm nhà cung cấp Dify trực tiếp vào phía C#.

### Ghi Đè Biến Môi Trường

| Biến | Config Path | Mô Tả |
|-----|------------|-------|
| `N8N__BaseUrl` | N8n:BaseUrl | URL server n8n |
| `N8N__AuthToken` | N8n:AuthToken | Bí mật xác thực webhook |
| `GEMINI__ApiKey` | Gemini:ApiKey | Khóa Gemini API dự phòng |

---

## 10. Sơ Đồ Tuần Tự

### Luồng RAG Đầy Đủ (n8n + Dify khả dụng)

```
Frontend   Controller   DualProvider  N8nProvider    n8n Workflow     Dify KB     Dify Chatflow
   │           │            │            │               │              │             │
   │ POST /msg │            │            │               │              │             │
   │───────────▶│            │            │               │              │             │
   │           │  IChatbot  │            │               │              │             │
   │           │───────────▶│            │               │              │             │
   │           │            │  n8n OK?   │               │              │             │
   │           │            │───────────▶│ /healthz      │              │             │
   │           │            │    true    │◄──────────────│              │             │
   │           │            │◄───────────│               │              │             │
   │           │            │ SendMsg()  │               │              │             │
   │           │            │───────────▶│ POST /webhook │              │             │
   │           │            │            │──────────────▶│ truy xuất    │             │
   │           │            │            │               │─────────────▶│             │
   │           │            │            │               │ đoạn + điểm  │             │
   │           │            │            │               │◄─────────────│             │
   │           │            │            │               │ NẾUPHỨC TẠP  │ chat-msg    │
   │           │            │            │               │──────────────────────────▶│
   │           │            │            │               │              câu trả lời   │
   │           │            │            │               │◄──────────────────────────│
   │           │            │            │ {phản hồi, sources, conversationId}       │
   │           │            │            │◄──────────────│              │             │
   │           │            │  (resp,sw) │               │              │             │
   │           │            │◄───────────│               │              │             │
   │           │  200 {msg} │            │               │              │             │
   │           │◄───────────│            │               │              │             │
   │  tin nhắn │            │            │               │              │             │
   │◄───────────│            │            │               │              │             │
```

### Luồng Bình Thường (n8n khả dụng, workflow cơ bản)

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
   │                  │                  │                  │  { phản hồi, ... } │
   │                  │                  │                  │◀───────────────────│
   │                  │                  │  (response, sw)  │                    │
   │                  │                  │◀─────────────────│                    │
   │                  │  (response, sw)  │                  │                    │
   │                  │◀─────────────────│                  │                    │
   │  200 { msg }     │                  │                  │                    │
   │◀─────────────────│                  │                  │                    │
```

### Luồng Chuyển Dự Phòng (n8n ngừng)

```
Frontend          Controller         DualProvider       N8nProvider       GeminiProvider
   │                  │                  │                  │                    │
   │  POST /messages  │                  │                  │                    │
   │─────────────────▶│                  │                  │                    │
   │                  │  SendMessage()   │                  │                    │
   │                  │─────────────────▶│                  │                    │
   │                  │                  │  IsAvailable()   │                    │
   │                  │                  │─────────────────▶│                    │
   │                  │                  │  false (cache)   │                    │
   │                  │                  │◀─────────────────│                    │
   │                  │                  │                  │                    │
   │                  │                  │          SendMessage()                │
   │                  │                  │─────────────────────────────────────▶│
   │                  │                  │                              Gemini API
   │                  │                  │          (response, sw)              │
   │                  │                  │◀─────────────────────────────────────│
   │                  │  (response, sw)  │                  │                    │
   │                  │◀─────────────────│                  │                    │
   │  200 { msg }     │                  │                  │                    │
   │◀─────────────────│                  │                  │                    │
```

---

## 11. Lộ Trình Di Chuyển

### Di Chuyển Từng Bước

| Bước | Thay Đổi | Rủi Ro | Rollback |
|------|---------|-------|---------|
| 1 | Thêm interface `IChatbotProvider` | Không có | Xóa tệp |
| 2 | Tạo `GeminiChatbotProvider` (bọc cái hiện có) | Không có | Xóa tệp |
| 3 | Tạo `N8nChatbotProvider` | Không có | Xóa tệp |
| 4 | Tạo `DualChatbotProvider` | Không có | Xóa tệp |
| 5 | Đăng ký DI services trong `Program.cs` | Thấp | Xóa đăng ký |
| 6 | Cập nhật `ChatbotController` dùng `IChatbotProvider` | Thấp | Khôi phục sang `IGeminiService` |
| 7 | Thêm cấu hình n8n vào `appsettings.json` | Không có | Xóa phần cấu hình |
| 8 | Deploy và kiểm thử | — | Khôi phục bước 6 |

### Kế Hoạch Rollback

Nếu nhà cung cấp kép gây ra vấn đề:

1. Đổi constructor `ChatbotController` về `IGeminiService`
2. Xóa đăng ký DI `IChatbotProvider`
3. Deploy

`GeminiService` và `IGeminiService` hiện có vẫn không thay đổi trong suốt quá trình di chuyển, đảm bảo đường dự phòng luôn khả dụng.

---

## 12. Giám Sát & Quan Sát

### Sự Kiện Log

| Mức | Sự Kiện | Ví Dụ |
|-----|---------|-------|
| `Information` | Nhà cung cấp được chọn | "Routing chatbot request to n8n workflow" |
| `Information` | n8n không khả dụng | "n8n unavailable, using direct Gemini API" |
| `Warning` | n8n thất bại, chuyển dự phòng | "n8n workflow failed, falling back to direct Gemini API" |
| `Warning` | Health check thất bại | "n8n health check failed: Connection refused" |
| `Error` | Cả hai nhà cung cấp đều thất bại | "All chatbot providers failed" |

### Endpoint Trạng Thái Admin

```
GET /api/chatbot/provider-status
Authorization: Bearer {admin-jwt}

Phản Hồi:
{
  "activeProvider": "n8n Workflow",
  "n8nStatus": "Connected",
  "n8nLastHealthCheck": "2026-04-08T10:30:00Z",
  "geminiStatus": "Available (Fallback)",
  "geminiApiKeyPool": 3
}
```

### Các Chỉ Số Cần Theo Dõi

| Chỉ Số | Nguồn | Ngưỡng Cảnh Báo |
|--------|-------|----------------|
| Tính khả dụng n8n | Cache health check | < 95% trong 1 giờ |
| Thời gian phản hồi n8n | Thời lượng yêu cầu | > 10s trung bình |
| Số lần chuyển dự phòng | Sự kiện log | > 5 lần/giờ |
| Tỷ lệ dự phòng Gemini | Log lựa chọn nhà cung cấp | > 20% các yêu cầu |

---

## 13. Cân Nhắc Bảo Mật

### Xác Thực Webhook

| Tầng | Cơ Chế |
|------|--------|
| Truyền tải | HTTPS trong production (TLS 1.2+) |
| Ứng dụng | Header `X-N8N-Auth` với bí mật dùng chung |
| Bảng quản trị n8n | Xác thực cơ bản (thông tin riêng) |
| Lưu trữ credential | n8n mã hóa credentials với `N8N_ENCRYPTION_KEY` |

### Dữ Liệu Trong Quá Trình Truyền

| Dữ Liệu | Từ → Đến | Bảo Vệ |
|---------|---------|--------|
| Tin nhắn người dùng | ASP.NET → n8n | HTTPS + auth header |
| Lịch sử hội thoại | ASP.NET → n8n | HTTPS + auth header |
| Dữ liệu hình ảnh (base64) | ASP.NET → n8n | HTTPS + auth header |
| API keys | n8n → Gemini | HTTPS + header `x-goog-api-key` |

### Quản Lý Bí Mật

| Bí Mật | Phát Triển | Production |
|--------|-----------|-----------|
| n8n auth token | `appsettings.Development.json` | Biến môi trường |
| Gemini API key | Pool key DB + file cấu hình | Pool key DB + env var |
| Mật khẩu quản trị n8n | Biến env Docker | Docker secret / env var |
| Khóa mã hóa n8n | Không cần (dev) | Docker secret (bắt buộc) |

### Mô Hình Mối Đe Dọa

| Mối Đe Dọa | Biện Pháp Giảm Thiểu |
|-----------|---------------------|
| Truy cập webhook trái phép | Xác thực header `X-N8N-Auth` |
| Lộ bảng quản trị n8n | Xác thực cơ bản + IP whitelist trong production |
| Đánh cắp credential từ DB n8n | `N8N_ENCRYPTION_KEY` mã hóa lúc lưu trữ |
| Tấn công MITM trên n8n ↔ Gemini | HTTPS bắt buộc |
| Prompt injection qua history | HtmlSanitizer hiện có trên đầu vào; bộ lọc an toàn Gemini |

---

*Tài liệu kiến trúc này nên được đọc cùng [N8N_IMPLEMENTATION_PLAN.md](N8N_IMPLEMENTATION_PLAN.md) để có hướng dẫn triển khai từng bước và [RAG_SYSTEM_ARCHITECTURE.md](RAG_SYSTEM_ARCHITECTURE.md) để có thông số kỹ thuật pipeline truy xuất kiến thức đầy đủ.*
