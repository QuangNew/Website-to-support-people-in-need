import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowLeft, Send, Loader2, MessageSquare, Clock } from 'lucide-react';
import { useMessageStore, type Conversation, type DeliveryStatus, type DirectMessage } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { messageApi } from '../../services/api';
import { sendTypingIndicator } from '../../services/directMessageSignalR';
import { useLanguage } from '../../contexts/LanguageContext';

interface SearchUser {
  id: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
}

export default function MessagingPanel() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const canUseMessages = user?.role === 'Admin' || user?.verificationStatus === 'Approved';
  const {
    conversations,
    activeConversationId,
    messages,
    totalUnread: _totalUnread,
    nextCursor,
    isLoadingConversations,
    isLoadingMessages,
    fetchConversations,
    fetchMessages,
    sendMessage,
    startConversation,
    markRead,
    setActiveConversation,
  } = useMessageStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Get typing indicator for the active conversation
  const typingUser = useMessageStore((s) =>
    activeConversationId ? s.typingUsers.get(activeConversationId) : undefined
  );

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Search users with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await messageApi.searchUsers(query);
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Open conversation
  const openConversation = async (conversationId: number) => {
    setActiveConversation(conversationId);
    await fetchMessages(conversationId);
    markRead(conversationId);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Start conversation with a user from search
  const startChat = async (targetUserId: string) => {
    try {
      const conversationId = await startConversation(targetUserId);
      await fetchMessages(conversationId);
      setSearchQuery('');
      setSearchResults([]);
    } catch {
      /* silent */
    }
  };

  // Send message
  const handleSend = () => {
    if (!inputText.trim() || !activeConversationId) return;
    const text = inputText.trim();
    setInputText('');
    void sendMessage(activeConversationId, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.nativeEvent as KeyboardEvent).isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Emit typing indicator (debounced — only once per 2s)
  const handleInputChange = (value: string) => {
    setInputText(value);
    if (activeConversationId && value.trim()) {
      if (!typingTimeoutRef.current) {
        sendTypingIndicator(activeConversationId);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = undefined;
      }, 2000);
    }
  };

  // Load more messages
  const loadMore = () => {
    if (activeConversationId && nextCursor) {
      fetchMessages(activeConversationId, true);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Back to conversation list
  const handleBack = () => {
    setActiveConversation(null);
    setInputText('');
    fetchConversations();
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  // ─── Conversation Detail View ───
  if (activeConversationId && activeConv) {
    return (
      <div className="messaging-panel">
        {/* Header */}
        <div className="messaging-header">
          <button className="btn-ghost btn-sm" onClick={handleBack}>
            <ArrowLeft size={18} />
          </button>
          <div className="messaging-header-info">
            <div className="messaging-avatar">
              {activeConv.partnerAvatar ? (
                <img src={activeConv.partnerAvatar} alt="" className="messaging-avatar-img" />
              ) : (
                <span>{activeConv.partnerName?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
            </div>
            <strong className="messaging-partner-name">{activeConv.partnerName}</strong>
          </div>
        </div>

        {/* Messages */}
        <div className="messaging-messages">
          {nextCursor && (
            <button className="messaging-load-more" onClick={loadMore} disabled={isLoadingMessages}>
              {isLoadingMessages ? <Loader2 size={14} className="animate-spin" /> : t('messaging.loadMore')}
            </button>
          )}
          {[...messages].reverse().map((msg: DirectMessage) => (
            <div
              key={msg.clientMessageId ?? `message-${msg.id}`}
              className={`messaging-bubble ${msg.isMine ? 'mine' : 'theirs'} ${msg.isMine && msg.deliveryStatus ? msg.deliveryStatus : ''}`}
            >
              <p className="messaging-bubble-text">{msg.content}</p>
              <div className="messaging-bubble-meta">
                {msg.isMine ? (
                  <span className={`messaging-bubble-status ${msg.isRead ? 'read' : (msg.deliveryStatus || 'sent')}`}>
                    {msg.isRead ? t('messaging.statusRead') : getDeliveryStatusLabel(msg.deliveryStatus || 'sent', t)}
                  </span>
                ) : null}
                <span className="messaging-bubble-time">
                  {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
          {isLoadingMessages && messages.length === 0 && (
            <div className="messaging-loading">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {typingUser && (
            <div className="messaging-typing-indicator">
              <span className="messaging-typing-dots">
                <span /><span /><span />
              </span>
              <span className="messaging-typing-text">{typingUser.userName} {t('messaging.isTyping')}</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="messaging-input-bar">
          <input
            type="text"
            className="messaging-input"
            placeholder={t('messaging.inputPlaceholder')}
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
          />
          <button
            className="messaging-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim()}
          >
            <Send size={16} />
          </button>
        </div>

        {/* Retention notice */}
        <p className="messaging-retention">{t('messaging.retention')}</p>
      </div>
    );
  }

  // ─── Conversation List View ───
  return (
    <div className="messaging-panel">
      <div className="messaging-header">
        <MessageSquare size={20} />
        <h3 className="messaging-title">{t('messaging.title')}</h3>
      </div>

      {/* Search */}
      <div className="messaging-search">
        <Search size={14} />
        <input
          type="text"
          placeholder={t('messaging.search')}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="messaging-search-input"
        />
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="messaging-search-results">
          {isSearching ? (
            <div className="messaging-loading"><Loader2 size={16} className="animate-spin" /></div>
          ) : searchResults.length === 0 ? (
            <p className="messaging-empty-text">{t('messaging.noResults')}</p>
          ) : (
            searchResults.map((u) => (
              <button key={u.id} className="messaging-user-item" onClick={() => startChat(u.id)}>
                <div className="messaging-avatar messaging-avatar-sm">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt="" className="messaging-avatar-img" />
                  ) : (
                    <span>{u.fullName?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="messaging-user-info">
                  <span className="messaging-user-name">{u.fullName}</span>
                  <span className="messaging-user-role">{u.role}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Conversation List */}
      {searchQuery.length < 2 && (
        <div className="messaging-conversation-list">
          {isLoadingConversations ? (
            <div className="messaging-loading"><Loader2 size={20} className="animate-spin" /></div>
          ) : conversations.length === 0 ? (
            <div className="messaging-empty">
              <MessageSquare size={32} strokeWidth={1.5} />
              <p>{t('messaging.empty')}</p>
            </div>
          ) : (
            conversations.map((conv: Conversation) => (
              <button
                key={conv.id}
                className={`messaging-conv-item ${conv.unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => openConversation(conv.id)}
              >
                <div className="messaging-avatar">
                  {conv.partnerAvatar ? (
                    <img src={conv.partnerAvatar} alt="" className="messaging-avatar-img" />
                  ) : (
                    <span>{conv.partnerName?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="messaging-conv-content">
                  <div className="messaging-conv-top">
                    <span className="messaging-conv-name">{conv.partnerName}</span>
                    {conv.lastMessageAt && (
                      <span className="messaging-conv-time">
                        <Clock size={10} />
                        {formatConvTime(conv.lastMessageAt, t)}
                      </span>
                    )}
                  </div>
                  <div className="messaging-conv-bottom">
                    <span className={`messaging-conv-preview${!conv.lastMessage ? ' messaging-conv-preview--empty' : ''}`}>
                      {conv.lastMessage || t('messaging.newConversation')}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="messaging-unread-badge">{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Only verified notice */}
      {user && !canUseMessages && (
        <p className="messaging-notice">{t('messaging.onlyVerified')}</p>
      )}
    </div>
  );
}

function getDeliveryStatusLabel(status: DeliveryStatus, t: (key: string) => string): string {
  switch (status) {
    case 'sending':
      return t('messaging.statusSending');
    case 'failed':
      return t('messaging.statusFailed');
    default:
      return t('messaging.statusSent');
  }
}

function formatConvTime(dateStr: string, t: (key: string) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return t('messaging.yesterday');
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
