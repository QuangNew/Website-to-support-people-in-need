# Giới thiệu về ReliefConnect

> *Bản dịch tiếng Việt — xem bản gốc tiếng Anh tại [ABOUT_US.md](../ABOUT_US.md)*

> *Kết nối cứu trợ đến với những người cần được hỗ trợ nhất.*

---

## Sứ Mệnh Của Chúng Tôi

ReliefConnect là một nền tảng công nghệ nhân đạo được xây dựng nhằm xóa bỏ khoảng cách tới hạn giữa những người bị ảnh hưởng bởi thảm họa thiên nhiên, dịch bệnh và khủng hoảng kinh tế–xã hội ở Việt Nam với các tổ chức, tình nguyện viên và nhà tài trợ sẵn sàng giúp đỡ.

Khi thảm họa xảy ra, mỗi phút đều có giá trị. Điều phối cứu trợ theo cách truyền thống phụ thuộc vào các cuộc điện thoại rời rạc, bài đăng mạng xã hội và logistics thủ công — dẫn đến phản ứng chậm trễ, nỗ lực trùng lặp và các cộng đồng không được hỗ trợ kịp thời. ReliefConnect thay thế sự hỗn loạn này bằng một nền tảng kỹ thuật số thời gian thực thống nhất, trao quyền cho mọi bên tham gia trong chuỗi cứu trợ.

## Chúng Tôi Làm Gì

### Bản Đồ Cứu Trợ Thời Gian Thực
Bản đồ địa không gian tương tác được hỗ trợ bởi PostGIS hiển thị các yêu cầu cứu trợ SOS đang diễn ra, kho hàng cứu trợ và nơi trú ẩn an toàn trên khắp Việt Nam. Tình nguyện viên theo dõi các tình huống khẩn cấp theo thời gian thực qua kết nối WebSocket (SignalR), rút ngắn thời gian phản ứng từ hàng giờ xuống chỉ còn vài phút.

### Mạng Xã Hội Cộng Đồng
Bảng tin xã hội được xây dựng chuyên biệt kết nối người cần được hỗ trợ với cộng đồng của họ. Người dùng chia sẻ câu chuyện được phân loại theo khó khăn sinh kế, nhu cầu y tế và hỗ trợ giáo dục — tạo ra sự chú ý cho những cá nhân dễ bị bỏ lại phía sau.

### Hỗ Trợ Bởi AI
Chatbot tích hợp được cung cấp bởi Google Gemini AI đưa ra hướng dẫn tức thì về sơ cứu, kỹ năng sinh tồn, cách sử dụng nền tảng và các đầu số khẩn cấp tại địa phương. Hệ thống phát hiện từ khóa khẩn cấp bằng cả tiếng Việt lẫn tiếng Anh, tự động hiển thị thông tin an toàn quan trọng.

### Hệ Sinh Thái Theo Vai Trò
ReliefConnect phục vụ bốn nhóm người dùng riêng biệt với các tính năng được tùy chỉnh phù hợp:

| Vai Trò | Mục Đích |
|---------|---------|
| **Người cần được hỗ trợ** | Đăng yêu cầu cứu trợ SOS, chia sẻ câu chuyện, yêu cầu hỗ trợ |
| **Tình nguyện viên** | Nhận và quản lý nhiệm vụ cứu trợ, xác nhận an toàn tại hiện trường |
| **Nhà tài trợ** | Tìm hiểu các trường hợp cần hỗ trợ, cung cấp tài chính hoặc vật chất |
| **Quản trị viên** | Kiểm duyệt nội dung, xác minh danh tính, quản lý nền tảng |

### Xác Minh Danh Tính
Mọi vai trò vượt quá đăng ký cơ bản đều yêu cầu xác minh bằng tài liệu do quản trị viên nền tảng xét duyệt — đảm bảo sự tin tưởng và trách nhiệm trong toàn bộ hệ sinh thái.

## Nền Tảng Công Nghệ

ReliefConnect được xây dựng trên một bộ công nghệ hiện đại, đạt chuẩn sản xuất, được thiết kế để đảm bảo độ tin cậy trong các tình huống khủng hoảng:

