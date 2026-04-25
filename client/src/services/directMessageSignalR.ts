import * as signalR from '@microsoft/signalr';
import { useMessageStore } from '../stores/messageStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const HUB_URL = API_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/direct-messages';

let connection: signalR.HubConnection | null = null;

// Debounce fetchConversations to avoid hammering the DB when multiple messages arrive quickly
let fetchConversationsTimer: ReturnType<typeof setTimeout> | undefined;
function debouncedFetchConversations(delayMs = 1000) {
  if (fetchConversationsTimer) clearTimeout(fetchConversationsTimer);
  fetchConversationsTimer = setTimeout(() => {
    void useMessageStore.getState().fetchConversations();
  }, delayMs);
}

// Debounce markRead to batch multiple rapid reads
let markReadTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
function debouncedMarkRead(conversationId: number, delayMs = 800) {
  const existing = markReadTimers.get(conversationId);
  if (existing) clearTimeout(existing);
  markReadTimers.set(conversationId, setTimeout(() => {
    void useMessageStore.getState().markRead(conversationId);
    markReadTimers.delete(conversationId);
  }, delayMs));
}

export function startDirectMessageConnection() {
  if (connection) return;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, { withCredentials: true })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Progressive backoff
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on('ReceiveDirectMessage', (data: {
    messageId: number;
    conversationId: number;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    sentAt: string;
  }) => {
    const store = useMessageStore.getState();
    store.addIncomingMessage({
      id: data.messageId,
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      content: data.content,
      sentAt: data.sentAt,
      isRead: false,
      isMine: false,
    });

    // Auto-mark read if currently viewing this conversation (debounced)
    if (store.activeConversationId === data.conversationId) {
      debouncedMarkRead(data.conversationId);
    }
  });

  connection.on('UnreadCountChanged', (data: {
    conversationId: number;
    totalUnread: number;
  }) => {
    useMessageStore.getState().updateUnreadFromSignalR(data.conversationId, data.totalUnread);
  });

  // Typing indicator support
  connection.on('UserTyping', (data: {
    conversationId: number;
    userId: string;
    userName: string;
  }) => {
    useMessageStore.getState().setTypingUser(data.conversationId, data.userId, data.userName);
  });

  connection.onreconnected(async () => {
    const store = useMessageStore.getState();

    // Debounced to avoid hammering DB after reconnect
    debouncedFetchConversations(500);
    await store.fetchUnreadCount();

    if (store.activeConversationId) {
      await store.fetchMessages(store.activeConversationId);
    }
  });

  connection.start().catch((err) => {
    console.error('DirectMessage SignalR connection error:', err);
    connection = null;
  });
}

export function stopDirectMessageConnection() {
  if (connection) {
    connection.stop();
    connection = null;
  }
  // Clean up timers
  if (fetchConversationsTimer) clearTimeout(fetchConversationsTimer);
  markReadTimers.forEach((timer) => clearTimeout(timer));
  markReadTimers.clear();
}

/** Send typing indicator to the server. Call on user keystroke (debounced externally). */
export function sendTypingIndicator(conversationId: number) {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    connection.send('Typing', conversationId).catch(() => {
      // Silent — typing indicator is best-effort
    });
  }
}
