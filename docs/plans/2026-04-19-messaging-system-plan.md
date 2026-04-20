# Plan: Hệ thống nhắn tin trực tiếp (Direct Messaging)

**Ngày lập:** 2026-04-19  
**Trạng thái:** Draft  
**Ước lượng:** ~8 tracks con

---

## Tổng quan

Cho phép người dùng nhắn tin trực tiếp cho nhau (1-to-1) với:
- Real-time delivery qua SignalR (tránh miss tin nhắn)
- Badge đỏ thông báo tin nhắn mới
- Tìm kiếm người dùng bằng tên/SĐT
- Log tin nhắn server-side, tự động xoá sau 30 ngày
- Profile thêm link Facebook/Telegram
- Hiển thị social links trong SOS ping detail (Volunteer/Sponsor/Admin)
- Click user trong Community để xem thông tin và nhắn tin

---

## Track A — Database Schema & SQL Migration

Chạy migration SQL này trên Supabase SQL Editor hoặc qua EF Core:

```sql
-- ============================================================================
-- DIRECT MESSAGING SYSTEM - UNIFIED MIGRATION
-- Ngày: 2026-04-19
-- Tác dụng: Tạo schema cho hệ thống nhắn tin trực tiếp (1-to-1)
-- ============================================================================

-- Step 1: Thêm cột vào ApplicationUser
-- ============================================================================
ALTER TABLE "AspNetUsers"
  ADD COLUMN IF NOT EXISTS "FacebookUrl" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "TelegramUrl" TEXT NULL;

-- Step 2: Tạo bảng DirectConversations (tách riêng khỏi Conversations chatbot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "DirectConversations" (
  "Id"              SERIAL PRIMARY KEY,
  "User1Id"         TEXT NOT NULL REFERENCES "AspNetUsers"("Id") ON DELETE CASCADE,
  "User2Id"         TEXT NOT NULL REFERENCES "AspNetUsers"("Id") ON DELETE CASCADE,
  "CreatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "LastMessageAt"   TIMESTAMPTZ NULL,

  -- UNIQUE constraint: đảm bảo chỉ 1 conversation giữa 2 user (order-independent)
  CONSTRAINT "UQ_DirectConversation_Pair" UNIQUE (
    LEAST("User1Id", "User2Id"),
    GREATEST("User1Id", "User2Id")
  )
);

CREATE INDEX IF NOT EXISTS "IX_DirectConversation_User1" ON "DirectConversations" ("User1Id");
CREATE INDEX IF NOT EXISTS "IX_DirectConversation_User2" ON "DirectConversations" ("User2Id");
CREATE INDEX IF NOT EXISTS "IX_DirectConversation_LastMsg" ON "DirectConversations" ("LastMessageAt" DESC NULLS LAST);

-- Step 3: Tạo bảng DirectMessages
-- ============================================================================
CREATE TABLE IF NOT EXISTS "DirectMessages" (
  "Id"               SERIAL PRIMARY KEY,
  "ConversationId"   INT NOT NULL REFERENCES "DirectConversations"("Id") ON DELETE CASCADE,
  "SenderId"         TEXT NOT NULL REFERENCES "AspNetUsers"("Id") ON DELETE CASCADE,
  "Content"          TEXT NOT NULL,
  "SentAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "IsRead"           BOOLEAN NOT NULL DEFAULT FALSE,
  "DeletedAt"        TIMESTAMPTZ NULL  -- Soft-delete trước khi hard-delete
);

CREATE INDEX IF NOT EXISTS "IX_DirectMessage_Conv_Sent" ON "DirectMessages" ("ConversationId", "SentAt" DESC);
CREATE INDEX IF NOT EXISTS "IX_DirectMessage_Sender" ON "DirectMessages" ("SenderId");
CREATE INDEX IF NOT EXISTS "IX_DirectMessage_Unread" ON "DirectMessages" ("ConversationId", "IsRead") WHERE "IsRead" = FALSE;
CREATE INDEX IF NOT EXISTS "IX_DirectMessage_DeleteAt" ON "DirectMessages" ("SentAt") WHERE "DeletedAt" IS NULL;

-- Step 4: SQL Function - Tìm hoặc tạo conversation (tránh race condition)
-- ============================================================================
CREATE OR REPLACE FUNCTION find_or_create_direct_conversation(
  p_user1_id TEXT,
  p_user2_id TEXT
)
RETURNS INT AS $$
DECLARE
  v_conv_id INT;
  v_min_id TEXT := LEAST(p_user1_id, p_user2_id);
  v_max_id TEXT := GREATEST(p_user1_id, p_user2_id);
BEGIN
  -- Tìm conversation hiện tại
  SELECT "Id" INTO v_conv_id
  FROM "DirectConversations"
  WHERE LEAST("User1Id", "User2Id") = v_min_id
    AND GREATEST("User1Id", "User2Id") = v_max_id;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Tạo mới với ON CONFLICT để tránh race condition khi 2 user cùng lúc
  INSERT INTO "DirectConversations" ("User1Id", "User2Id", "CreatedAt")
  VALUES (v_min_id, v_max_id, NOW())
  ON CONFLICT ON CONSTRAINT "UQ_DirectConversation_Pair"
  DO NOTHING
  RETURNING "Id" INTO v_conv_id;

  -- Nếu ON CONFLICT xảy ra (v_conv_id = NULL), SELECT lại
  IF v_conv_id IS NULL THEN
    SELECT "Id" INTO v_conv_id
    FROM "DirectConversations"
    WHERE LEAST("User1Id", "User2Id") = v_min_id
      AND GREATEST("User1Id", "User2Id") = v_max_id;
  END IF;

  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: SQL Function - Gửi tin nhắn + cập nhật LastMessageAt (atomic)
-- ============================================================================
CREATE OR REPLACE FUNCTION send_direct_message(
  p_conversation_id INT,
  p_sender_id TEXT,
  p_content TEXT
)
RETURNS TABLE(
  message_id INT,
  sent_at TIMESTAMPTZ
) AS $$
DECLARE
  v_msg_id INT;
  v_sent TIMESTAMPTZ := NOW();
BEGIN
  -- Kiểm tra sender có trong conversation không
  IF NOT EXISTS (
    SELECT 1 FROM "DirectConversations"
    WHERE "Id" = p_conversation_id
      AND ("User1Id" = p_sender_id OR "User2Id" = p_sender_id)
  ) THEN
    RAISE EXCEPTION 'User is not a participant of this conversation';
  END IF;

  -- Insert message
  INSERT INTO "DirectMessages" ("ConversationId", "SenderId", "Content", "SentAt", "IsRead")
  VALUES (p_conversation_id, p_sender_id, p_content, v_sent, FALSE)
  RETURNING "Id" INTO v_msg_id;

  -- Cập nhật LastMessageAt trên conversation
  UPDATE "DirectConversations"
  SET "LastMessageAt" = v_sent
  WHERE "Id" = p_conversation_id;

  RETURN QUERY SELECT v_msg_id, v_sent;
END;
$$ LANGUAGE plpgsql;

-- Step 6: SQL Function - Đánh dấu đã đọc (batch)
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_conversation_id INT,
  p_reader_id TEXT
)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE "DirectMessages"
  SET "IsRead" = TRUE
  WHERE "ConversationId" = p_conversation_id
    AND "SenderId" != p_reader_id
    AND "IsRead" = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Step 7: SQL Function - Đếm tin nhắn chưa đọc (cho badge)
-- ============================================================================
CREATE OR REPLACE FUNCTION count_unread_messages(p_user_id TEXT)
RETURNS TABLE(
  conversation_id INT,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT dm."ConversationId", COUNT(*)::BIGINT
  FROM "DirectMessages" dm
  JOIN "DirectConversations" dc ON dc."Id" = dm."ConversationId"
  WHERE (dc."User1Id" = p_user_id OR dc."User2Id" = p_user_id)
    AND dm."SenderId" != p_user_id
    AND dm."IsRead" = FALSE
    AND dm."DeletedAt" IS NULL
  GROUP BY dm."ConversationId";
END;
$$ LANGUAGE plpgsql;

-- Step 8: SQL Function - Xoá tin nhắn > 30 ngày (chạy hàng ngày)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_direct_messages()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM "DirectMessages"
  WHERE "SentAt" < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log kết quả vào SystemLogs
  INSERT INTO "SystemLogs" ("Action", "Detail", "Timestamp", "UserId")
  VALUES (
    'MessageCleanup',
    format('Deleted %s messages older than 30 days', v_count),
    NOW(),
    'system'
  );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
```

