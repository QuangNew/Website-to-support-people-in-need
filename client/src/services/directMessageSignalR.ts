import * as signalR from '@microsoft/signalr';
import { useMessageStore } from '../stores/messageStore';
import { getSignalRToken } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const HUB_URL = API_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/direct-messages';

let connection: signalR.HubConnection | null = null;
let isConnecting = false;

// Debounce fetchConversations to avoid hammering the DB when multiple messages arrive quickly
let fetchConversationsTimer: ReturnType<typeof setTimeout> | undefined;
function debouncedFetchConversations(delayMs = 1000) {
  if (fetchConversationsTimer) clearTimeout(fetchConversationsTimer);
  fetchConversationsTimer = setTimeout(() => {
    void useMessageStore.getState().fetchConversations();
  }, delayMs);
}

// Debounce markRead to batch multiple rapid reads
const markReadTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
function debouncedMarkRead(conversationId: number, delayMs = 800) {
  const existing = markReadTimers.get(conversationId);
  if (existing) clearTimeout(existing);
  markReadTimers.set(conversationId, setTimeout(() => {
    void useMessageStore.getState().markRead(conversationId);
    markReadTimers.delete(conversationId);
  }, delayMs));
}

export function startDirectMessageConnection() {
  // Prevent duplicate connection attempts
  if (connection || isConnecting) return;
  isConnecting = true;

  console.log('[SignalR] Starting DirectMessage connection to:', HUB_URL);

  const newConnection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      // Pass the JWT via query string for WebSocket auth.
      // Cross-origin WebSocket connections cannot reliably send HttpOnly cookies,
      // so accessTokenFactory is the official Microsoft-recommended approach.
      // The backend reads this from Request.Query["access_token"] in OnMessageReceived.
      accessTokenFactory: () => getSignalRToken(),
      // Still send cookies as a fallback (works for same-origin / dev proxy).
      withCredentials: true,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Progressive backoff
    .configureLogging(signalR.LogLevel.Information)
    .build();

  // ── Incoming message handler ──
  newConnection.on('ReceiveDirectMessage', (data: {
    messageId: number;
    conversationId: number;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    sentAt: string;
  }) => {
    console.log('[SignalR] ReceiveDirectMessage:', data.conversationId, 'from:', data.senderId);

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
      isMine: false, // addIncomingMessage will correct this based on senderId
    });

    // Auto-mark read if currently viewing this conversation (debounced)
    if (store.activeConversationId === data.conversationId) {
      debouncedMarkRead(data.conversationId);
    }
  });

  newConnection.on('UnreadCountChanged', (data: {
    conversationId: number;
    totalUnread: number;
  }) => {
    useMessageStore.getState().updateUnreadFromSignalR(data.conversationId, data.totalUnread);
  });

  // Typing indicator support
  newConnection.on('UserTyping', (data: {
    conversationId: number;
    userId: string;
    userName: string;
  }) => {
    useMessageStore.getState().setTypingUser(data.conversationId, data.userId, data.userName);
  });

  newConnection.onreconnecting((error) => {
    console.warn('[SignalR] Reconnecting...', error?.message);
  });

  newConnection.onreconnected(async (connectionId) => {
    console.log('[SignalR] Reconnected with ID:', connectionId);
    const store = useMessageStore.getState();

    // Debounced to avoid hammering DB after reconnect
    debouncedFetchConversations(500);
    await store.fetchUnreadCount();

    if (store.activeConversationId) {
      await store.fetchMessages(store.activeConversationId);
    }
  });

  newConnection.onclose((error) => {
    console.warn('[SignalR] Connection closed', error?.message);
    connection = null;
    isConnecting = false;
  });

  newConnection.start()
    .then(() => {
      console.log('[SignalR] Connected successfully. State:', newConnection.state);
      connection = newConnection;
      isConnecting = false;
    })
    .catch((err) => {
      console.error('[SignalR] Connection failed:', err);
      isConnecting = false;
      // Don't set connection — it failed. Automatic reconnect won't work
      // because the initial start failed. Retry on next auth state change.
    });
}

export function stopDirectMessageConnection() {
  if (connection) {
    console.log('[SignalR] Stopping DirectMessage connection');
    connection.stop();
    connection = null;
  }
  isConnecting = false;
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

/** Check if SignalR is currently connected (useful for debugging) */
export function isDirectMessageConnected(): boolean {
  return connection?.state === signalR.HubConnectionState.Connected;
}
