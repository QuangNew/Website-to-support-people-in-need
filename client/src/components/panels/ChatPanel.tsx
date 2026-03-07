import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../stores/authStore';
import { chatbotApi } from '../../services/api';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPanel() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content: t('chat.welcome'),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Create conversation on first authenticated message
  const ensureConversation = async (): Promise<number | null> => {
    if (conversationId) return conversationId;
    if (!isAuthenticated) return null;
    try {
      const res = await chatbotApi.createConversation();
      const id = res.data.id || res.data.Id;
      setConversationId(id);
      return id;
    } catch {
      return null;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Try real API first, fall back to simulated response
    try {
      const convId = await ensureConversation();
      if (convId) {
        const res = await chatbotApi.sendMessage(convId, { content: text });
        const botContent = res.data.content || res.data.Content || getSimulatedResponse(text);
        const aiMsg: ChatMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: botContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        return;
      }
    } catch {
      // Backend not available, fall through to simulation
    }

    // Simulated fallback
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: getSimulatedResponse(text),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="panel-content chat-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="panel-title">{t('chat.title')}</h2>
            <span className="chat-status">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            <div className="chat-message-avatar">
              {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className="chat-message-bubble">
              <p>{msg.content}</p>
              <time className="chat-message-time">
                {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-avatar">
              <Bot size={16} />
            </div>
            <div className="chat-message-bubble chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={t('chat.inputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function getSimulatedResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('cứu trợ') || lower.includes('relief')) {
    return 'Hiện tại có nhiều điểm cứu trợ đang hoạt động trên bản đồ. Bạn có thể lọc theo loại "Điểm hỗ trợ" để xem các điểm tiếp nhận gần nhất.';
  }
  if (lower.includes('giúp') || lower.includes('help')) {
    return 'Nếu bạn cần giúp đỡ, hãy tạo một ping "Cần giúp" trên bản đồ. Cộng đồng sẽ nhìn thấy và hỗ trợ bạn nhanh chóng.';
  }
  if (lower.includes('cho') || lower.includes('offer') || lower.includes('donate')) {
    return 'Cảm ơn bạn muốn giúp đỡ! Bạn có thể tạo ping "Muốn cho" để thông báo vật phẩm bạn muốn chia sẻ, hoặc xem danh sách yêu cầu để tìm người cần hỗ trợ.';
  }
  return 'Cảm ơn bạn đã liên hệ! Tôi có thể giúp bạn tìm thông tin cứu trợ, hướng dẫn tạo yêu cầu hỗ trợ, hoặc kết nối với cộng đồng. Bạn cần mình hỗ trợ gì?';
}
