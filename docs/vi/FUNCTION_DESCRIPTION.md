# ReliefConnect — Mô Tả Chức Năng

> *Bản dịch tiếng Việt — xem bản gốc tiếng Anh tại [FUNCTION_DESCRIPTION.md](../FUNCTION_DESCRIPTION.md)*

> Tài liệu tham chiếu toàn diện về tất cả các tính năng, API endpoint và chức năng hệ thống.
>
> Phiên bản 1.0 · Ngày 08/04/2026

---

## Mục Lục

1. [Xác Thực & Quản Lý Danh Tính](#1-xác-thực--quản-lý-danh-tính)
2. [Bản Đồ Cứu Trợ Tương Tác](#2-bản-đồ-cứu-trợ-tương-tác)
3. [Mạng Xã Hội Cộng Đồng](#3-mạng-xã-hội-cộng-đồng)
4. [AI Chatbot](#4-ai-chatbot)
5. [Vận Hành Tình Nguyện Viên](#5-vận-hành-tình-nguyện-viên)
6. [Vận Hành Nhà Tài Trợ](#6-vận-hành-nhà-tài-trợ)
7. [Quản Trị Hệ Thống](#7-quản-trị-hệ-thống)
8. [Thông Báo Thời Gian Thực](#8-thông-báo-thời-gian-thực)
9. [Dịch Vụ Nền](#9-dịch-vụ-nền)
10. [Đa Ngôn Ngữ](#10-đa-ngôn-ngữ)

---

## 1. Xác Thực & Quản Lý Danh Tính

### 1.1 Đăng Ký Người Dùng
**Endpoint**: `POST /api/auth/register`
**Quyền truy cập**: Công khai

Tạo tài khoản người dùng mới và khởi tạo quy trình xác minh email.

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Username` | string | Có | Tên người dùng duy nhất |
| `Email` | string | Có | Địa chỉ email hợp lệ |
| `FullName` | string | Có | Tên hiển thị |
| `Password` | string | Có | Tối thiểu 8 ký tự, yêu cầu chữ hoa + chữ thường + chữ số |

**Luồng xử lý**:
1. Xác thực đầu vào và kiểm tra trùng lặp email/tên người dùng
2. Tạo `ApplicationUser` qua ASP.NET Core Identity
3. Tạo mã xác minh 6 chữ số (hết hạn sau 15 phút)
4. Đưa email xác minh vào hàng đợi Hangfire để gửi
5. Trả về JWT token (người dùng có thể xác thực ngay, nhưng bị giới hạn cho đến khi xác minh)

**Phản hồi**: `AuthResponseDto` chứa JWT token, ID người dùng, email, vai trò và trạng thái xác minh.

---

### 1.2 Xác Minh Email
**Endpoint**: `POST /api/auth/verify-email`
**Quyền truy cập**: Đã xác thực

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Code` | string | Có | Mã xác minh 6 chữ số từ email |

**Bảo mật**: So sánh mã bằng `CryptographicOperations.FixedTimeEquals` để ngăn tấn công timing.

---

### 1.3 Đăng Nhập
**Endpoint**: `POST /api/auth/login`
**Quyền truy cập**: Công khai (giới hạn tốc độ: 5 yêu cầu / 15 phút)

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Email` | string | Có | Email hoặc tên người dùng |
| `Password` | string | Có | Mật khẩu tài khoản |

**Tính năng bảo mật**:
- Khóa tài khoản sau 5 lần đăng nhập thất bại (cooldown 5 phút)
- Kiểm tra trạng thái tạm khóa/cấm trước khi cấp token
- JWT chứa: `sub` (userId), `email`, `role`, `jti` (ID token duy nhất)

---

### 1.4 Google OAuth
**Endpoint**: `POST /api/auth/google`
**Quyền truy cập**: Công khai

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Credential` | string | Có | JWT credential từ Google Sign-In |

**Luồng xử lý**:
1. Xác thực credential với Google Client ID đã cấu hình
2. Nếu email tồn tại → đăng nhập tài khoản hiện có
3. Nếu email mới → tạo tài khoản (tự động xác minh, mật khẩu ngẫu nhiên)
4. Trả về JWT token

---

### 1.5 Đặt Lại Mật Khẩu
**Endpoints**:
- `POST /api/auth/forgot-password` — Gửi mã đặt lại 6 chữ số đến email
- `POST /api/auth/reset-password` — Xác thực mã và đặt mật khẩu mới

---

### 1.6 Đăng Xuất
**Endpoint**: `POST /api/auth/logout`
**Quyền truy cập**: Đã xác thực

Thêm JTI của token hiện tại vào danh sách đen, vô hiệu hóa ngay lập tức. Mọi yêu cầu tiếp theo với token này đều bị từ chối.

---

### 1.7 Quản Lý Hồ Sơ
**Endpoints**:
- `GET /api/auth/profile` — Truy xuất hồ sơ người dùng hiện tại
- `PUT /api/auth/profile` — Cập nhật hồ sơ (họ tên, điện thoại, địa chỉ, URL avatar)
- `POST /api/auth/change-password` — Đổi mật khẩu (yêu cầu mật khẩu hiện tại)

---

### 1.8 Xác Minh Vai Trò
**Endpoint**: `POST /api/auth/verify-role`
**Quyền truy cập**: Đã xác thực

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `TargetRole` | enum | Có | PersonInNeed, Sponsor hoặc Volunteer |
| `PhoneNumber` | string | Có | Số điện thoại liên hệ |
| `Address` | string | Có | Địa chỉ cư trú |
| `Documents` | string | Có | Tài liệu chứng minh |

Gửi yêu cầu xác minh vào hàng đợi của quản trị viên. Trạng thái chuyển đổi: `None → Pending → Approved/Rejected`.

---

## 2. Bản Đồ Cứu Trợ Tương Tác

### 2.1 Xem Các Ping Trên Bản Đồ
**Endpoint**: `GET /api/map/pings`
**Quyền truy cập**: Công khai

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `lat` | double | Không | Vĩ độ trung tâm để tìm kiếm theo bán kính |
| `lng` | double | Không | Kinh độ trung tâm để tìm kiếm theo bán kính |
| `radiusKm` | double | Không | Bán kính tìm kiếm tính bằng km |

**Không có tọa độ**: Trả về tối đa 500 ping gần nhất.
**Có tọa độ**: Sử dụng truy vấn không gian `ST_DWithin` của PostGIS để tìm kiếm bán kính hiệu quả.

**Phản hồi**: Mảng `PingResponseDto` chứa:
- ID, tọa độ, loại (SOS/Supply/Shelter), trạng thái, chi tiết
- Thông tin người tạo, tình nguyện viên được phân công, thời gian
- Trạng thái nhấp nháy (từ PingFlags)

---

### 2.2 Tạo Ping SOS
**Endpoint**: `POST /api/map/pings`
**Quyền truy cập**: Đã xác thực

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Latitude` | double | Có | Vĩ độ GPS (được xác thực theo ranh giới Việt Nam) |
| `Longitude` | double | Có | Kinh độ GPS (được xác thực theo ranh giới Việt Nam) |
| `Type` | enum | Có | SOS, Supply hoặc Shelter |
| `Details` | string | Có | Mô tả tình huống khẩn cấp hoặc nguồn lực |

**Xác thực**: Tọa độ được kiểm tra theo bounding box lãnh thổ Việt Nam (đất liền và hải đảo).

---

### 2.3 Cập Nhật Trạng Thái Ping
**Endpoint**: `PUT /api/map/pings/{id}/status`
**Quyền truy cập**: RequireVolunteer

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Status` | enum | Có | InProgress, Resolved, VerifiedSafe |
| `CompletionNotes` | string | Không | Ghi chú về kết quả xử lý |

---

### 2.4 Xác Nhận An Toàn
**Endpoint**: `POST /api/map/pings/{id}/confirm-safe`
**Quyền truy cập**: Đã xác thực (chủ sở hữu ping)

Đánh dấu yêu cầu SOS của người dùng là an toàn, xóa cờ cảnh báo nhấp nháy.

---

### 2.5 Định Tuyến Bản Đồ
**Tính năng Frontend** (không có backend endpoint riêng)

- Sử dụng OSRM (Open Source Routing Machine) để điều hướng từng chặng
- Tính tối đa 2 tuyến đường thay thế (nhanh nhất và ngắn nhất)
- Giao diện chọn tuyến đường bằng cách nhấp trên bản đồ
- Tuyến đường hiển thị dưới dạng polyline trên bản đồ Leaflet

---

### 2.6 Quản Lý Vùng
**Endpoints**:
- `GET /api/zone` — Danh sách tất cả vùng ưu tiên (công khai)
- `POST /api/zone` — Tạo vùng (RequireAdmin)
- `PUT /api/zone/{id}` — Cập nhật vùng (RequireAdmin)
- `DELETE /api/zone/{id}` — Xóa vùng (RequireAdmin)

**Thuộc tính Vùng**:
- Tên, ranh giới GeoJSON, mức độ rủi ro (1-5)
- Hiển thị dưới dạng overlay màu trên bản đồ

---

### 2.7 Quản Lý Nguồn Cung
**Endpoints**:
- `GET /api/supply` — Danh sách vật tư/kho (công khai)
- `POST /api/supply` — Tạo mục vật tư (RequireVerified)
- `PUT /api/supply/{id}` — Cập nhật mục
- `DELETE /api/supply/{id}` — Xóa mục

---

## 3. Mạng Xã Hội Cộng Đồng

### 3.1 Bảng Tin Xã Hội
**Endpoint**: `GET /api/social/posts`
**Quyền truy cập**: Công khai

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `cursor` | string | Không | Con trỏ phân trang (theo CreatedAt) |
| `limit` | int | Không | Số bài đăng mỗi trang (mặc định: 20) |
| `category` | enum | Không | Lọc theo Livelihood, Medical, Education |
| `role` | enum | Không | Lọc theo vai trò tác giả |
| `sort` | string | Không | Tiêu chí sắp xếp |

**Hiệu năng**: Sử dụng phân trang dựa trên cursor với chỉ mục giảm dần trên `Post.CreatedAt`. Không có N+1 queries — số lượng react và bình luận được tổng hợp trước qua `GroupBy`.

---

### 3.2 Tạo Bài Đăng
**Endpoint**: `POST /api/social/posts`
**Quyền truy cập**: Đã xác thực

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Content` | string | Có | Nội dung bài đăng (được làm sạch HTML trước khi lưu) |
| `Category` | enum | Có | Livelihood (0), Medical (1) hoặc Education (2) |
| `ImageUrl` | string | Không | URL hình ảnh đã tải lên |

---

### 3.3 Tải Lên Hình Ảnh
**Endpoint**: `POST /api/social/upload-image`
**Quyền truy cập**: Đã xác thực

Chấp nhận dữ liệu multipart form với một tệp hình ảnh. Xác thực MIME type (JPEG/PNG/WebP) và kích thước tệp (tối đa 5 MB). Trả về URL hình ảnh đã lưu.

---

### 3.4 Biểu Cảm (Reactions)
**Endpoint**: `POST /api/social/posts/{postId}/reactions`
**Quyền truy cập**: Đã xác thực

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Type` | enum | Có | Like (0), Love (1) hoặc Pray (2) |

**Hành vi toggle**: Gửi cùng loại biểu cảm sẽ xóa nó. Gửi loại khác sẽ thay thế biểu cảm hiện có.

---

### 3.5 Bình Luận
**Endpoints**:
- `GET /api/social/posts/{postId}/comments` — Danh sách bình luận theo cursor
- `POST /api/social/posts/{postId}/comments` — Thêm bình luận (được làm sạch HTML)

---

### 3.6 Báo Cáo Bài Đăng
Người dùng có thể báo cáo các bài đăng vi phạm chính sách nền tảng. Báo cáo vào hàng đợi kiểm duyệt của quản trị viên.

---

### 3.7 Tường Cá Nhân
**Endpoint**: `GET /api/social/users/{userId}/wall`
**Quyền truy cập**: Công khai

Trả về dòng thời gian bài đăng của một người dùng cụ thể với cùng phân trang cursor như bảng tin chính.

---

## 4. AI Chatbot

### 4.1 Tạo Cuộc Trò Chuyện
**Endpoint**: `POST /api/chatbot/conversations`
**Quyền truy cập**: Đã xác thực

Tạo phiên trò chuyện chatbot mới. Trả về ID cuộc trò chuyện.

---

### 4.2 Gửi Tin Nhắn
**Endpoint**: `POST /api/chatbot/conversations/{conversationId}/messages`
**Quyền truy cập**: Đã xác thực (giới hạn tốc độ: 30 / 5 phút)

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `Content` | string | Có | Nội dung tin nhắn của người dùng |
| `ImageBase64` | string | Không | Dữ liệu hình ảnh mã hóa base64 |
| `ImageMimeType` | string | Không | MIME type (image/jpeg, image/png, image/webp) |

**Luồng Xử Lý**:
1. Xác thực các trường hình ảnh (cả hai cùng tồn tại hoặc cùng vắng mặt)
2. Nếu có hình ảnh: xác thực khả năng giải mã base64 và giới hạn nhị phân 4 MB
3. Xác minh quyền sở hữu cuộc trò chuyện
4. Lưu tin nhắn người dùng vào cơ sở dữ liệu (ngăn kết nối rảnh rỗi trong khi gọi AI)
5. Lấy 20 tin nhắn gần nhất làm ngữ cảnh cuộc trò chuyện
6. Gọi nhà cung cấp AI (n8n workflow ưu tiên, Gemini API dự phòng)
7. Lưu phản hồi bot với cờ cảnh báo an toàn
8. Trả về `MessageResponseDto`

**Phản hồi**:

| Trường | Kiểu | Mô Tả |
|--------|------|--------|
| `Id` | int | ID tin nhắn trong cơ sở dữ liệu |
| `Content` | string | Văn bản phản hồi do AI tạo ra |
| `IsBotMessage` | bool | Luôn là `true` cho phản hồi của bot |
| `HasSafetyWarning` | bool | `true` nếu phát hiện từ khóa khẩn cấp |
| `SentAt` | DateTime | Thời gian UTC |

---

### 4.3 Lấy Tin Nhắn Trong Cuộc Trò Chuyện
**Endpoint**: `GET /api/chatbot/conversations/{conversationId}/messages`
**Quyền truy cập**: Đã xác thực (chỉ chủ sở hữu cuộc trò chuyện)

Trả về tất cả tin nhắn theo thứ tự thời gian.

---

### 4.4 Chi Tiết Nhà Cung Cấp AI

**System Prompt** (tiếng Việt):
> "Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam. Nhiệm vụ: giúp người dùng tìm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, trả lời câu hỏi về tình hình thiên tai. Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt. Nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh. Không trả lời các nội dung nhạy cảm, chính trị, vi phạm pháp luật."

**Cài Đặt An Toàn**: Bốn danh mục nội dung có hại của Gemini đều bị chặn ở mức `BLOCK_MEDIUM_AND_ABOVE`.

**Cấu Hình Tạo Nội Dung**: `maxOutputTokens: 1024`, `temperature: 0.7`

**Từ Khóa Khẩn Cấp** (kích hoạt cảnh báo an toàn):
- Tiếng Việt: đau tim, ngộ độc, chảy máu, ngừng thở, tai nạn, cấp cứu
- Tiếng Anh: heart attack, poisoning, bleeding, emergency, stopped breathing, accident

**Pool API Key**: Nhiều API key Gemini được lưu trong cơ sở dữ liệu, key được sử dụng ít nhất sẽ được chọn cho mỗi yêu cầu. Tự động dự phòng về key trong tệp cấu hình khi pool trống.

---

### 4.5 Kiến Trúc Nhà Cung Cấp Kép (Đã Lên Kế Hoạch)

| Nhà Cung Cấp | Ưu Tiên | Trường Hợp Sử Dụng |
|-------------|---------|-------------------|
| **n8n Workflow** | Chính (khi kết nối) | Workflow nâng cao, RAG, suy luận nhiều bước, logic nghiệp vụ tùy chỉnh |
| **Gemini API Trực Tiếp** | Dự phòng | Hỏi đáp đơn giản khi n8n không khả dụng |

Xem [CHATBOT_DUAL_ARCHITECTURE.md](../CHATBOT_DUAL_ARCHITECTURE.md) để biết chi tiết triển khai.

---

## 5. Vận Hành Tình Nguyện Viên

### 5.1 Duyệt Các Nhiệm Vụ Khả Dụng
**Endpoint**: `GET /api/volunteer/tasks`
**Quyền truy cập**: RequireVolunteer

Trả về các ping SOS có trạng thái `Pending`, sắp xếp theo khoảng cách gần nhất với vị trí của tình nguyện viên (tính toán bounding box).

---

### 5.2 Nhận Nhiệm Vụ
**Endpoint**: `POST /api/volunteer/accept-task`
**Quyền truy cập**: RequireVolunteer

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `PingId` | int | Có | ID của ping SOS nhận xử lý |

Cập nhật trạng thái ping thành `InProgress` và phân công tình nguyện viên.

---

### 5.3 Xem Nhiệm Vụ Đang Thực Hiện
**Endpoint**: `GET /api/volunteer/active-tasks`
**Quyền truy cập**: RequireVolunteer

Trả về tất cả ping hiện đang được phân công cho tình nguyện viên đã xác thực với trạng thái `InProgress`.

---

## 6. Vận Hành Nhà Tài Trợ

### 6.1 Tìm Kiếm Trường Hợp Cần Hỗ Trợ
**Endpoint**: `GET /api/sponsor/cases`
**Quyền truy cập**: RequireSponsor

Tìm kiếm trong cả ping SOS (theo trạng thái) và bài đăng xã hội (theo danh mục) để tìm những cá nhân cần nhà tài trợ.

---

### 6.2 Đề Xuất Hỗ Trợ
**Endpoint**: `POST /api/sponsor/offer-help`
**Quyền truy cập**: RequireSponsor

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|--------|
| `TargetUserId` | string | Có | Người dùng được đề xuất hỗ trợ |
| `PingId` | int | Không | Ping SOS liên quan |
| `PostId` | int | Không | Bài đăng xã hội liên quan |
| `Message` | string | Có | Mô tả hỗ trợ được đề xuất |

Tạo thông báo cho người dùng mục tiêu.

---

## 7. Quản Trị Hệ Thống

### 7.1 Quản Lý Người Dùng

| Endpoint | Phương Thức | Mô Tả |
|----------|------------|--------|
| `/api/admin/users` | GET | Danh sách người dùng phân trang (tìm kiếm, lọc theo vai trò, xác minh) |
| `/api/admin/users/{id}` | GET | Chi tiết người dùng với số lượng hoạt động |
| `/api/admin/users/{id}/role` | PUT | Phê duyệt thay đổi vai trò |
| `/api/admin/verifications` | GET | Hàng đợi xác minh đang chờ xử lý |
| `/api/admin/verifications/{id}/reject` | POST | Từ chối kèm lý do |
| `/api/admin/users/{id}/suspend` | POST | Tạm khóa (có hạn) |
| `/api/admin/users/{id}/unsuspend` | POST | Gỡ tạm khóa |
| `/api/admin/users/{id}/ban` | POST | Cấm vĩnh viễn |
| `/api/admin/users/{id}/force-logout` | POST | Vô hiệu hóa tất cả phiên |
| `/api/admin/users/{id}/reset-verification` | POST | Đặt lại để gửi lại |
| `/api/admin/batch` | POST | Thao tác hàng loạt nguyên tử |

---

### 7.2 Kiểm Duyệt Nội Dung

| Endpoint | Phương Thức | Mô Tả |
|----------|------------|--------|
| `/api/admin/moderation/posts` | GET | Danh sách tất cả bài đăng (phân trang) |
| `/api/admin/moderation/posts/{id}/pin` | POST | Ghim lên đầu bảng tin |
| `/api/admin/moderation/posts/{id}` | DELETE | Xóa cứng bài đăng |
| `/api/admin/moderation/posts/{postId}/comments/{commentId}` | DELETE | Xóa bình luận |
| `/api/admin/moderation/reports` | GET | Danh sách báo cáo (lọc theo trạng thái) |
| `/api/admin/moderation/reports/{id}/review` | POST | Đánh dấu báo cáo đã xem xét |
| `/api/admin/moderation/reports/{id}/dismiss` | POST | Bác bỏ báo cáo |

---

### 7.3 Vận Hành Hệ Thống

| Endpoint | Phương Thức | Mô Tả |
|----------|------------|--------|
| `/api/admin/system/stats` | GET | Thống kê dashboard (cache 5 phút) |
| `/api/admin/system/logs` | GET | Nhật ký kiểm toán (phân trang) |
| `/api/admin/system/logs/{id}/children` | GET | Nhật ký con cho thao tác hàng loạt |
| `/api/admin/system/announcements` | GET/POST | Danh sách/tạo thông báo |
| `/api/admin/system/announcements/{id}` | PUT/DELETE | Cập nhật/xóa thông báo |
| `/api/admin/system/export/users` | GET | Xuất CSV danh sách người dùng (giới hạn 10K) |
| `/api/admin/system/export/logs` | GET | Xuất CSV nhật ký kiểm toán |
| `/api/admin/system/sos/{id}/force-resolve` | POST | Quản trị viên buộc giải quyết SOS |

---

### 7.4 Tab Dashboard Quản Trị Viên (Frontend)

| Tab | Chức Năng |
|-----|----------|
| **Thống Kê** | Số lượng người dùng theo vai trò, thống kê trạng thái SOS, số lượng nội dung |
| **Xác Minh** | Xem xét yêu cầu xác minh vai trò đang chờ xử lý |
| **Người Dùng** | Tìm kiếm, lọc, quản lý người dùng (tạm khóa/cấm/thay đổi vai trò) |
| **Bài Đăng** | Kiểm duyệt nội dung, ghim/xóa bài đăng |
| **Báo Cáo** | Hàng đợi báo cáo từ cộng đồng |
| **Nhật Ký** | Dấu vết kiểm toán có thể mở rộng cho thao tác hàng loạt |
| **Thông Báo** | Tạo/quản lý thông báo hệ thống |
| **Vùng** | Quản lý vùng ưu tiên (tạo/chỉnh sửa/xóa với GeoJSON) |
| **Nguồn Cung** | Quản lý vật tư và vị trí kho |
| **API Keys** | Quản lý pool API key Gemini (thêm/vô hiệu hóa/theo dõi sử dụng) |

---

## 8. Thông Báo Thời Gian Thực

### 8.1 SignalR Hub
**URL**: `/hubs/sos-alerts`
**Xác Thực**: JWT token qua tham số query `?access_token=`

### 8.2 Phương Thức (Client → Server)

| Phương Thức | Mô Tả |
|------------|--------|
| `JoinSOSAlertGroup()` | Đăng ký nhận cảnh báo SOS thời gian thực |
| `LeaveSOSAlertGroup()` | Hủy đăng ký nhận cảnh báo |

### 8.3 Sự Kiện (Server → Client)

| Sự Kiện | Dữ Liệu | Kích Hoạt Khi |
|---------|---------|--------------|
| `ReceiveSOSAlert` | `{ PingId, Lat, Lng, Timestamp }` | Ping SOS chưa được xác nhận > 15 phút |
| `SOSAlertResolved` | `{ PingId, Timestamp }` | Ping SOS đã giải quyết hoặc xác nhận an toàn |

---

## 9. Dịch Vụ Nền

### 9.1 PingFlagMonitorService
**Lịch trình**: Mỗi 5 phút
**Mục đích**: Phát hiện các ping SOS chưa được xác nhận trong hơn 15 phút

**Quy trình**:
1. Truy vấn tất cả ping `Pending` cũ hơn 15 phút
2. Tạo hoặc cập nhật bản ghi `PingFlag` với `IsBlinking = true`
3. Phát sóng `ReceiveSOSAlert` qua SignalR đến tất cả tình nguyện viên đang kết nối
4. Xử lý tái kết nối cơ sở dữ liệu (Npgsql `ObjectDisposedException`) với logic thử lại

### 9.2 Hangfire Background Jobs
**Lưu trữ**: Trong bộ nhớ (không persistent qua các lần khởi động)
**Sử dụng cho**:
- Gửi mã xác minh email
- Gửi mã đặt lại mật khẩu
- Gửi thông báo

---

## 10. Đa Ngôn Ngữ

### 10.1 Ngôn Ngữ Được Hỗ Trợ
- **Tiếng Việt** (`vi`) — Ngôn ngữ chính
- **Tiếng Anh** (`en`) — Ngôn ngữ phụ

### 10.2 Triển Khai
- Frontend: React Context (`LanguageContext`) với hook `useLanguage()`
- Tệp dịch: `client/src/i18n/en.json` và `vi.json`
- Namespace chính: `common`, `auth`, `sidebar`, `ping`, `social`, `chat`, `admin`, `profile`

### 10.3 Ngôn Ngữ AI Chatbot
System prompt hướng dẫn AI:
- Mặc định phản hồi bằng tiếng Việt
- Phát hiện đầu vào tiếng Anh và phản hồi bằng tiếng Anh
- Từ khóa khẩn cấp được định nghĩa bằng cả hai ngôn ngữ

---

*Tài liệu này phản ánh codebase ReliefConnect tính đến ngày 08/04/2026.*
