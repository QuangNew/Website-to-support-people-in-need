import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, LogIn } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { chatbotApi } from '../../services/api';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  hasSafetyWarning?: boolean;
}

export default function ChatPanel() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuthStore();
  const { setAuthModal } = useMapStore();
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

    // Require authentication for chatbot
    if (!isAuthenticated) {
      setAuthModal('login');
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const convId = await ensureConversation();
      if (!convId) {
        throw new Error(t('chat.errorCreateConversation'));
      }
      const res = await chatbotApi.sendMessage(convId, { content: text });
      const botContent = res.data.content || res.data.Content;
      const hasSafetyWarning = res.data.hasSafetyWarning || res.data.HasSafetyWarning || false;

      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: botContent,
        timestamp: new Date(),
        hasSafetyWarning,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errMsg = axiosErr?.response?.data?.message
        || (err instanceof Error ? err.message : t('chat.errorGeneral'));
      const errorReply: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `⚠️ ${errMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsTyping(false);
    }
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
        {!isAuthenticated ? (
          <button className="btn btn-primary btn-full" onClick={() => setAuthModal('login')} style={{ margin: '0 var(--sp-3) var(--sp-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <LogIn size={16} />
            {t('chat.loginRequired')}
          </button>
        ) : (
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
        )}
      </div>
    </div>
  );
}
