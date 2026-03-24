-- Test data for ReliefConnect
-- Run this in Supabase SQL Editor

-- Insert test pings (SOS requests)
INSERT INTO "Pings" 
  ("CoordinatesLat", "CoordinatesLong", "Type", "Status", "Details", "UserId", "CreatedAt")
VALUES
  (21.0285, 105.8542, 0, 0, 'Cần hỗ trợ lương thực khẩn cấp tại Hoàn Kiếm', (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW()),
  (10.7769, 106.7009, 0, 0, 'Gia đình bị ngập lụt cần cứu trợ gấp', (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW()),
  (16.0544, 108.2022, 0, 1, 'Đang được hỗ trợ - Đà Nẵng', (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW()),
  (21.0245, 105.8412, 1, 2, 'Điểm phát quà cứu trợ - Hà Nội', (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW()),
  (10.8231, 106.6297, 1, 2, 'Trung tâm cứu trợ - TP.HCM', (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW());

-- Insert test posts
INSERT INTO "Posts" ("Content", "Category", "AuthorId", "CreatedAt")
VALUES
  ('Gia đình tôi đang gặp khó khăn sau trận lũ. Cần hỗ trợ lương thực và nước sạch.', 0, (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW()),
  ('Con tôi bị bệnh tim cần chi phí phẫu thuật cao. Mong nhận được sự giúp đỡ.', 1, (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW()),
  ('Em học sinh nghèo cần học bổng để tiếp tục đến trường.', 2, (SELECT "Id" FROM "AspNetUsers" LIMIT 1), NOW());
