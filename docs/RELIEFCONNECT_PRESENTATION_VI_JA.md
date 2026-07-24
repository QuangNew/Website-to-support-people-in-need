# ReliefConnect — Nội dung slide ngắn Việt–Nhật

> Cách dùng: đặt phần **日本語（スライド用）** lên slide. Phần **Tiếng Việt** ở dưới để đối chiếu khi luyện nói. Mỗi slide chỉ giữ 2–3 ý; không chép cả hai ngôn ngữ lên cùng một slide.

---

## Slide 1 — サービスの目的 / Mục tiêu dịch vụ

### 日本語（スライド用）

**対象ユーザー**

- 支援を必要とする人
- ボランティア・支援者

**課題**

- 救援情報が電話やSNSに分散している
- 必要な支援に迅速につながりにくい

**解決したいこと**

- SOS情報を地図に集約し、救援の連携を速くする

### Tiếng Việt

**Người dùng mục tiêu**

- Người cần hỗ trợ
- Tình nguyện viên và nhà tài trợ

**Vấn đề**

- Thông tin cứu trợ bị phân tán qua điện thoại và mạng xã hội
- Khó kết nối nhanh đến nguồn hỗ trợ phù hợp

**Điều muốn giải quyết**

- Tập trung SOS trên bản đồ để kết nối cứu trợ nhanh hơn

---

## Slide 2 — プロジェクトの概要 / Tổng quan project

### 日本語（スライド用）

| 項目 | 内容 |
|---|---|
| ウェブサイト名 | ReliefConnect |
| 概要 | 困難な状況にある人を支援につなぐWebプラットフォーム |
| 開発期間 | `[記入：例 3か月]` |
| チーム | `[記入：人数]` |

- 自分の担当：`[記入：例 バックエンド、地図機能、認証機能]`

### Tiếng Việt

| Hạng mục | Nội dung |
|---|---|
| Tên website | ReliefConnect |
| Tổng quan | Nền tảng web kết nối người khó khăn với nguồn hỗ trợ |
| Thời gian phát triển | `[Điền: ví dụ 3 tháng]` |
| Thành viên | `[Điền: số người]` |

- Vai trò của tôi: `[Điền: ví dụ backend, bản đồ, xác thực]`

---

## Slide 3 — プロジェクトの仕組み ① 支援を必要とする人 / Cách hoạt động ① Người cần giúp

### 日本語（スライド用）

**SOSを送信する**

- GPS位置と必要な支援内容を登録する
- SOSの状態と支援者からの連絡を確認する
- 解決後に「安全確認」を行う

### Tiếng Việt

**Gửi SOS**

- Đăng vị trí GPS và nội dung cần hỗ trợ
- Theo dõi trạng thái SOS và liên lạc từ người hỗ trợ
- Xác nhận an toàn khi sự việc đã được giải quyết

---

## Slide 4 — プロジェクトの仕組み ② ボランティア / Cách hoạt động ② Tình nguyện viên

### 日本語（スライド用）

- 地図上で近くのSOSを検索し、詳細を確認する
- ルートを確認してタスクを受諾し、対応状況を更新する
- メッセージ・通知で支援を必要とする人と連携する

### Tiếng Việt

- Tìm SOS gần mình trên bản đồ và xem chi tiết
- Xem tuyến đường, nhận nhiệm vụ và cập nhật trạng thái xử lý
- Phối hợp với người cần giúp qua tin nhắn và thông báo

---

## Slide 5 — プロジェクトの仕組み ③ 支援者（スポンサー） / Cách hoạt động ③ Nhà tài trợ

### 日本語（スライド用）

- SOSとコミュニティ投稿から支援ケースを検索する
- 必要な人に支援を申し出る、またはPayOSで寄付する
- 通知・メッセージで支援の連絡を行う

### Tiếng Việt

- Tìm các trường hợp cần hỗ trợ từ SOS và bài đăng cộng đồng
- Gửi đề nghị hỗ trợ hoặc quyên góp qua PayOS
- Liên lạc hỗ trợ qua thông báo và tin nhắn

---

## Slide 6 — 使用技術 / Công nghệ sử dụng

### 日本語（スライド用）

| 分類 | 使用技術 |
|---|---|
| Frontend | React 19, TypeScript, Vite, Leaflet |
| Backend | C#, ASP.NET Core 10, Entity Framework Core |
| Database | PostgreSQL, PostGIS, Supabase |
| 連携 | SignalR, OSRM, Gemini AI, PayOS |

- JWT認証、ロールベース認可、Playwright E2Eテストを採用

### Tiếng Việt

| Nhóm | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite, Leaflet |
| Backend | C#, ASP.NET Core 10, Entity Framework Core |
| Cơ sở dữ liệu | PostgreSQL, PostGIS, Supabase |
| Tích hợp | SignalR, OSRM, Gemini AI, PayOS |

- Dùng JWT, phân quyền theo vai trò và Playwright E2E test

---

## Slide 7 — アピールポイント・成果 / Điểm PR và kết quả

### 日本語（スライド用）

**アピールポイント**

- 地図中心のSOS支援フローを、フロントエンドからDBまで実装した
- PostGISとキャッシュで地図データの表示を最適化した

**成果**

- 認証、SOS、コミュニティ、AIチャット、管理機能を持つフルスタックアプリを開発した
- 主要フローに対するUI/APIテストを整備した

### Tiếng Việt

**Điểm PR**

- Hiện thực luồng hỗ trợ SOS lấy bản đồ làm trung tâm, từ frontend đến database
- Tối ưu hiển thị dữ liệu bản đồ bằng PostGIS và caching

**Kết quả**

- Hoàn thành ứng dụng full-stack có xác thực, SOS, cộng đồng, AI chat và quản trị
- Xây dựng test UI/API cho các luồng chính

---

## Slide 8 — 苦労した点・今後の改善 / Khó khăn và hướng cải thiện

### 日本語（スライド用）

**苦労した点**

- 複数のロールとSOS状態を矛盾なく管理すること
- 地図・AI・決済など外部サービスとの連携

**今後の改善**

- ボランティア業務の完了履歴、支援申し出履歴を充実させる
- refresh token、位置情報プライバシー、負荷テストを強化する

### Tiếng Việt

**Khó khăn**

- Quản lý nhiều vai trò và trạng thái SOS một cách nhất quán
- Tích hợp dịch vụ bản đồ, AI và thanh toán bên ngoài

**Cải thiện tiếp theo**

- Hoàn thiện lịch sử hoàn thành việc tình nguyện và đề nghị hỗ trợ
- Tăng cường refresh token, quyền riêng tư vị trí và kiểm thử tải

---

## Slide kết — まとめ / Kết luận

### 日本語（スライド用）

> ReliefConnectでは、社会課題を、位置情報・リアルタイム通信・権限管理を組み合わせた支援プラットフォームとして設計・実装しました。

### Tiếng Việt

> Với ReliefConnect, nhóm đã thiết kế và hiện thực một nền tảng hỗ trợ kết hợp dữ liệu vị trí, giao tiếp thời gian thực và quản lý phân quyền để giải quyết một vấn đề xã hội.

---

## Lưu ý khi trình bày / 発表時の注意

- Slide chỉ nên giữ phần tiếng Nhật; tiếng Việt dùng để luyện nói.
- Thay toàn bộ phần `[記入]` bằng thông tin thật về thời gian, số thành viên và phần bạn phụ trách.
- Nếu đây là project nhóm, dùng 「チームで実装しました」 thay vì 「私が実装しました」 cho phần không phải do bạn trực tiếp làm.