**Cách chạy:**

1. **Supabase SQL Editor**: Copy-paste toàn bộ script trên vào SQL editor → Execute
2. **EF Core**: Tạo file migration bằng CLI hoặc tham khảo Track B để map entities

---

## Track B — Backend Entities & EF Core

### B1. Entities mới

```
src/ReliefConnect.Core/Entities/DirectConversation.cs
src/ReliefConnect.Core/Entities/DirectMessage.cs
```

**DirectConversation.cs:**
```csharp
public class DirectConversation
{
    public int Id { get; set; }
    public string User1Id { get; set; } = string.Empty;
    public ApplicationUser User1 { get; set; } = null!;
    public string User2Id { get; set; } = string.Empty;
    public ApplicationUser User2 { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastMessageAt { get; set; }
    public ICollection<DirectMessage> Messages { get; set; } = new List<DirectMessage>();
}
```

**DirectMessage.cs:**
```csharp
public class DirectMessage
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public DirectConversation Conversation { get; set; } = null!;
    public string SenderId { get; set; } = string.Empty;
    public ApplicationUser Sender { get; set; } = null!;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
}
```

### B2. Cập nhật `ApplicationUser.cs`

```csharp
public string? FacebookUrl { get; set; }
public string? TelegramUrl { get; set; }

// Navigation
public ICollection<DirectConversation> DirectConversationsAsUser1 { get; set; } = new List<DirectConversation>();
public ICollection<DirectConversation> DirectConversationsAsUser2 { get; set; } = new List<DirectConversation>();
```

