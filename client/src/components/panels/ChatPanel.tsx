import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles, LogIn, AlertTriangle, RotateCcw, MessageSquare, ImagePlus, X, ImageOff } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { chatbotApi } from '../../services/api';

const CHAT_STORAGE_KEY = 'chatpanel_messages';
const CHAT_CONV_KEY = 'chatpanel_conversation_id';
const MAX_CACHED_MESSAGES = 100;
const IMAGE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  hasSafetyWarning?: boolean;
  /** Base64 data URL for images (only user messages) */
  imageDataUrl?: string;
}

/** Check if image cache has expired (>24h) */
function isImageExpired(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() > IMAGE_EXPIRY_MS;
}

/** Strip expired image data from cached messages to free storage */
function cleanExpiredImages(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.map(m => {
    if (m.imageDataUrl && isImageExpired(m.timestamp)) {
      return { ...m, imageDataUrl: undefined };
    }
    return m;
  });
}

export default function ChatPanel() {
  const { t, locale } = useLanguage();
  const { isAuthenticated, user } = useAuthStore();
  const { setAuthModal } = useMapStore();

  const getWelcomeMessage = useCallback((): ChatMessage => ({
    id: 1,
    role: 'assistant',
    content: t('chat.welcome'),
    timestamp: new Date().toISOString(),
  }), [t]);

  // Load cached messages from localStorage (clean expired images)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return cleanExpiredImages(parsed);
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
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; base64: string; mimeType: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUserIdRef = useRef<string | null>(user?.id ?? null);

  // Clear chat when user changes (logout or switch account)
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (prevUserIdRef.current !== currentUserId) {
      // User changed — clear everything
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(CHAT_CONV_KEY);
      setMessages([getWelcomeMessage()]);
      setConversationId(null);
      setInput('');
      prevUserIdRef.current = currentUserId;
    }
  }, [user?.id, getWelcomeMessage]);

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
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(CHAT_CONV_KEY);
    setMessages([getWelcomeMessage()]);
    setConversationId(null);
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

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert(locale === 'vi' ? 'Chỉ hỗ trợ JPEG, PNG, WebP.' : 'Only JPEG, PNG, WebP supported.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      alert(locale === 'vi' ? 'Ảnh quá lớn (tối đa 4 MB).' : 'Image too large (max 4 MB).');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract base64 from "data:image/jpeg;base64,/9j/4AAQ..."
      const base64 = dataUrl.split(',')[1];
      setPendingImage({ dataUrl, base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleSend = async () => {
    const text = input.trim();
    const hasImage = !!pendingImage;
    if (!text && !hasImage) return;

    if (!isAuthenticated) {
      setAuthModal('login');
      return;
    }

    const imagePrompt = hasImage && !text
      ? (locale === 'vi'
        ? 'Hãy phân tích hình ảnh này và mô tả những gì bạn thấy. Nếu liên quan đến thiên tai hoặc tình huống khẩn cấp, hãy cung cấp hướng dẫn phù hợp.'
        : 'Please analyze this image and describe what you see. If it relates to a disaster or emergency, provide appropriate guidance.')
      : text;

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: imagePrompt,
      timestamp: new Date().toISOString(),
      imageDataUrl: pendingImage?.dataUrl,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const currentImage = pendingImage;
    setPendingImage(null);
    setIsTyping(true);

    try {
      let convId = await ensureConversation();
      if (!convId) {
        throw new Error(t('chat.errorCreateConversation'));
      }

      let res;
      const sendData: { content: string; imageBase64?: string; imageMimeType?: string } = { content: imagePrompt };
      if (currentImage) {
        sendData.imageBase64 = currentImage.base64;
        sendData.imageMimeType = currentImage.mimeType;
      }
      try {
        res = await chatbotApi.sendMessage(convId, sendData);
      } catch (sendErr: any) {
        // If conversation not found (stale cache), create a new one and retry
        if (sendErr?.response?.status === 404) {
          setConversationId(null);
          localStorage.removeItem(CHAT_CONV_KEY);
          convId = await ensureConversation();
          if (!convId) throw new Error(t('chat.errorCreateConversation'));
          res = await chatbotApi.sendMessage(convId, sendData);
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
      if (input.trim() || pendingImage) handleSend();
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  return (
    <div className="panel-content chat-panel">
      {/* Header */}
      <div className="chat-panel-header">
        <div className="chat-panel-header-left">
          <div className="chat-panel-logo">
            <Sparkles size={18} />
            <span className="chat-panel-logo-pulse" />
          </div>
          <div className="chat-panel-header-text">
            <h2 className="chat-panel-title">{t('chat.title')}</h2>
            <div className="chat-panel-status">
              <span className="chat-panel-status-dot" />
              Online
            </div>
          </div>
        </div>
        <button
          className="chat-panel-new-btn"
          onClick={handleNewChat}
          title={locale === 'vi' ? 'Cuộc trò chuyện mới' : 'New Chat'}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-panel-messages">
        {messages.length <= 1 && (
          <div className="chat-panel-empty">
            <div className="chat-panel-empty-icon">
              <MessageSquare size={32} />
            </div>
            <p>{locale === 'vi'
              ? 'Hỏi tôi bất kỳ điều gì về cứu trợ, thông tin thiên tai, hoặc cách sử dụng nền tảng.'
              : 'Ask me anything about relief, disaster info, or how to use the platform.'}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="chat-panel-msg-wrapper">
            {msg.hasSafetyWarning && (
              <div className="chat-panel-emergency">
                <div className="chat-panel-emergency-header">
                  <AlertTriangle size={16} />
                  {t('chat.emergencyWarning')}
                </div>
                <div className="chat-panel-emergency-body">
                  <span>{t('chat.emergencyNumbers')}</span>
                  <div className="chat-panel-emergency-links">
                    <a href="tel:113">{t('chat.police')}</a>
                    <a href="tel:114">{t('chat.fire')}</a>
                    <a href="tel:115">{t('chat.medical')}</a>
                  </div>
                </div>
              </div>
            )}
            <div className={`chat-panel-msg chat-panel-msg--${msg.role}`}>
              <div className={`chat-panel-msg-avatar chat-panel-msg-avatar--${msg.role}`}>
                {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              </div>
              <div className={`chat-panel-msg-bubble chat-panel-msg-bubble--${msg.role}`}>
                {msg.imageDataUrl && !isImageExpired(msg.timestamp) && (
                  <img src={msg.imageDataUrl} alt="" className="chat-panel-msg-image" />
                )}
                {msg.imageDataUrl && isImageExpired(msg.timestamp) && (
                  <div className="chat-panel-msg-image-expired">
                    <ImageOff size={20} />
                    <span>{locale === 'vi' ? 'Ảnh đã hết hạn' : 'Image expired'}</span>
                  </div>
                )}
                <div className="chat-panel-msg-text">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                <time className="chat-panel-msg-time">{formatTime(msg.timestamp)}</time>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-panel-msg chat-panel-msg--assistant">
            <div className="chat-panel-msg-avatar chat-panel-msg-avatar--assistant">
              <Bot size={14} />
            </div>
            <div className="chat-panel-msg-bubble chat-panel-msg-bubble--assistant chat-panel-typing">
              <span className="chat-panel-typing-dot" />
              <span className="chat-panel-typing-dot" />
              <span className="chat-panel-typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-panel-input-area">
        {!isAuthenticated ? (
          <button className="chat-panel-login-btn" onClick={() => setAuthModal('login')}>
            <LogIn size={15} />
            {t('chat.loginRequired')}
          </button>
        ) : (
          <>
            {/* Pending image preview */}
            {pendingImage && (
              <div className="chat-panel-image-preview">
                <img src={pendingImage.dataUrl} alt="" />
                <button className="chat-panel-image-preview-remove" onClick={() => setPendingImage(null)}>
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="chat-panel-input-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleImageSelect}
              />
              <button
                className="chat-panel-image-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping}
                title={locale === 'vi' ? 'Gửi ảnh' : 'Send image'}
              >
                <ImagePlus size={16} />
              </button>
              <textarea
                ref={inputRef}
                className="chat-panel-input"
                placeholder={pendingImage
                  ? (locale === 'vi' ? 'Mô tả ảnh hoặc nhấn gửi...' : 'Describe the image or press send...')
                  : t('chat.inputPlaceholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="chat-panel-send-btn"
                onClick={handleSend}
                disabled={(!input.trim() && !pendingImage) || isTyping}
              >
                <Send size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
