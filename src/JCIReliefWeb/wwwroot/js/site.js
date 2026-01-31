// ============================================
// JCI Relief Platform - Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
    initChatWidget();
    initDarkMode();
    initNotifications();
});

// ============================================
// Sidebar Toggle
// ============================================
function initSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            if (window.innerWidth < 992) {
                if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }
}

// ============================================
// AI Chat Widget
// ============================================
function initChatWidget() {
    const chatToggle = document.getElementById('chatToggle');
    const chatPanel = document.getElementById('chatPanel');
    const chatClose = document.getElementById('chatClose');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatToggle || !chatPanel) return;
    
    // Toggle chat panel
    chatToggle.addEventListener('click', function() {
        chatPanel.classList.toggle('active');
        if (chatPanel.classList.contains('active')) {
            chatInput.focus();
        }
    });
    
    // Close chat panel
    chatClose.addEventListener('click', function() {
        chatPanel.classList.remove('active');
    });
    
    // Send message
    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message
        addMessage(message, 'user');
        chatInput.value = '';
        
        // Simulate AI response
        setTimeout(() => {
            const response = getAIResponse(message);
            addMessage(response, 'bot');
        }, 800);
    }
    
    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Mock AI responses
    function getAIResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // Emergency keywords
        if (lowerMessage.includes('cấp cứu') || lowerMessage.includes('khẩn cấp') || lowerMessage.includes('chết')) {
            return `⚠️ <strong>TRƯỜNG HỢP KHẨN CẤP</strong><br><br>
                Vui lòng gọi ngay số điện thoại khẩn cấp:<br>
                🚑 <strong>115</strong> - Cấp cứu y tế<br>
                🚓 <strong>113</strong> - Công an<br>
                🚒 <strong>114</strong> - Cứu hỏa<br><br>
                Tôi không thể thay thế sự hỗ trợ y tế chuyên nghiệp.`;
        }
        
        // First aid
        if (lowerMessage.includes('sơ cứu') || lowerMessage.includes('vết thương')) {
            return `🏥 <strong>Hướng dẫn sơ cứu cơ bản:</strong><br><br>
                1. <strong>Cầm máu:</strong> Đè chặt vết thương bằng vải sạch<br>
                2. <strong>Băng bó:</strong> Quấn băng vừa đủ chặt<br>
                3. <strong>Giữ sạch:</strong> Rửa tay trước khi xử lý<br>
                4. <strong>Theo dõi:</strong> Kiểm tra dấu hiệu nhiễm trùng<br><br>
                ⚠️ Với vết thương nặng, hãy gọi 115 ngay!`;
        }
        
        // Flood survival
        if (lowerMessage.includes('lũ') || lowerMessage.includes('ngập') || lowerMessage.includes('nước')) {
            return `🌊 <strong>Mẹo sinh tồn khi lũ:</strong><br><br>
                ✅ Di chuyển lên cao ngay khi có cảnh báo<br>
                ✅ Tắt điện, gas khi nước bắt đầu ngập<br>
                ✅ Chuẩn bị đèn pin, nước sạch, thuốc<br>
                ✅ Không đi qua đường ngập nước<br>
                ✅ Báo vị trí qua app nếu cần cứu hộ<br><br>
                📍 Nhấn "Chìm vị trí" để báo mực nước tại vị trí của bạn.`;
        }
        
        // Relief points
        if (lowerMessage.includes('điểm cứu trợ') || lowerMessage.includes('nhận đồ') || lowerMessage.includes('kho')) {
            return `📍 <strong>Điểm cứu trợ gần nhất:</strong><br><br>
                🏪 <strong>Kho JCI Đà Nẵng</strong><br>
                   Địa chỉ: 123 Nguyễn Văn Linh<br>
                   Điện thoại: 0236.xxx.111<br><br>
                🏪 <strong>Trung tâm cứu trợ Quảng Nam</strong><br>
                   Địa chỉ: 45 Trần Phú, Hội An<br>
                   Điện thoại: 0235.xxx.222<br><br>
                Nhấn "Danh sách" để xem tất cả điểm cứu trợ.`;
        }
        
        // Donate
        if (lowerMessage.includes('quyên góp') || lowerMessage.includes('ủng hộ') || lowerMessage.includes('cho')) {
            return `💝 <strong>Cách quyên góp:</strong><br><br>
                1. <strong>Tiền mặt:</strong> Chuyển khoản qua ngân hàng<br>
                2. <strong>Hiện vật:</strong> Gạo, mì tôm, nước, thuốc<br>
                3. <strong>Tình nguyện:</strong> Đăng ký làm tình nguyện viên<br><br>
                Nhấn "Muốn cho" để bắt đầu quyên góp ngay!`;
        }
        
        // Default response
        return `Cảm ơn bạn đã liên hệ! 🙏<br><br>
            Tôi có thể giúp bạn về:<br>
            • Hướng dẫn sơ cứu<br>
            • Mẹo sinh tồn khi lũ<br>
            • Tìm điểm cứu trợ<br>
            • Cách quyên góp<br><br>
            Bạn cần hỗ trợ gì?`;
    }
}

// ============================================
// Dark Mode
// ============================================
function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    if (darkModeToggle) {
        // Check saved preference
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            darkModeToggle.checked = true;
        }
        
        darkModeToggle.addEventListener('change', function() {
            document.body.classList.toggle('dark-mode', this.checked);
            localStorage.setItem('darkMode', this.checked);
        });
    }
}

// ============================================
// Notifications
// ============================================
function initNotifications() {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        // We'll request permission when user interacts
    }
}

// ============================================
// Map Utilities
// ============================================
const MapUtils = {
    // Custom marker icons
    icons: {
        sos: '🚩',
        warehouse: '🏪',
        safe: '✅',
        pending: '🟡'
    },
    
    // Status colors
    statusColors: {
        urgent: '#ef4444',
        pending: '#f59e0b',
        resolved: '#22c55e'
    },
    
    // Format Vietnamese currency
    formatCurrency: function(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    },
    
    // Format relative time in Vietnamese
    formatRelativeTime: function(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 60) return `${minutes} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        return `${days} ngày trước`;
    }
};

// ============================================
// Form Utilities
// ============================================
const FormUtils = {
    // Validate Vietnamese phone number
    validatePhone: function(phone) {
        const regex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
        return regex.test(phone);
    },
    
    // Show toast notification
    showToast: function(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast show align-items-center text-white bg-${type} border-0`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    },
    
    createToastContainer: function() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1200';
        document.body.appendChild(container);
        return container;
    }
};

// ============================================
// Lazy Loading for Community Feed
// ============================================
const LazyLoader = {
    page: 1,
    loading: false,
    hasMore: true,
    
    init: function(container, loadFunction) {
        this.container = container;
        this.loadFunction = loadFunction;
        
        window.addEventListener('scroll', () => {
            if (this.loading || !this.hasMore) return;
            
            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                this.loadMore();
            }
        });
    },
    
    loadMore: async function() {
        this.loading = true;
        this.page++;
        
        // Show loading indicator
        const loader = document.createElement('div');
        loader.className = 'text-center py-4';
        loader.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
        this.container.appendChild(loader);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Remove loader
        loader.remove();
        this.loading = false;
        
        // Load more content
        if (this.loadFunction) {
            const items = await this.loadFunction(this.page);
            if (!items || items.length === 0) {
                this.hasMore = false;
            }
        }
    }
};

// ============================================
// Export for use in views
// ============================================
window.JCIRelief = {
    MapUtils,
    FormUtils,
    LazyLoader
};