| Tầng | Công Nghệ | Mục Đích |
|------|-----------|---------|
| Backend API | ASP.NET Core 10.0 (C#) | API RESTful với Clean Architecture |
| Frontend | React 19 + TypeScript + Vite | Ứng dụng trang đơn (SPA) đáp ứng |
| Cơ sở dữ liệu | PostgreSQL 17 + PostGIS | Truy vấn địa không gian và lưu trữ dữ liệu đáng tin cậy |
| Lưu trữ | Supabase (PostgreSQL được quản lý) | Hạ tầng cơ sở dữ liệu đám mây có khả năng mở rộng |
| Thời gian thực | SignalR (WebSocket) | Phát sóng cảnh báo SOS trực tiếp |
| Tích hợp AI | Google Gemini 2.5 Flash | AI hội thoại đa ngôn ngữ |
| Công việc nền | Hangfire | Gửi email bất đồng bộ và giám sát |
| Đa ngôn ngữ | i18n (Tiếng Việt + Tiếng Anh) | Giao diện song ngữ hoàn chỉnh |

### Nguyên Tắc Kiến Trúc
- **Clean Architecture**: Phân tách ba tầng (Core → Infrastructure → API) đảm bảo khả năng kiểm thử và bảo trì
- **Ưu tiên Bảo mật**: Xác thực JWT, giới hạn tốc độ, làm sạch XSS, chống tấn công timing và ghi nhật ký kiểm toán toàn diện
- **Tối ưu Hiệu suất**: Phản hồi API dưới 1 giây nhờ chỉ mục không gian, phân trang cursor, nén phản hồi và output caching
- **Thời gian thực theo Thiết kế**: Cảnh báo SOS qua WebSocket với phát hiện nhấp nháy tự động cho các yêu cầu khẩn cấp chưa được xác nhận

## Phạm Vi Địa Lý

ReliefConnect được thiết kế cho bối cảnh thảm họa đặc thù của Việt Nam — một quốc gia phải đối mặt trung bình 6–8 cơn bão mỗi năm, kèm theo lũ lụt, sạt lở đất và hạn hán tái diễn. Nền tảng:

- Xác thực tất cả tọa độ theo ranh giới lãnh thổ Việt Nam (bao gồm các lãnh thổ đảo)
- Hỗ trợ song ngữ (Tiếng Việt là ngôn ngữ chính, Tiếng Anh là phụ)
- Tích hợp các số điện thoại khẩn cấp địa phương (113 Công an, 114 Cứu hỏa, 115 Cấp cứu)
- Hỗ trợ định dạng địa chỉ Việt Nam và định vị theo cấp tỉnh/thành phố

## Giá Trị Cốt Lõi

### Minh Bạch
Mọi hành động quản trị đều được ghi lại trong nhật ký kiểm toán bất biến. Các thao tác hàng loạt tạo ra cấu trúc nhật ký cha–con để đảm bảo trách nhiệm giải trình đầy đủ.

### Khả Năng Tiếp Cận
Nền tảng hoàn toàn song ngữ, tương thích di động và được thiết kế với yêu cầu băng thông tối thiểu — điều thiết yếu tại các khu vực có cơ sở hạ tầng bị hư hỏng sau thảm họa.

### Quyền Riêng Tư
Dữ liệu vị trí của người dùng được xử lý cẩn thận. Truy vấn địa không gian được thực hiện phía máy chủ trên tọa độ đã được đánh chỉ mục; kiến trúc nền tảng hỗ trợ proxy phía backend cho các yêu cầu định tuyến, tránh để lộ tọa độ người dùng ra dịch vụ bên thứ ba.

### Hợp Tác Mở
ReliefConnect được xây dựng như một sáng kiến PBL (Học tập qua Dự án) với trọng tâm tạo ra tác động nhân đạo thực tế thông qua kỹ thuật phần mềm xuất sắc.

## Tác Động Qua Thiết Kế

| Chỉ Số | Khả Năng |
|--------|---------|
| **Thời gian phản hồi** | Cảnh báo SOS thời gian thực qua WebSocket (giao nhận < 1 giây) |
| **Phạm vi phủ sóng** | Bản đồ địa không gian toàn quốc với độ chính xác dưới kilômét |
| **Quy mô** | Nhóm marker xử lý hàng nghìn yêu cầu SOS đồng thời |
| **Độ tin cậy** | Tự động kết nối lại cơ sở dữ liệu, khả năng phục hồi công việc nền, connection pooling |
| **Kiểm duyệt** | Xem xét nội dung hỗ trợ AI, báo cáo cộng đồng, hàng đợi kiểm duyệt của quản trị viên |

## Liên Lạc & Đóng Góp

ReliefConnect được phát triển và duy trì trong khuôn khổ dự án PBL đại học tại Đại Học Bách Khoa — Đại Học Đà Nẵng. Để liên lạc, hợp tác hoặc đóng góp:

- **Kho lưu trữ**: GitHub — Website-to-support-people-in-need
- **Backend API**: `http://localhost:5164` (môi trường phát triển)
- **Ứng dụng Frontend**: `http://localhost:5173` (môi trường phát triển)

---

*ReliefConnect — Vì khi thảm họa xảy ra, công nghệ nên kết nối — không nên tạo thêm rào cản.*
