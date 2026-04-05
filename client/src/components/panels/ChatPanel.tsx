import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, LogIn, AlertTriangle, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { chatbotApi } from '../../services/api';

const CHAT_STORAGE_KEY = 'chatpanel_messages';
const CHAT_CONV_KEY = 'chatpanel_conversation_id';
const MAX_CACHED_MESSAGES = 100;

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  hasSafetyWarning?: boolean;
}

export default function ChatPanel() {
  const { t, locale } = useLanguage();
  const { isAuthenticated } = useAuthStore();
  const { setAuthModal } = useMapStore();

  const getWelcomeMessage = (): ChatMessage => ({
    id: 1,
    role: 'assistant',
    content: t('chat.welcome'),
    timestamp: new Date().toISOString(),
  });

  // Load cached messages from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [getWelcomeMessage()];
  });

  // Load cached conversationId
  const [conversationId, setConversationId] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(CHAT_CONV_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch { return null; }
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Debounced save to localStorage
  const saveMessages = useCallback((msgs: ChatMessage[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const toSave = msgs.slice(-MAX_CACHED_MESSAGES);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
      } catch { /* ignore */ }
    }, 500);
  }, []);

  // Persist messages whenever they change
  useEffect(() => {
    saveMessages(messages);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [messages, saveMessages]);

  // Persist conversationId
  useEffect(() => {
    if (conversationId !== null) {
      localStorage.setItem(CHAT_CONV_KEY, String(conversationId));
    }
  }, [conversationId]);

  // New chat handler
  const handleNewChat = () => {
    const confirmMessage = locale === 'vi'
      ? 'Bạn có muốn bắt đầu cuộc trò chuyện mới? Tin nhắn cũ sẽ bị xóa.'
      : 'Start a new conversation? Old messages will be cleared.';

    if (window.confirm(confirmMessage)) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(CHAT_CONV_KEY);
      setMessages([getWelcomeMessage()]);
      setConversationId(null);
    }
  };

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

    if (!isAuthenticated) {
      setAuthModal('login');
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      let convId = await ensureConversation();
      if (!convId) {
        throw new Error(t('chat.errorCreateConversation'));
      }

      let res;
      try {
        res = await chatbotApi.sendMessage(convId, { content: text });
      } catch (sendErr: any) {
        // If conversation not found (stale cache), create a new one and retry
        if (sendErr?.response?.status === 404) {
          setConversationId(null);
          localStorage.removeItem(CHAT_CONV_KEY);
          convId = await ensureConversation();
          if (!convId) throw new Error(t('chat.errorCreateConversation'));
          res = await chatbotApi.sendMessage(convId, { content: text });
        } else {
          throw sendErr;
        }
      }

      const botContent = res.data.content || res.data.Content;
      const hasSafetyWarning = res.data.hasSafetyWarning || res.data.HasSafetyWarning || false;

      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: botContent,
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
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
        <button
          className="btn btn-ghost btn-icon"
          onClick={handleNewChat}
          title={locale === 'vi' ? 'Cuộc trò chuyện mới' : 'New Chat'}
          style={{ marginLeft: 'auto' }}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.hasSafetyWarning && (
              <div style={{
                background: '#dc2626',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                margin: '8px 12px',
                fontSize: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '8px' }}>
                  <AlertTriangle size={18} />
                  {t('chat.emergencyWarning')}
                </div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>{t('chat.emergencyNumbers')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                  <a href="tel:113" style={{ color: 'white', textDecoration: 'underline' }}>{t('chat.police')}</a>
                  <a href="tel:114" style={{ color: 'white', textDecoration: 'underline' }}>{t('chat.fire')}</a>
                  <a href="tel:115" style={{ color: 'white', textDecoration: 'underline' }}>{t('chat.medical')}</a>
                </div>
              </div>
            )}
            <div className={`chat-message chat-message-${msg.role}`}>
              <div className="chat-message-avatar">
                {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className="chat-message-bubble">
                <p>{msg.content}</p>
                <time className="chat-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
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
