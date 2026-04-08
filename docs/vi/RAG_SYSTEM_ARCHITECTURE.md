# Kiến Trúc Hệ Thống RAG — Chatbot ReliefConnect

> *Bản dịch tiếng Việt — xem bản gốc tiếng Anh tại [RAG_SYSTEM_ARCHITECTURE.md](../RAG_SYSTEM_ARCHITECTURE.md)*

> Thông số đầy đủ cho pipeline Retrieval-Augmented Generation (RAG) được hỗ trợ bởi Dify Knowledge Base với tìm kiếm kết hợp, định tuyến truy vấn thông minh và lựa chọn mô hình AI hai tầng.
>
> Phiên bản 1.0 · Ngày 08/04/2026

---

## Mục Lục

1. [Tổng Quan & Mục Tiêu](#1-tổng-quan--mục-tiêu)
2. [Kiến Trúc Pipeline Đầy Đủ](#2-kiến-trúc-pipeline-đầy-đủ)
3. [Chi Tiết Thành Phần: Tìm Kiếm Kết Hợp (60/40)](#3-chi-tiết-thành-phần-tìm-kiếm-kết-hợp-6040)
4. [Chi Tiết Thành Phần: Dify Knowledge Base](#4-chi-tiết-thành-phần-dify-knowledge-base)
5. [Chi Tiết Thành Phần: Phân Luồng Theo Độ Phức Tạp](#5-chi-tiết-thành-phần-phân-luồng-theo-độ-phức-tạp)
6. [Chi Tiết Thành Phần: Mô Hình AI Hai Tầng](#6-chi-tiết-thành-phần-mô-hình-ai-hai-tầng)
7. [Thiết Kế Workflow n8n (Từng Bước)](#7-thiết-kế-workflow-n8n-từng-bước)
8. [Thiết Lập Dify Knowledge Base](#8-thiết-lập-dify-knowledge-base)
9. [Tích Hợp Backend (ASP.NET Core)](#9-tích-hợp-backend-aspnet-core)
10. [Tham Chiếu Luồng Dữ Liệu](#10-tham-chiếu-luồng-dữ-liệu)
11. [Tham Chiếu API Contract](#11-tham-chiếu-api-contract)
12. [Điều Chỉnh Hiệu Suất](#12-điều-chỉnh-hiệu-suất)
13. [Sổ Tay Vận Hành](#13-sổ-tay-vận-hành)

---

## 1. Tổng Quan & Mục Tiêu

### Vấn Đề Gì Cần Giải Quyết?

Chatbot hiện tại gửi mọi tin nhắn người dùng trực tiếp đến một LLM đa mục đích. Điều này có ba vấn đề cốt lõi:

| Vấn Đề | Tác Động |
|--------|---------|
| LLM không có kiến thức cụ thể về nền tảng | Ảo giác về quy trình ReliefConnect |
| Mọi truy vấn đều dùng mô hình Pro đắt tiền | Chi phí cao cho lời chào/FAQ đơn giản |
| Không có trích dẫn nguồn | Người dùng không thể xác minh câu trả lời AI |

### Giải Pháp: RAG + Định Tuyến Thông Minh

```
Truy Vấn Người Dùng
    │
    ▼ [Bước 1]
Tìm Kiếm Kết Hợp trên Dify Knowledge Base
  (60% semantic embedding + 40% keyword/BM25)
    │
    ▼ [Bước 2]
Lấy top-K đoạn tài liệu liên quan
    │
    ▼ [Bước 3]
Phân loại độ phức tạp truy vấn
    │
    ├── Đơn giản → AI Bình Thường (Gemini Flash) + ngữ cảnh đã truy xuất
    └── Phức tạp/Quan trọng → AI Mạnh Mẽ (Gemini Pro / GPT-4o) + ngữ cảnh đã truy xuất
    │
    ▼ [Bước 4]
Trả về phản hồi có căn cứ, có trích dẫn cho người dùng
```

### Nguyên Tắc Thiết Kế

| Nguyên Tắc | Triển Khai |
|-----------|----------|
| **Câu trả lời có căn cứ** | Mọi phản hồi được tăng cường bằng nội dung từ knowledge base |
| **Hiệu quả chi phí** | Định tuyến 80% truy vấn điển hình (FAQ đơn giản) đến mô hình rẻ-nhanh |
| **Độ chính xác** | Truy vấn chính sách/y tế phức tạp dùng mô hình lý luận đầy đủ |
| **Minh bạch** | Trích dẫn được trả về cùng câu trả lời |
| **Đa ngôn ngữ** | Ưu tiên tiếng Việt với dự phòng tiếng Anh |
| **Linh hoạt** | n8n không khả dụng → dự phòng Gemini trực tiếp (không có RAG) |

---

## 2. Kiến Trúc Pipeline Đầy Đủ

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             PIPELINE YÊU CẦU                                   │
│                                                                                 │
│  [1] Frontend (ChatbotPage.tsx)                                                 │
│       │  POST /api/chatbot/conversations/{id}/messages                          │
│       │  Body: { content, imageBase64?, imageMimeType? }                        │
│       ▼                                                                         │
│  [2] ASP.NET Core: ChatbotController                                            │
│       │  Xác thực đầu vào, lưu tin nhắn người dùng, lấy lịch sử               │
│       │  Gọi IChatbotProvider.SendMessageAsync()                                │
│       ▼                                                                         │
│  [3] DualChatbotProvider                                                        │
│       │  n8n khả dụng? → N8nChatbotProvider                                    │
│       │  n8n ngừng?    → GeminiChatbotProvider (dự phòng, không RAG)           │
│       ▼                                                                         │
│  [4] n8n Webhook (POST /webhook/chatbot)                                        │
│       │  Nhận: { message, history[], userId, imageBase64? }                    │
│       ▼                                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                     WORKFLOW n8n                                        │    │
│  │                                                                         │    │
│  │  [4a] Chuẩn Bị Đầu Vào                                                 │    │
│  │        │  Set node: trích xuất message, history, các trường hình ảnh   │    │
│  │        ▼                                                                │    │
│  │  [4b] Tìm Kiếm Kết Hợp → Dify Knowledge Base API                       │    │
│  │        │  POST /v1/datasets/{id}/retrieve                              │    │
│  │        │  search_method: "hybrid_search"                               │    │
│  │        │  weights: { vector_weight: 0.6, keyword_weight: 0.4 }        │    │
│  │        │  reranking: Cohere rerank-multilingual-v3.0                   │    │
│  │        │  top_k: 6  score_threshold: 0.35                              │    │
│  │        ▼                                                                │    │
│  │  [4c] Định Dạng Ngữ Cảnh Đã Truy Xuất                                  │    │
│  │        │  Code node: gộp các đoạn vào ngữ cảnh prompt                 │    │
│  │        ▼                                                                │    │
│  │  [4d] Phân Loại Độ Phức Tạp Truy Vấn                                   │    │
│  │        │  IF node hoặc LLM Text Classifier node                        │    │
│  │        │                                                                │    │
│  │        ├── ĐƠN GIẢN ─────────────────────────────────────────────────┐│    │
│  │        │   (độ dài < 80, giống FAQ, câu hỏi trực tiếp)              ││    │
│  │        │   AI: Gemini 2.0 Flash                                      ││    │
│  │        │   Ngữ cảnh: 3 đoạn hàng đầu                                ││    │
│  │        │                                                              ││    │
│  │        └── PHỨC TẠP / QUAN TRỌNG ─────────────────────────────────┐ ││    │
│  │            (độ dài ≥ 80, chính sách/pháp lý/y tế/nhiều bước)     │ ││    │
│  │            AI: Gemini 2.5 Pro hoặc GPT-4o                         │ ││    │
│  │            Ngữ cảnh: 6 đoạn hàng đầu + lịch sử hội thoại         │ ││    │
│  │                                                          │         │ ││    │
│  │  [4e] Tạo Phản Hồi ◄────────────────────────────────────┘─────────┘ │    │
│  │        │                                                              │    │
│  │        ▼                                                              │    │
│  │  [4f] Xây Dựng Đối Tượng Phản Hồi                                    │    │
│  │        │  { response, hasSafetyWarning, sources[], provider }        │    │
│  │        ▼                                                              │    │
│  │  [4g] Phản Hồi Webhook                                                │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│       │                                                                         │
│       ▼                                                                         │
│  [5] ASP.NET Core: Lưu tin nhắn bot → Trả về MessageResponseDto               │
│       │                                                                         │
│       ▼                                                                         │
│  [6] Frontend: Hiển thị phản hồi + trích dẫn nguồn                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Thành Phần: Tìm Kiếm Kết Hợp (60/40)

### Ý Nghĩa Của "60% Embedding + 40% Rerank"

Tỷ lệ 60/40 mô tả **công thức tính điểm có trọng số** dùng để kết hợp hai tín hiệu liên quan độc lập thành một danh sách xếp hạng:

```
điểm_cuối = 0.6 × điểm_tương_đồng_vector + 0.4 × điểm_keyword_bm25
```

| Thành Phần | Trọng Số | Loại Tín Hiệu | Ưu Điểm |
|-----------|---------|--------------|---------|
| **Embedding Vector (Ngữ Nghĩa)** | 60% | Cosine similarity vector dày — nắm bắt ý nghĩa và từ đồng nghĩa | Tìm `"hỗ trợ"` khi người dùng hỏi `"viện trợ"` |
| **Keyword/BM25 (Từ Vựng)** | 40% | Tần suất từ-nghịch đảo tần suất tài liệu — khớp token chính xác | Tìm `"Trung tâm cứu trợ Quận 1"` chính xác |

### Tại Sao Chọn 60/40?

Tỷ lệ 60% ngữ nghĩa / 40% từ khóa phù hợp với nội dung nhân đạo tiếng Việt vì:

- **Từ đồng nghĩa tiếng Việt phong phú**: Nhiều từ cho "giúp đỡ", "cứu trợ", "khẩn cấp" — tìm kiếm ngữ nghĩa rất quan trọng
- **Danh từ riêng chính xác**: Tên tổ chức, ID khu vực, số điện thoại — tìm kiếm từ khóa quan trọng
- **Ưu thế ngữ nghĩa nhẹ**: Ý nghĩa thường quan trọng hơn cách diễn đạt chính xác trong hướng dẫn khẩn cấp

### Kết Hợp + Xếp Hạng Lại (Hai Giai Đoạn)

Tìm kiếm kết hợp 60/40 tạo ra danh sách xếp hạng ban đầu. Sau đó **cross-encoder reranker** tái chấm điểm top-K kết quả:

```
Giai Đoạn 1: Tìm Kiếm Kết Hợp Có Trọng Số
  Tập ứng viên: 50–100 đoạn (từ chỉ mục dense + BM25)
  Kết hợp: điểm = 0.6×vector + 0.4×BM25
  Đầu ra: danh sách đã sắp xếp, giữ K×2 ứng viên hàng đầu

Giai Đoạn 2: Xếp Hạng Lại Cross-Encoder (Cohere rerank-multilingual-v3.0)
  Đầu vào: cặp (truy vấn, đoạn ứng viên)
  Mô hình: chấm điểm độc lập từng cặp với full attention
  Đầu ra: top-K cuối cùng được sắp xếp theo độ liên quan thực sự

Đầu ra cuối: top_k=6 đoạn liên quan nhất
```

**Tại sao dùng hai giai đoạn?** Cross-encoder chậm (suy luận O(n) cho mỗi ứng viên) — chạy trên tất cả đoạn có thể rất tốn kém. Tìm kiếm kết hợp trước tiên thu hẹp ứng viên xuống tập quản lý được, sau đó xếp hạng lại cung cấp độ chính xác tối đa trên tập đó.

### Cấu Hình Dify API cho 60/40

```json
{
  "query": "tin nhắn người dùng ở đây",
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

> **Lưu ý**: Khi `reranking_mode` là `"weighted_score"`, đối tượng `weights` kiểm soát kết hợp 60/40. Khi `reranking_mode` là `"reranking_model"`, mô hình cross-encoder được dùng thay thế. Đặt cả hai trọng số `weighted_score` VÀ bật reranking model để có pipeline hai giai đoạn đầy đủ.

### Hướng Dẫn Ngưỡng Điểm

| Ngưỡng | Tác Động Với Nội Dung Tiếng Việt |
|--------|----------------------------------|
| `0.20` | Rất thoải mái — nhiều đoạn liên quan yếu được đưa vào |
| `0.35` | **Khuyến nghị** — cân bằng tốt cho Q&A nhân đạo |
| `0.50` | Nghiêm ngặt — có thể bỏ sót đoạn liên quan với truy vấn diễn đạt lại |
| `0.70` | Rất nghiêm ngặt — chỉ khớp gần chính xác mới qua |

---

## 4. Chi Tiết Thành Phần: Dify Knowledge Base

### Dify Là Gì?

**Dify** là nền tảng phát triển ứng dụng LLM mã nguồn mở. Tính năng **Knowledge** của nó cung cấp cơ sở dữ liệu vector được quản lý với:
- Tải lên tài liệu, phân đoạn và embedding
- Tìm kiếm kết hợp (ngữ nghĩa + từ khóa) với xếp hạng lại tùy chọn
- Truy cập API để truy vấn knowledge base từ hệ thống bên ngoài
- Trình xây dựng workflow tích hợp với node Knowledge Retrieval

### Knowledge Base → Ánh Xạ ReliefConnect

| Tính Năng Dify | Ứng Dụng ReliefConnect |
|---------------|----------------------|
| **Dataset** (Knowledge) | Tài liệu hỗ trợ nhân đạo, quy trình SOS, hướng dẫn nền tảng |
| **Retrieval API** | Gọi bởi n8n để lấy ngữ cảnh cho mỗi truy vấn người dùng |
| **Chatflow** | Thay thế: để Dify quản lý toàn bộ cuộc trò chuyện |
| **Workflow** | Pipeline AI nhiều bước phức tạp |
| **Question Classifier** | Định tuyến truy vấn theo danh mục ý định |

### Tài Liệu Được Khuyến Nghị Cho Knowledge Base

| Tài Liệu | Mục Đích | Tần Suất Cập Nhật |
|----------|---------|------------------|
| Hướng dẫn sử dụng nền tảng | Trả lời câu hỏi "cách dùng X" | Khi có tính năng mới |
| Quy trình SOS | Phải làm gì, gọi ai, các bước khẩn cấp | Khi quy trình thay đổi |
| Điều kiện đủ điều kiện viện trợ | Ai đủ điều kiện cho chương trình nào | Hàng tháng |
| Danh bạ liên lạc | Số khẩn cấp, văn phòng khu vực, đường dây nóng | Hàng quý |
| Tổng hợp câu hỏi thường gặp | Câu hỏi người dùng phổ biến | Liên tục |
| Sổ tay tình nguyện viên | Chấp nhận nhiệm vụ, quy trình an toàn | Khi chính sách thay đổi |
| Tài liệu pháp lý/chính sách | Luật cứu trợ thiên tai Việt Nam, các quy định | Khi luật thay đổi |

### Cài Đặt Lập Chỉ Mục Tài Liệu

```
Kỹ Thuật Lập Chỉ Mục: HIGH_QUALITY
  → Dùng embedding model để tạo semantic vector
  → Bắt buộc cho tìm kiếm ngữ nghĩa/kết hợp
  (vs. ECONOMY = chỉ BM25 keyword)

Phân Đoạn:
  Phương pháp: Tự động (dựa trên đoạn văn)
  Số Token Tối Đa Mỗi Đoạn: 1024
  Chồng Lấp Đoạn: 100 token
  Dấu Phân Cách: "\n\n" (ngắt đoạn văn)

Embedding Model:
  Chính: text-embedding-3-large (OpenAI) — vector chất lượng cao
  Thay thế: jina-embeddings-v3 — đa ngôn ngữ, tự host được
```

### Các Endpoint API Knowledge Base

**Base URL**: `https://api.dify.ai/v1` (cloud) hoặc `http://your-dify-instance/v1` (self-hosted)

**Xác Thực**: `Authorization: Bearer {dataset-api-key}` (KHÔNG phải chatflow API key — hai loại khóa khác nhau!)

| Endpoint | Phương Thức | Mục Đích |
|----------|-----------|---------|
| `/datasets/{id}/retrieve` | POST | Truy vấn knowledge base (lời gọi RAG chính của chúng ta) |
| `/datasets/{id}/documents` | GET | Liệt kê tài liệu trong dataset |
| `/datasets/{id}/documents` | POST | Tải lên tài liệu mới |
| `/datasets` | GET | Liệt kê tất cả datasets |

---

## 5. Chi Tiết Thành Phần: Phân Luồng Theo Độ Phức Tạp

### Ma Trận Quyết Định Định Tuyến

| Đặc Điểm Truy Vấn | Điểm | Tầng AI |
|-------------------|-----|--------|
| Độ dài < 60 ký tự | +0 | — |
| Độ dài 60–120 ký tự | +1 | — |
| Độ dài > 120 ký tự | +2 | → Phức Tạp |
| Một từ câu hỏi (what, where, when, khi nào, ở đâu) | +0 | — |
| Câu nhiều mệnh đề | +1 | — |
| Điều kiện ("nếu X, thì Y") | +2 | → Phức Tạp |
| Từ khóa: chính sách, quy định, thủ tục, policy, regulation | +2 | → Phức Tạp |
| Từ khóa: y tế, bệnh, medical, health condition | +1 | — |
| Từ khóa: khẩn cấp, cấp cứu, emergency | +3 | → Phức Tạp |
| Có hình ảnh đính kèm | +2 | → Phức Tạp |
| Tổng điểm ≥ 3 | — | **Phức Tạp → AI Mạnh Mẽ** |
| Tổng điểm < 3 | — | **Đơn Giản → AI Bình Thường** |

### Triển Khai IF Node trong n8n

Triển khai đơn giản nhất dùng kiểm tra từ khóa và độ dài trong IF node:

```
IF Node: "Có Phức Tạp Không?"
Điều kiện (BẤT KỲ điều kiện là True → Đường Phức Tạp):
  - message.length > 100                               → ưu tiên theo độ dài
  - message chứa "chính sách" HOẶC "policy"            → câu hỏi chính sách
  - message chứa "quy định" HOẶC "regulation"          → câu hỏi pháp lý
  - message chứa "thủ tục" HOẶC "procedure"            → câu hỏi thủ tục
  - message chứa "cấp cứu" HOẶC "emergency"            → câu hỏi khủng hoảng
  - imageBase64 không rỗng                             → đa phương thức = phức tạp
```

### Phân Loại Bằng LLM (Nâng Cao)

Để định tuyến tinh tế hơn, dùng lời gọi AI nhỏ trước bước tạo chính:

```
Prompt phân loại:
"Classify this user query as one of: [simple, complex].
Simple: direct factual question, short, single topic.
Complex: requires reasoning, policy interpretation, multi-step answer, medical/legal, or contains an image.
Query: {user_message}
Answer with only the word 'simple' or 'complex'."
```

Dùng Gemini Flash (mô hình rẻ nhất) cho lời gọi phân loại — thêm ~$0.00001 mỗi yêu cầu.

---

## 6. Chi Tiết Thành Phần: Mô Hình AI Hai Tầng

### Các Tầng Mô Hình

| Tầng | Mô Hình | Khi Nào Dùng | Chi Phí Tương Đối |
|-----|--------|------------|------------------|
| **Bình Thường (Tầng 1)** | Gemini 2.0 Flash | FAQ đơn giản, lời chào, câu hỏi thực tế ngắn | 1× |
| **Mạnh Mẽ (Tầng 2)** | Gemini 2.5 Pro | Chính sách phức tạp, y tế, nhiều bước | ~20× |
| **Mạnh Mẽ (Tầng 2 thay thế)** | GPT-4o | Mô hình mạnh thay thế | ~15× |
| **Mạnh Mẽ (Tầng 2 thay thế)** | Claude 3.5 Sonnet | Phân tích tài liệu dài | ~12× |

### Phân Phối Lưu Lượng Dự Kiến

Dựa trên mô hình sử dụng điển hình của chatbot nhân đạo:

| Loại Truy Vấn | % Lưu Lượng | Tầng AI |
|-------------|-----------|--------|
| FAQ đơn giản (cách đăng ký, X là gì) | 45% | Bình Thường |
| Hỗ trợ điều hướng nền tảng | 25% | Bình Thường |
| Câu hỏi chính sách/điều kiện phức tạp | 15% | Mạnh Mẽ |
| Hướng dẫn y tế/khẩn cấp | 10% | Mạnh Mẽ |
| Quy trình nhiều bước | 5% | Mạnh Mẽ |

**Chi phí ròng**: ~70% truy vấn dùng mô hình rẻ → chi phí trung bình thấp hơn ~3-4× so với luôn dùng mô hình Pro.

### Cấu Hình Mô Hình Trong Dify vs. n8n

**Phương Án A — Dify quản lý mô hình**: Tạo hai ứng dụng Dify Chatflow riêng biệt:
- `chatflow-simple` được cấu hình với `gemini-2.0-flash`
- `chatflow-complex` được cấu hình với `gemini-2.5-pro`

n8n định tuyến qua IF node để gọi URL Dify chatflow phù hợp.

**Phương Án B — n8n quản lý mô hình**: n8n dùng node LangChain AI Agent/Chain với hai Chat Model sub-node khác nhau. Dify chỉ dùng để truy xuất kiến thức; n8n xử lý cả hai lời gọi AI.

**Khuyến nghị**: Phương Án A để bảo trì workflow đơn giản hơn. Phương Án B để có nhiều kiểm soát hơn và độ trễ thấp hơn.

---

## 7. Thiết Kế Workflow n8n (Từng Bước)

### Workflow Hoàn Chỉnh: RAG Đầy Đủ + Định Tuyến

#### Node 1: Webhook Trigger

```
Loại: Webhook
HTTP Method: POST
Path: chatbot
Xác Thực: Header Auth
  Tên Header: X-ReliefConnect-Auth
  Giá Trị Header: {bí mật dùng chung 64 ký tự}
Chế Độ Phản Hồi: Respond Using Response Node
```

**Payload đầu vào dự kiến:**
```json
{
  "message": "Tôi cần nộp hồ sơ xin viện trợ thì thủ tục như thế nào?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "model", "content": "..." }
  ],
  "userId": "user-uuid-ở-đây",
  "conversationId": "uuid-tùy-chọn-hoặc-rỗng",
  "imageBase64": null,
  "imageMimeType": null
}
```

---

#### Node 2: Set — Chuẩn Bị Các Trường Đầu Vào

```
Loại: Set
Tên: Prepare Input
Trường:
  userMessage     = {{ $json.body.message }}
  userId          = {{ $json.body.userId || 'anonymous' }}
  conversationId  = {{ $json.body.conversationId || '' }}
  hasImage        = {{ !!$json.body.imageBase64 }}
  imageBase64     = {{ $json.body.imageBase64 || '' }}
  imageMimeType   = {{ $json.body.imageMimeType || '' }}
```

---

#### Node 3: HTTP Request — Truy Xuất Dify Knowledge Base

```
Loại: HTTP Request
Tên: Dify Hybrid Search
Phương Thức: POST
URL: https://api.dify.ai/v1/datasets/{{ $env.DIFY_DATASET_ID }}/retrieve
Xác Thực: Header Auth → Authorization: Bearer {DIFY_DATASET_API_KEY}
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

#### Node 4: Code — Định Dạng Ngữ Cảnh Đã Truy Xuất

```javascript
// Loại: Code (JavaScript)
// Tên: Format Context

const records = $input.item.json.records || [];
const query = $('Prepare Input').item.json.userMessage;

// Xây dựng chuỗi ngữ cảnh có định dạng
const contextChunks = records
  .slice(0, 6)
  .map((r, i) => {
    const docName = r.segment?.document?.name || 'Unknown';
    const score = (r.score || 0).toFixed(3);
    return `--- Nguồn ${i+1}: ${docName} (độ liên quan: ${score}) ---\n${r.segment.content}`;
  });

const context = contextChunks.length > 0
  ? contextChunks.join('\n\n')
  : '';

// Trích dẫn nguồn cho phản hồi
const sources = records.map(r => ({
  documentName: r.segment?.document?.name || 'Unknown',
  score: r.score || 0,
  excerpt: (r.segment?.content || '').substring(0, 200) + '...'
}));

// Kiểm tra từ khóa khẩn cấp
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

#### Node 5: IF — Định Tuyến Theo Độ Phức Tạp

```
Loại: IF
Tên: Route by Complexity
Điều Kiện (BẤT KỲ điều kiện là true → Đường "Complex"):
  - {{ $('Prepare Input').item.json.userMessage.length }} > 100
  - {{ $('Prepare Input').item.json.hasImage }} === true
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('chính sách') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('quy định') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('thủ tục') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('policy') }}
  - {{ $('Prepare Input').item.json.userMessage.toLowerCase().includes('regulation') }}
  - {{ $('Format Context').item.json.hasEmergency }} === true

Nhánh True  → "Complex" (kết nối đến Node 6A)
Nhánh False → "Simple"  (kết nối đến Node 6B)
```

---

#### Node 6A: HTTP Request — Truy Vấn Phức Tạp (Dify Powerful Chatflow)

```
Loại: HTTP Request
Tên: Dify Complex Chatflow (Powerful AI)
Phương Thức: POST
URL: https://api.dify.ai/v1/chat-messages
Xác Thực: Header Auth → Authorization: Bearer {DIFY_CHATFLOW_COMPLEX_API_KEY}
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
Timeout: 90000ms (truy vấn phức tạp mất nhiều thời gian hơn)
```

---

#### Node 6B: HTTP Request — Truy Vấn Đơn Giản (Dify Normal Chatflow)

```
Loại: HTTP Request
Tên: Dify Simple Chatflow (Normal AI)
Phương Thức: POST
URL: https://api.dify.ai/v1/chat-messages
Xác Thực: Header Auth → Authorization: Bearer {DIFY_CHATFLOW_SIMPLE_API_KEY}
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

#### Node 7: Merge — Kết Hợp Cả Hai Đường

```
Loại: Merge
Tên: Merge Responses
Chế Độ: Append (gộp đầu ra từ cả hai đường)
```

---

#### Node 8: Set — Xây Dựng Phản Hồi Cuối

```
Loại: Set
Tên: Build Final Response
Trường:
  response         = {{ $json.answer }}
  conversationId   = {{ $json.conversation_id }}
  hasSafetyWarning = {{ $('Format Context').item.json.hasEmergency }}
  sources          = {{ JSON.stringify($('Format Context').item.json.sources) }}
  provider         = "n8n+dify"
  tier             = {{ $json.model?.includes('flash') ? 'normal' : 'powerful' }}
```

---

#### Node 9: Respond to Webhook

```
Loại: Respond to Webhook
Mã Phản Hồi: 200
Chế Độ Phản Hồi: JSON

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

## 8. Thiết Lập Dify Knowledge Base

### Bước 1: Tạo Tài Khoản Dify

- **Cloud**: Đăng ký tại [dify.ai](https://dify.ai)
- **Self-hosted**: Deploy với Docker (xem tài liệu Dify)

### Bước 2: Tạo Knowledge Base

1. Dashboard → **Knowledge** → **Create Knowledge**
2. Tên: `ReliefConnect Aid Knowledge Base`
3. Tải lên tài liệu (PDF, DOCX, TXT, Markdown)
4. Chọn lập chỉ mục:
   - **Index Method**: High Quality (Embedding)
   - **Embedding Model**: `text-embedding-3-large` hoặc `jina-embeddings-v3`

### Bước 3: Cấu Hình Cài Đặt Truy Xuất

Trong cài đặt Knowledge Base:
- **Search Method**: Hybrid Search
- **Reranking Model**: Cohere — `rerank-multilingual-v3.0`
- **Top K**: 6
- **Score Threshold**: 0.35

### Bước 4: Lấy API Keys

1. **Dataset API Key**: Dify → Knowledge Settings → API Key
   (Dùng cho lời gọi `/datasets/{id}/retrieve` trong n8n)
2. **Chatflow API Key**: Dify → Your App → API Access
   (Dùng cho lời gọi `/v1/chat-messages` trong n8n)

### Bước 5: Tạo Hai Ứng Dụng Dify Chatflow

**Ứng Dụng Chatflow Đơn Giản** (cho truy vấn Tầng 1):
- Model: `gemini-2.0-flash` hoặc `gpt-4o-mini`
- System prompt: Bao gồm biến `{retrieved_context}`
- Temperature: 0.5

**Ứng Dụng Chatflow Phức Tạp** (cho truy vấn Tầng 2):
- Model: `gemini-2.5-pro` hoặc `gpt-4o`
- Cùng cấu trúc system prompt với biến `{retrieved_context}`
- Temperature: 0.3 (thấp hơn = suy luận chính xác hơn cho câu hỏi phức tạp)

**Mẫu System Prompt** (giống cho cả hai, chỉ khác mô hình):
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

## 9. Tích Hợp Backend (ASP.NET Core)

### Contract Yêu Cầu/Phản Hồi Cập Nhật

`N8nChatbotProvider` gửi payload phong phú hơn và nhận lại trích dẫn:

**Yêu cầu đến webhook n8n:**
```json
{
  "message": "văn bản tin nhắn người dùng",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "model", "content": "..." }
  ],
  "userId": "user-uuid",
  "conversationId": "dify-conversation-uuid-hoặc-rỗng",
  "imageBase64": null,
  "imageMimeType": null
}
```

**Phản hồi từ webhook n8n:**
```json
{
  "response": "Văn bản câu trả lời do AI tạo ra",
  "hasSafetyWarning": false,
  "conversationId": "dify-conversation-uuid",
  "sources": [
    {
      "documentName": "relief_aid_policy.pdf",
      "score": 0.87,
      "excerpt": "200 ký tự đầu của đoạn liên quan..."
    }
  ],
  "provider": "n8n+dify"
}
```

### MessageResponseDto Cập Nhật

```csharp
// Trong ReliefConnect.Core/DTOs/MessageResponseDto.cs
public class MessageResponseDto
{
    public int Id { get; set; }
    public string Content { get; set; } = "";
    public bool IsBotMessage { get; set; }
    public bool HasSafetyWarning { get; set; }
    public DateTime SentAt { get; set; }
    
    // MỚI: Trích dẫn nguồn RAG
    public List<ChatSourceDto>? Sources { get; set; }
    
    // MỚI: Nhà cung cấp nào đã xử lý
    public string? Provider { get; set; }
}

public class ChatSourceDto
{
    public string DocumentName { get; set; } = "";
    public double Score { get; set; }
    public string Excerpt { get; set; } = "";
}
```

### Duy Trì ID Hội Thoại

Dify quản lý ID hội thoại riêng của mình. Backend cần duy trì chúng theo hội thoại ASP.NET:

```csharp
// Tùy chọn: Lưu dify_conversation_id trong entity Conversation
// Sau tin nhắn đầu tiên, lưu conversation_id được trả về
// Truyền nó vào các tin nhắn tiếp theo để duy trì ngữ cảnh liên tục
```

---

## 10. Tham Chiếu Luồng Dữ Liệu

### Đường Vàng (n8n + Dify, cả hai đều online)

```
1. Người dùng gõ: "Điều kiện để nhận xét nghiệm y tế trong chương trình cứu trợ là gì?"
2. Frontend → POST /api/chatbot/conversations/5/messages
3. ChatbotController lưu tin nhắn người dùng, gọi IChatbotProvider
4. DualChatbotProvider: n8n healthy → gọi N8nChatbotProvider
5. N8nChatbotProvider: POST webhook n8n với message + history
6. n8n Node 3: POST Dify KB retrieve
   - query: "Điều kiện để nhận xét nghiệm y tế trong chương trình cứu trợ là gì?"
   - hybrid_search: 60% semantic + 40% BM25
   - Reranker: Cohere sắp xếp top đoạn
   - Trả về: 6 đoạn từ "medical_aid_policy.pdf" với điểm 0.85–0.71
7. n8n Node 4: Định dạng ngữ cảnh từ 6 đoạn
8. n8n Node 5: Kiểm tra IF
   - Độ dài: 73 ký tự → bình thường
   - NHƯNG chứa "y tế" → +1, cũng "chương trình" → borderline
   - Quyết định: PHỨC TẠP (y tế + điều kiện = rủi ro cao)
9. n8n Node 6A: POST Dify Complex Chatflow (Gemini Pro)
   - Đầu vào bao gồm retrieved_context với 6 đoạn
   - Gemini 2.5 Pro tạo phản hồi chi tiết, chính xác
10. n8n Node 9: Phản hồi với câu trả lời + hasSafetyWarning + sources
11. ChatbotController lưu tin nhắn bot, trả về frontend
12. Frontend hiển thị câu trả lời với panel trích dẫn nguồn
```

### Đường Dự Phòng (n8n ngừng, Gemini trực tiếp)

```
1. Người dùng gõ bất kỳ tin nhắn nào
2. DualChatbotProvider: health check n8n THẤT BẠI (từ cache)
3. Chuyển sang GeminiChatbotProvider
4. GeminiService: gọi Gemini 2.5 Flash trực tiếp (không RAG)
5. Phản hồi được trả về — không có trích dẫn nguồn, không có định tuyến
6. Người dùng nhận câu trả lời (ít có căn cứ hơn, nhưng khả dụng)
```

---

## 11. Tham Chiếu API Contract

### Webhook n8n

```
POST {N8N_BASE_URL}/webhook/chatbot
Content-Type: application/json
X-ReliefConnect-Auth: {bí-mật-dùng-chung}

Yêu Cầu:
{
  "message": string,           // Bắt buộc
  "history": [{                // Bắt buộc (mảng rỗng nếu mới)
    "role": "user" | "model",
    "content": string
  }],
  "userId": string,            // Bắt buộc để giới hạn bộ nhớ Dify
  "conversationId": string,    // Tùy chọn: "" cho mới, UUID cho tiếp tục
  "imageBase64": string | null,
  "imageMimeType": string | null
}

Phản Hồi 200:
{
  "response": string,
  "hasSafetyWarning": boolean,
  "conversationId": string,    // Lưu cái này cho tin nhắn tiếp theo
  "sources": [{
    "documentName": string,
    "score": number,
    "excerpt": string
  }],
  "provider": string           // "n8n+dify" | "n8n+gemini"
}
```

### Truy Xuất Dify Knowledge Base

```
POST https://api.dify.ai/v1/datasets/{dataset_id}/retrieve
Authorization: Bearer {DIFY_DATASET_API_KEY}
Content-Type: application/json

Yêu Cầu:
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

Phản Hồi 200:
{
  "query": { "content": string },
  "records": [{
    "segment": {
      "content": string,            // Đoạn văn bản đã truy xuất
      "document": { "name": string },
      "word_count": number
    },
    "score": number                 // Điểm liên quan 0.0–1.0
  }]
}
```

### Dify Chatflow Chat Messages

```
POST https://api.dify.ai/v1/chat-messages
Authorization: Bearer {DIFY_CHATFLOW_API_KEY}
Content-Type: application/json

Yêu Cầu:
{
  "inputs": { "retrieved_context": string },
  "query": string,
  "response_mode": "blocking",
  "conversation_id": string,  // "" cho hội thoại mới
  "user": string
}

Phản Hồi 200:
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

## 12. Điều Chỉnh Hiệu Suất

| Chỉ Số | Mục Tiêu | Đòn Bẩy Điều Chỉnh |
|--------|---------|-------------------|
| Tổng thời gian phản hồi | < 8s (đơn giản), < 20s (phức tạp) | Giảm top_k; dùng mô hình nhanh hơn |
| Truy xuất kiến thức | < 2s | Giảm top_k; kiểm tra tải server Dify |
| Xếp hạng lại | < 1.5s | Cohere nhanh; giảm số ứng viên |
| Tạo AI đơn giản | < 3s | Gemini Flash ~2-3s |
| Tạo AI phức tạp | < 15s | Gemini Pro/GPT-4o khoảng thời gian điển hình |
| Chất lượng ngữ cảnh | > 0.5 điểm trung bình | Tăng score_threshold lên |
| Độ chính xác định tuyến | > 90% đúng tầng | Điều chỉnh điều kiện IF; thêm bộ phân loại LLM |

### Tối Ưu Cho Nội Dung Tiếng Việt

```
1. Dùng jina-embeddings-v3 cho embedding (chuyên gia đa ngôn ngữ)
2. Cohere rerank-multilingual-v3.0 (cross-encoder 100+ ngôn ngữ)
3. Tăng chồng lấp đoạn lên 100 token (ngữ cảnh tiếng Việt trải rộng)
4. Bao gồm từ đồng nghĩa tiếng Việt trong kiểm tra độ phức tạp IF
5. Ngưỡng điểm 0.35 (thấp hơn mặc định tiếng Anh) do đặc trưng không gian embedding tiếng Việt
```

---

## 13. Sổ Tay Vận Hành

### Kiểm Tra Sức Khỏe Hệ Thống

```powershell
# 1. Kiểm tra n8n đang chạy
Invoke-RestMethod "http://localhost:5678/healthz"

# 2. Kiểm tra Dify Knowledge Retrieve trực tiếp
$headers = @{ "Authorization" = "Bearer YOUR_DATASET_KEY" }
$body = @{
  query = "truy vấn kiểm thử"
  retrieval_model = @{
    search_method = "hybrid_search"
    top_k = 3
    score_threshold_enabled = $false
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod "https://api.dify.ai/v1/datasets/YOUR_DATASET_ID/retrieve" `
  -Method Post -Headers $headers -Body $body -ContentType "application/json"

# 3. Kiểm thử toàn bộ pipeline chatbot n8n
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

### Cập Nhật Knowledge Base

Khi có tài liệu mới:
1. Dify Dashboard → Knowledge → Dataset của bạn
2. Nhấp `+ Add File`
3. Tải lên tệp PDF/DOCX/Markdown
4. Chờ lập chỉ mục (trạng thái: `indexing` → `completed`)
5. Kiểm thử truy xuất: Dify Dashboard → Knowledge → Dataset → Retrieval Testing
6. Nhập các truy vấn test để xác minh nội dung mới có thể truy xuất

### Điều Chỉnh Ngưỡng Định Tuyến

Để thay đổi những gì được định tuyến đến AI mạnh mẽ:
1. Mở n8n workflow → IF node (Route by Complexity)
2. Sửa ngưỡng độ dài (hiện tại 100 ký tự)
3. Thêm/xóa điều kiện từ khóa
4. Lưu và kích hoạt lại workflow

Không cần deploy lại — thay đổi có hiệu lực ngay lập tức.

---

*Tài liệu này nên được đọc cùng [N8N_IMPLEMENTATION_PLAN.md](N8N_IMPLEMENTATION_PLAN.md) và [CHATBOT_DUAL_ARCHITECTURE.md](CHATBOT_DUAL_ARCHITECTURE.md).*
