-- 1. Tạo Database
CREATE DATABASE ReliefSupportDB;
GO
USE ReliefSupportDB;
GO

-- =============================================
-- KHỐI 1: BẢNG DANH MỤC & ĐỊNH NGHĨA (Lookup Tables)
-- Tạo trước vì không phụ thuộc bảng nào
-- =============================================

-- Bảng Roles: Định nghĩa các vai trò trong hệ thống
CREATE TABLE Roles (
    RoleID INT PRIMARY KEY, -- ID nhập tay để đồng bộ với Code Enum (VD: 9 là Admin)
    RoleName NVARCHAR(50) NOT NULL UNIQUE, -- VD: 'Admin', 'Sponsor', 'Volunteer'
    Description NVARCHAR(200) NULL
);
GO

-- Bảng Categories: Quản lý danh mục bài viết (Admin có thể thêm sửa xóa)
CREATE TABLE Categories (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY, -- Tự tăng
    CategoryName NVARCHAR(100) NOT NULL UNIQUE, -- VD: 'Y tế', 'Giáo dục'
    Description NVARCHAR(200) NULL
);
GO

-- =============================================
-- KHỐI 2: NGƯỜI DÙNG & PHÂN QUYỀN
-- =============================================

-- Bảng Users: Lưu thông tin định danh
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE, -- Unique để không trùng tên đăng nhập
    PasswordHash VARCHAR(255) NOT NULL,   -- Lưu chuỗi băm, không lưu text thuần
    FullName NVARCHAR(100) NOT NULL,      -- NVARCHAR hỗ trợ tiếng Việt
    PhoneNumber VARCHAR(15) NULL,
    CreatedAt DATETIME DEFAULT GETDATE()  -- Mặc định lấy giờ hệ thống
    Email VARCHAR(50) NOT NULL
);
GO

-- Bảng UserRoles: Bảng trung gian xử lý quan hệ N-N (Một người nhiều vai trò)
CREATE TABLE UserRoles (
    UserID INT NOT NULL,
    RoleID INT NOT NULL,
    AssignedAt DATETIME DEFAULT GETDATE(),
    
    -- Khóa chính phức hợp: Đảm bảo 1 user không bị gán trùng 1 quyền 2 lần
    PRIMARY KEY (UserID, RoleID),
    
    -- Khóa ngoại
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)
);
GO

-- =============================================
-- KHỐI 3: BẢN ĐỒ & CỨU TRỢ
-- =============================================

-- Bảng MapItems: Lưu trữ điểm cứu trợ
CREATE TABLE MapItems (
    ItemID INT IDENTITY(1,1) PRIMARY KEY,
    Coordinates GEOGRAPHY NOT NULL, -- Kiểu dữ liệu không gian quan trọng
    Type VARCHAR(20) NOT NULL,      -- 'SOS', 'Supply', 'Shelter'
    Status INT NOT NULL DEFAULT 0,  -- 0: Pending (Chờ duyệt/giúp), 1: InProgress (Đã có TNV nhận), 2: Resolved (Hoàn thành), 3: Verified_Safe (Đã báo an toàn)
    PriorityLevel INT DEFAULT 1,
    Description NVARCHAR(500) NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    
    UserID INT NOT NULL,
    CONSTRAINT FK_MapItems_Users FOREIGN KEY (UserID) REFERENCES Users(UserID)
);
GO

-- =============================================
-- KHỐI 4: MẠNG XÃ HỘI
-- =============================================

-- Bảng SocialPosts: Bài đăng (Đã tách ảnh ra bảng riêng)
CREATE TABLE SocialPosts (
    PostID INT IDENTITY(1,1) PRIMARY KEY,
    Content NVARCHAR(MAX) NOT NULL, -- Bài viết dài
    
    -- Liên kết Dynamic Category
    CategoryID INT NOT NULL, 
    
    -- Denormalization: Lưu số lượng để query nhanh
    TotalLikes INT DEFAULT 0,
    TotalComments INT DEFAULT 0,
    
    CreatedAt DATETIME DEFAULT GETDATE(),
    AuthorID INT NOT NULL,
    
    CONSTRAINT FK_SocialPosts_Categories FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID),
    CONSTRAINT FK_SocialPosts_Users FOREIGN KEY (AuthorID) REFERENCES Users(UserID)
);
GO

-- Bảng PostImages: Xử lý quan hệ 1-N (Một bài viết có nhiều ảnh)
CREATE TABLE PostImages (
    ImageID INT IDENTITY(1,1) PRIMARY KEY,
    ImageURL VARCHAR(MAX) NOT NULL,
    UploadedAt DATETIME DEFAULT GETDATE(),
    PostID INT NOT NULL,
    
    -- ON DELETE CASCADE: Xóa bài viết thì ảnh cũng tự xóa
    CONSTRAINT FK_PostImages_Posts FOREIGN KEY (PostID) REFERENCES SocialPosts(PostID) ON DELETE CASCADE
);
GO

-- Bảng PostInteractions: Xử lý Like/Comment
CREATE TABLE PostInteractions (
    InteractionID INT IDENTITY(1,1) PRIMARY KEY,
    Type VARCHAR(20) NOT NULL, -- 'Like', 'Love', 'Comment'
    CommentContent NVARCHAR(500) NULL, -- Chỉ có giá trị nếu Type là 'Comment'
    CreatedAt DATETIME DEFAULT GETDATE(),
    
    UserID INT NOT NULL,
    PostID INT NOT NULL,
    
    CONSTRAINT FK_Interactions_Users FOREIGN KEY (UserID) REFERENCES Users(UserID),
    CONSTRAINT FK_Interactions_Posts FOREIGN KEY (PostID) REFERENCES SocialPosts(PostID) ON DELETE CASCADE -- SQL Server mặc định có thể chặn cascade nhiều nhánh, cần lưu ý khi config
);
GO

-- =============================================
-- KHỐI 5: CHATBOT AI
-- =============================================

-- Bảng Conversations: Phiên hội thoại
CREATE TABLE Conversations (
    ConversationID INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(100) NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    SenderID INT NOT NULL,
    CONSTRAINT FK_Conversations_Users FOREIGN KEY (SenderID) REFERENCES Users(UserID)
);
GO

-- Bảng Messages: Tin nhắn chi tiết (Logic SenderID NULL = Bot)
CREATE TABLE Messages (
    MessageID INT IDENTITY(1,1) PRIMARY KEY,
    Content NVARCHAR(MAX) NOT NULL,
    
    -- Logic mới: SenderID cho phép NULL
    -- Nếu NULL: Tin nhắn của Bot
    -- Nếu có ID: Tin nhắn của User
    SenderID INT NULL, 
    
    ConversationID INT NOT NULL,
    SentAt DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_Messages_Conversations FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
    CONSTRAINT FK_Messages_Users FOREIGN KEY (SenderID) REFERENCES Users(UserID)
);
GO