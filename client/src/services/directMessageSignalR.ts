import * as signalR from '@microsoft/signalr';
import { useMessageStore } from '../stores/messageStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const HUB_URL = API_BASE_URL.replace(/\/api\/?$/, '') + '/hubs/direct-messages';

let connection: signalR.HubConnection | null = null;

export function startDirectMessageConnection() {
  if (connection) return;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, { withCredentials: true })
    .withAutomaticReconnect()
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

    // Auto-mark read if currently viewing this conversation
    if (store.activeConversationId === data.conversationId) {
      store.markRead(data.conversationId);
    }
  });

  connection.on('UnreadCountChanged', (data: {
    conversationId: number;
    totalUnread: number;
  }) => {
    useMessageStore.getState().updateUnreadFromSignalR(data.conversationId, data.totalUnread);
  });

  connection.onreconnected(async () => {
    const store = useMessageStore.getState();

    await store.fetchConversations();
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
}
