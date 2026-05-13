import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles, LogIn, AlertTriangle, RotateCcw, MessageSquare, ImagePlus, X, ImageOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { useChatStore, isImageExpired, type ChatMessage, type PendingChatImage } from '../../stores/chatStore';
import { getImageUrl } from '../../services/api';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

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

  const {
    messages,
    conversationId,
    isTyping,
    isLoadingHistory,
    ensureWelcome,
    resetChat,
    hydrateConversation,
    sendMessage: sendChatMessage,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingChatImage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    ensureWelcome(getWelcomeMessage());
  }, [ensureWelcome, getWelcomeMessage]);

  // Clear chat when user changes (logout or switch account)
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (prevUserIdRef.current !== currentUserId) {
      resetChat(getWelcomeMessage());
      setInput('');
      setPendingImage(null);
      prevUserIdRef.current = currentUserId;
    }
  }, [user?.id, getWelcomeMessage, resetChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    void hydrateConversation({ isAuthenticated, welcomeMessage: getWelcomeMessage() });
  }, [conversationId, getWelcomeMessage, hydrateConversation, isAuthenticated, messages.length]);

  // New chat handler
  const handleNewChat = () => {
    resetChat(getWelcomeMessage());
    setInput('');
    setPendingImage(null);
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('chat.invalidImageType'));
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(t('chat.imageTooLarge'));
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

  const handleSend = () => {
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

    setInput('');
    const currentImage = pendingImage;
    setPendingImage(null);

    void sendChatMessage({
      content: imagePrompt,
      image: currentImage,
      welcomeMessage: getWelcomeMessage(),
      createConversationError: t('chat.errorCreateConversation'),
      generalError: t('chat.errorGeneral'),
      emptyResponseMessage: locale === 'vi'
        ? 'Mô hình AI chưa trả về nội dung văn bản phù hợp.'
        : 'The AI model did not return suitable text content.',
    });
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
        {messages.length <= 1 && !isLoadingHistory && (
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
                {msg.role === 'assistant' ? (
                  <Bot size={14} />
                ) : user?.avatarUrl ? (
                  <img src={getImageUrl(user.avatarUrl)} alt="" className="chat-panel-msg-avatar-img" />
                ) : (
                  <User size={14} />
                )}
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