### B3. Cập nhật `AppDbContext.cs`

- Thêm `DbSet<DirectConversation>` và `DbSet<DirectMessage>`
- OnModelCreating: Unique constraint (LEAST/GREATEST workaround bằng computed column hoặc HasAlternateKey)
- Index trên `(ConversationId, SentAt DESC)`, `SenderId`, `IsRead`

### B4. EF Core Migration

```bash
dotnet ef migrations add AddDirectMessaging --project ../ReliefConnect.Infrastructure --startup-project .
dotnet ef database update --project ../ReliefConnect.Infrastructure --startup-project .
```

---

## Track C — SignalR Hub (Real-time)

### C1. Tạo `DirectMessageHub.cs`

```
src/ReliefConnect.API/Hubs/DirectMessageHub.cs
```

**Thiết kế chống miss tin nhắn:**

```csharp
[Authorize]
public class DirectMessageHub : Hub
{
    // Mỗi user join group = userId khi connect
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User!.FindFirst("sub")?.Value 
                     ?? Context.User!.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User!.FindFirst("sub")?.Value
                     ?? Context.User!.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
        await base.OnDisconnectedAsync(exception);
    }
}
```

**Cơ chế chống miss tin nhắn:**

1. **Khi gửi tin nhắn:** Controller lưu DB trước → rồi mới broadcast qua SignalR. Nếu broadcast fail, tin nhắn vẫn lưu trong DB.
2. **Khi user connect lại:** Frontend gọi API `GET /api/messages/unread` để sync tin nhắn miss.
3. **Mark-as-read:** Frontend gửi API khi user mở conversation, không qua SignalR (đảm bảo persist).

**Server-side broadcast (gọi từ Controller):**

```csharp
// Sau khi lưu tin nhắn vào DB thành công
await _hubContext.Clients.Group($"user_{receiverId}")
    .SendAsync("ReceiveDirectMessage", new {
        messageId,
        conversationId,
        senderId,
        senderName,
        senderAvatar,
        content,
        sentAt
    });

// Broadcast badge update
await _hubContext.Clients.Group($"user_{receiverId}")
    .SendAsync("UnreadCountChanged", new {
        conversationId,
        totalUnread
    });
```

### C2. Đăng ký Hub trong `Program.cs`

```csharp
app.MapHub<DirectMessageHub>("/hubs/direct-messages");
```

