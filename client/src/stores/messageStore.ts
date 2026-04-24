import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { messageApi } from '../services/api';

export type DeliveryStatus = 'sending' | 'sent' | 'failed';

export interface Conversation {
  id: number;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface DirectMessage {
  id: number | null;
  clientMessageId?: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  isMine: boolean;
  deliveryStatus?: DeliveryStatus;
}

interface MessageState {
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: DirectMessage[];
  totalUnread: number;
  nextCursor: string | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  pendingSendCount: number;

  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: number, loadMore?: boolean) => Promise<void>;
  sendMessage: (conversationId: number, content: string) => Promise<void>;
  startConversation: (targetUserId: string) => Promise<number>;
  markRead: (conversationId: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  setActiveConversation: (id: number | null) => void;
  addIncomingMessage: (msg: DirectMessage & { conversationId: number; senderAvatar?: string }) => void;
  updateUnreadFromSignalR: (conversationId: number, totalUnread: number) => void;
  reset: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  totalUnread: 0,
  nextCursor: null,
  isLoadingConversations: false,
  isLoadingMessages: false,
  pendingSendCount: 0,

  fetchConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const res = await messageApi.getConversations();
      set({ conversations: res.data });
    } catch {
      /* silent */
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  fetchMessages: async (conversationId: number, loadMore = false) => {
    const { nextCursor, messages } = get();
    if (loadMore && !nextCursor) return;

    set({ isLoadingMessages: true });
    try {
      const params: { before?: number; limit?: number } = { limit: 30 };
      if (loadMore && nextCursor) params.before = Number(nextCursor);

      const res = await messageApi.getMessages(conversationId, params);
      const newMessages: DirectMessage[] = res.data.items.map((message: DirectMessage) => ({
        ...message,
        deliveryStatus: message.isMine ? 'sent' : undefined,
      }));
      const cursor: string | null = res.data.nextCursor;

      set({
        messages: loadMore ? [...messages, ...newMessages] : newMessages,
        nextCursor: cursor,
        activeConversationId: conversationId,
      });
    } catch {
      /* silent */
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (conversationId: number, content: string) => {
    const user = useAuthStore.getState().user;
    const clientMessageId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const optimisticSentAt = new Date().toISOString();
    const optimisticMessage: DirectMessage = {
      id: null,
      clientMessageId,
      senderId: user?.id ?? '',
      senderName: user?.fullName ?? '',
      content,
      sentAt: optimisticSentAt,
      isRead: true,
      isMine: true,
      deliveryStatus: 'sending',
    };

    set((state) => ({
      pendingSendCount: state.pendingSendCount + 1,
      messages: state.activeConversationId === conversationId
        ? [optimisticMessage, ...state.messages]
        : state.messages,
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: content, lastMessageAt: optimisticSentAt }
          : c
      ),
    }));

    try {
      const res = await messageApi.sendMessage(conversationId, { content, clientMessageId });
      const msg: DirectMessage = {
        ...res.data,
        deliveryStatus: 'sent',
      };

      // Show spam warning toast if approaching limit
      if (res.data.spamWarning) {
        const { default: toast } = await import('react-hot-toast');
        toast(res.data.spamWarning, { icon: '⚠️', duration: 6000 });
      }

      set((state) => {
        const hasPendingMessage = state.messages.some((message) => message.clientMessageId === clientMessageId);

        return {
          pendingSendCount: Math.max(0, state.pendingSendCount - 1),
          messages: hasPendingMessage
            ? state.messages.map((message) =>
                message.clientMessageId === clientMessageId
                  ? { ...msg, clientMessageId, deliveryStatus: 'sent' }
                  : message
              )
            : state.activeConversationId === conversationId
              ? [{ ...msg, clientMessageId, deliveryStatus: 'sent' }, ...state.messages]
              : state.messages,
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: msg.content, lastMessageAt: msg.sentAt }
              : c
          ),
        };
      });
    } catch {
      set((state) => ({
        pendingSendCount: Math.max(0, state.pendingSendCount - 1),
        messages: state.messages.map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, deliveryStatus: 'failed' }
            : message
        ),
      }));
    }
  },

  startConversation: async (targetUserId: string) => {
    const res = await messageApi.startConversation(targetUserId);
    const conversationId: number = res.data.conversationId;
    await get().fetchConversations();
    return conversationId;
  },

  markRead: async (conversationId: number) => {
    try {
      await messageApi.markRead(conversationId);
      set((state) => ({
        messages: state.messages.map((m) =>
          !m.isMine ? { ...m, isRead: true } : m
        ),
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
        totalUnread: Math.max(0, state.totalUnread - (
          state.conversations.find((c) => c.id === conversationId)?.unreadCount || 0
        )),
      }));
    } catch {
      /* silent */
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await messageApi.getUnreadCount();
      set({ totalUnread: res.data.totalUnread });
    } catch {
      /* silent */
    }
  },

  setActiveConversation: (id: number | null) => {
    set({ activeConversationId: id, messages: [], nextCursor: null });
  },

  addIncomingMessage: (msg) => {
    const { activeConversationId, conversations } = get();
    const hasConversation = conversations.some((c) => c.id === msg.conversationId);

    set((state) => ({
      totalUnread: msg.conversationId === activeConversationId
        ? state.totalUnread
        : state.totalUnread + 1,
      conversations: hasConversation
        ? state.conversations.map((c) =>
            c.id === msg.conversationId
              ? {
                  ...c,
                  lastMessage: msg.content,
                  lastMessageAt: msg.sentAt,
                  unreadCount: msg.conversationId === activeConversationId
                    ? c.unreadCount
                    : c.unreadCount + 1,
                }
              : c
          )
        : state.conversations,
    }));

    if (!hasConversation) {
      void get().fetchConversations();
    }

    // If this conversation is active, add message to list
    if (msg.conversationId === activeConversationId) {
      set((state) => ({
        messages: [{
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.senderName,
          content: msg.content,
          sentAt: msg.sentAt,
          isRead: false,
          isMine: false,
          deliveryStatus: undefined,
        }, ...state.messages],
      }));
    }
  },

  updateUnreadFromSignalR: (_conversationId: number, totalUnread: number) => {
    set({ totalUnread });
  },

  reset: () => {
    set({
      conversations: [],
      activeConversationId: null,
      messages: [],
      totalUnread: 0,
      nextCursor: null,
      pendingSendCount: 0,
    });
  },
}));