---

## Track D — Backend API Controller

### D1. `MessageController.cs`

```
src/ReliefConnect.API/Controllers/MessageController.cs
Route: api/messages
Auth: [Authorize(Policy = "RequireVerified")]
```

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `GET` | `/conversations` | Danh sách conversations (sorted by LastMessageAt DESC), kèm last message preview + unread count |
| `GET` | `/conversations/{id}/messages?before={cursor}&limit=30` | Load messages (cursor-based pagination, mới nhất trước) |
| `POST` | `/conversations` | Tạo/tìm conversation `{ targetUserId }` → gọi SQL function `find_or_create_direct_conversation` |
| `POST` | `/conversations/{id}/messages` | Gửi tin nhắn `{ content }` → gọi SQL function `send_direct_message` → broadcast SignalR |
| `PUT` | `/conversations/{id}/read` | Đánh dấu đã đọc → gọi SQL function `mark_messages_read` |
| `GET` | `/unread-count` | Tổng số tin nhắn chưa đọc (cho badge tổng) |
| `GET` | `/search-users?q={query}` | Tìm user bằng tên hoặc SĐT (chỉ trả về Volunteer/Sponsor/Admin, verified) |

### D2. DTOs mới

```csharp
// Request
public record StartConversationDto(string TargetUserId);
public record SendDirectMessageDto(
    [StringLength(2000)] string Content
);

// Response
public record DirectConversationDto(
    int Id,
    string PartnerId,
    string PartnerName,
    string? PartnerAvatar,
    string? LastMessage,
    DateTime? LastMessageAt,
    int UnreadCount
);

public record DirectMessageDto(
    int Id,
    string SenderId,
    string SenderName,
    string Content,
    DateTime SentAt,
    bool IsRead,
    bool IsMine
);

public record SearchUserDto(
    string Id,
    string FullName,
    string? AvatarUrl,
    string Role
);
```

### D3. Validation & Security

- HtmlSanitizer trên message content (chống XSS)
- Rate limit: 30 messages/phút/user (chống spam)
- Block nếu sender hoặc receiver bị suspended
- Chỉ Volunteer/Sponsor/Admin mới có thể nhận tin nhắn (PersonInNeed không nhắn được cho PersonInNeed)
- Content length: max 2000 ký tự

### D4. Logging

Mỗi tin nhắn gửi → insert `SystemLog`:

```csharp
Action = "DirectMessage"
Detail = $"User {senderId} → {receiverId} in conv {convId}"
```

---

## Track E — Background Service: Message Cleanup

### E1. `MessageCleanupService.cs`

```
src/ReliefConnect.API/BackgroundServices/MessageCleanupService.cs
```

- Chạy hàng ngày (hoặc đăng ký Hangfire recurring job)
- Gọi SQL function `cleanup_old_direct_messages()`
- Log kết quả vào SystemLogs

```csharp
// Đăng ký trong Program.cs
RecurringJob.AddOrUpdate<MessageCleanupJob>(
    "cleanup-old-direct-messages",
    job => job.Execute(),
    Cron.Daily(3, 0) // 3:00 AM UTC
);
```

---

## Track F — Cập nhật Profile & Admin

### F1. `UpdateProfileDto` — thêm fields

```csharp
public string? FacebookUrl { get; set; }  // validate URL format
public string? TelegramUrl { get; set; }  // validate URL format hoặc @username
```

### F2. `AdminUserDto` / `AdminUserDetailDto` — thêm fields

```csharp
public string? FacebookUrl { get; set; }
public string? TelegramUrl { get; set; }
```

### F3. `PingResponseDto` — thêm social links (conditional)

Chỉ trả về FacebookUrl/TelegramUrl nếu:
- Viewer role ∈ {Volunteer, Sponsor, Admin}
- Ping creator có set các field này

### F4. Frontend: ProfilePanel, AdminPage cập nhật hiển thị

---

## Track G — Frontend: Messaging Panel

### G1. Zustand Store: `messageStore.ts`

```typescript
interface MessageStore {
  conversations: DirectConversationDto[];
  activeConversationId: number | null;
  messages: Map<number, DirectMessageDto[]>;
  totalUnread: number;

  // Actions
  loadConversations(): Promise<void>;
  loadMessages(convId: number, before?: string): Promise<void>;
  sendMessage(convId: number, content: string): Promise<void>;
  markRead(convId: number): Promise<void>;
  startConversation(targetUserId: string): Promise<number>;
  searchUsers(query: string): Promise<SearchUserDto[]>;
  
  // Real-time
  handleNewMessage(msg: DirectMessageDto): void;
  handleUnreadUpdate(data: { conversationId: number; totalUnread: number }): void;
}
```

### G2. SignalR Connection

Kết nối khi user authenticated, tách riêng từ SOS alert connection:

```typescript
// services/directMessageSignalR.ts
const connection = new HubConnectionBuilder()
  .withUrl('/hubs/direct-messages', {
    accessTokenFactory: () => authStore.getState().token!,
  })
  .withAutomaticReconnect([0, 1000, 5000, 10000, 30000])
  .build();

// Khi reconnect: sync unread count + load new messages
connection.onreconnected(() => {
  messageStore.getState().loadConversations();
});

connection.on('ReceiveDirectMessage', (msg) => {
  messageStore.getState().handleNewMessage(msg);
});

connection.on('UnreadCountChanged', (data) => {
  messageStore.getState().handleUnreadUpdate(data);
});
```

### G3. Component: `MessagingPanel.tsx`

```
client/src/components/panels/MessagingPanel.tsx
```

Layout (trong panel container bên trái, giống ChatPanel):

```
┌──────────────────────────────────┐
│  💬 Tin nhắn          [Search 🔍]│
│──────────────────────────────────│
│ ⚠️ Tin nhắn sẽ bị xoá sau 30   │
│    ngày để tránh quá tải DB.    │
│──────────────────────────────────│
│ 🔍 Tìm người dùng...            │  ← Search bar
│──────────────────────────────────│
│ [Avatar] Nguyễn Văn A      2m   │  ← Conversation list
│          Cảm ơn bạn đã...  🔴   │     (🔴 = unread badge)
│ [Avatar] Trần Thị B       1h    │
│          Tôi có thể giúp...     │
│──────────────────────────────────│
│                                  │
│  (Nhấn vào để xem tin nhắn)     │
│                                  │
└──────────────────────────────────┘
```

Khi click vào 1 conversation:

```
┌──────────────────────────────────┐
│ ← Quay lại   Nguyễn Văn A   ℹ️  │
│──────────────────────────────────│
│                                  │
│         [Tin nhắn cũ hơn ↑]     │
│                                  │
│  Xin chào, tôi cần hỗ trợ      │  ← Other user
│                     14:30       │
│                                  │
│       Tôi sẽ đến ngay 🙂        │  ← Current user
│                     14:32       │
│                                  │
│──────────────────────────────────│
│ [Nhập tin nhắn...      ] [Gửi]  │
└──────────────────────────────────┘
```

### G4. Sidebar: Thêm nút Messaging

```
client/src/components/layout/Sidebar.tsx
```

- Icon: `MessageCircle` từ lucide-react
- Badge đỏ nhỏ khi `totalUnread > 0`
- Hiện cho tất cả verified users
- i18n key: `sidebar.messages`

### G5. Component: `UserProfileCard.tsx`

Modal/popup khi click vào user trong SocialPanel:

```
┌────────────────────────────┐
│   [Avatar lớn]             │
│   Nguyễn Văn A             │
│   🏷️ Volunteer             │
│                            │
│   📧 email@...             │
│   📱 0123456789            │
│   🔗 facebook.com/...     │
│   ✈️ @telegram_user        │
│                            │
│  [💬 Nhắn tin]  [✕ Đóng]  │
└────────────────────────────┘
```

- Chỉ hiện cho Volunteer, Sponsor, Admin
- Nút "Nhắn tin" → mở MessagingPanel + startConversation(userId)

### G6. SocialPanel: Click user → UserProfileCard

Thêm `onClick` handler trên user avatar/name trong post headers.

### G7. PingDetailPanel: Hiển thị social links

Thêm Facebook/Telegram links trong phần contact info:

```tsx
{canViewSensitiveContact && ping.creatorFacebookUrl && (
  <a href={ping.creatorFacebookUrl} target="_blank" className="ping-contact-item">
    <Facebook size={13} /> Facebook
  </a>
)}
{canViewSensitiveContact && ping.creatorTelegramUrl && (
  <a href={ping.creatorTelegramUrl} target="_blank" className="ping-contact-item">
    <Send size={13} /> Telegram
  </a>
)}
```

---

## Track H — i18n

Thêm translations cho cả `vi` và `en`:

```json
{
  "sidebar.messages": "Tin nhắn",
  "messaging.title": "Tin nhắn",
  "messaging.search": "Tìm người dùng...",
  "messaging.retention": "Tin nhắn sẽ tự động xoá sau 30 ngày để tránh quá tải hệ thống.",
  "messaging.empty": "Chưa có cuộc trò chuyện nào",
  "messaging.inputPlaceholder": "Nhập tin nhắn...",
  "messaging.send": "Gửi",
  "messaging.back": "Quay lại",
  "messaging.noResults": "Không tìm thấy người dùng",
  "messaging.blocked": "Tài khoản đã bị khoá",
  "messaging.onlyVerified": "Chỉ người dùng đã xác minh mới nhắn tin được",
  "profile.facebookUrl": "Link Facebook",
  "profile.telegramUrl": "Link Telegram",
  "userProfile.sendMessage": "Nhắn tin"
}
```

---

## Thứ tự triển khai (Recommended Order)

| # | Track | Phụ thuộc | Ước lượng |
|---|-------|-----------|-----------|
| 1 | **A** — DB Schema + SQL Functions | Không | Chạy migration SQL |
| 2 | **B** — Backend Entities + EF Core | Track A | Entities, DbContext, migration |
| 3 | **F** — Profile + Admin (Facebook/Telegram) | Track B | Nhỏ, độc lập |
| 4 | **C** — SignalR Hub | Track B | Hub + Program.cs registration |
| 5 | **D** — API Controller | Track B, C | MessageController + DTOs |
| 6 | **E** — Background Cleanup | Track B | Hangfire job |
| 7 | **H** — i18n | Không | Translation keys |
| 8 | **G** — Frontend Panels | Track D, H | MessagingPanel, UserProfileCard, Sidebar, SocialPanel, PingDetailPanel |

---

## Cơ chế xử lý bất đồng bộ (Anti-miss design)

```
                    ┌─────────────┐
                    │  User A gửi │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ POST /api/  │ ← HTTP request
                    │ messages    │
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │ 1. INSERT vào DB        │ ← Tin nhắn LUÔN được lưu
              │    (SQL function atomic)│
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │ 2. Broadcast SignalR    │ ← Best-effort delivery
              │    tới group user_B    │
              └────────────┬────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
    │ User B      │  │ User B  │  │ User B      │
    │ ONLINE      │  │ OFFLINE │  │ RECONNECTING│
    │ → Nhận ngay │  │ → Lưu   │  │ → Auto sync │
    │   via WS    │  │   trong │  │   khi kết   │
    │             │  │   DB    │  │   nối lại   │
    └─────────────┘  └─────────┘  └─────────────┘
```

**Key guarantees:**
1. **DB-first**: Tin nhắn lưu DB trước khi broadcast → không bao giờ mất
2. **Reconnect sync**: Frontend gọi `GET /conversations` + `GET /messages` khi reconnect
3. **Unread tracking**: Server-side `IsRead` flag → badge chính xác ngay cả khi user offline
4. **Atomic operations**: SQL functions dùng single transaction
5. **UNIQUE constraint**: `find_or_create_direct_conversation` dùng `ON CONFLICT` tránh race condition

---

## Security considerations

- **XSS**: HtmlSanitizer trên content trước khi lưu DB
- **Rate limit**: 30 tin nhắn/phút/user (AspNetCoreRateLimit)
- **Authorization**: Chỉ verified users; kiểm tra participant membership trước khi đọc/gửi
- **URL validation**: FacebookUrl/TelegramUrl validate format ở DTO level
- **Content length**: Max 2000 chars
- **Suspended users**: Block gửi/nhận tin nhắn
- **No file upload**: Phase 1 chỉ text, tránh phức tạp storage
