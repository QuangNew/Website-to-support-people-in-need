import { create } from 'zustand';
import { chatbotApi } from '../services/api';

const CHAT_STORAGE_KEY = 'chatpanel_messages';
const CHAT_CONV_KEY = 'chatpanel_conversation_id';
const MAX_CACHED_MESSAGES = 100;
const IMAGE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  hasSafetyWarning?: boolean;
  imageDataUrl?: string;
}

export interface PendingChatImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
}

interface SendChatMessageOptions {
  content: string;
  image: PendingChatImage | null;
  welcomeMessage: ChatMessage;
  createConversationError: string;
  generalError: string;
  emptyResponseMessage: string;
}

interface HydrateConversationOptions {
  isAuthenticated: boolean;
  welcomeMessage: ChatMessage;
}

interface ChatState {
  messages: ChatMessage[];
  conversationId: number | null;
  isTyping: boolean;
  isLoadingHistory: boolean;
  sessionId: number;
  hydratedConversationId: number | null;
  hydratingConversationId: number | null;

  ensureWelcome: (welcomeMessage: ChatMessage) => void;
  resetChat: (welcomeMessage: ChatMessage) => void;
  hydrateConversation: (options: HydrateConversationOptions) => Promise<void>;
  sendMessage: (options: SendChatMessageOptions) => Promise<void>;
}

export function isImageExpired(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() > IMAGE_EXPIRY_MS;
}

function cleanExpiredImages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.imageDataUrl && isImageExpired(message.timestamp)) {
      return { ...message, imageDataUrl: undefined };
    }

    return message;
  });
}

function readStoredMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? cleanExpiredImages(parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function readStoredConversationId(): number | null {
  try {
    const stored = localStorage.getItem(CHAT_CONV_KEY);
    if (!stored) return null;

    const parsed = Number.parseInt(stored, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-MAX_CACHED_MESSAGES)));
  } catch {
    /* ignore storage failures */
  }
}

function persistConversationId(conversationId: number | null) {
  try {
    if (conversationId === null) {
      localStorage.removeItem(CHAT_CONV_KEY);
    } else {
      localStorage.setItem(CHAT_CONV_KEY, String(conversationId));
    }
  } catch {
    /* ignore storage failures */
  }
}

function clearChatStorage() {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(CHAT_CONV_KEY);
  } catch {
    /* ignore storage failures */
  }
}

function getResponseStatus(error: unknown): number | undefined {
  const response = (error as { response?: { status?: unknown } } | null)?.response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

function getResponseMessage(error: unknown): string | undefined {
  const response = (error as { response?: { data?: { message?: unknown } } } | null)?.response;
  const message = response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : undefined;
}

function getBotContent(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as Record<string, unknown>;
  const value = payload.content ?? payload.Content ?? payload.response ?? payload.Response ?? payload.text ?? payload.Text;
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getSafetyWarning(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const payload = data as Record<string, unknown>;
  return readBoolean(payload.hasSafetyWarning ?? payload.HasSafetyWarning);
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toHistoryMessages(data: unknown): ChatMessage[] {
  if (!Array.isArray(data)) return [];

  return data.map((message) => {
    const payload = message as Record<string, unknown>;
    return {
      id: Number(payload.id ?? payload.Id ?? Date.now()),
      role: readBoolean(payload.isBotMessage ?? payload.IsBotMessage) ? 'assistant' : 'user',
      content: String(payload.content ?? payload.Content ?? ''),
      timestamp: String(payload.sentAt ?? payload.SentAt ?? new Date().toISOString()),
      hasSafetyWarning: readBoolean(payload.hasSafetyWarning ?? payload.HasSafetyWarning),
    };
  });
}

export const useChatStore = create<ChatState>((set, get) => {
  const appendMessage = (message: ChatMessage, fallbackWelcome?: ChatMessage) => {
    const currentMessages = get().messages;
    const baseMessages = currentMessages.length > 0
      ? currentMessages
      : fallbackWelcome
        ? [fallbackWelcome]
        : [];
    const messages = [...baseMessages, message];
    persistMessages(messages);
    set({ messages });
  };

  const ensureConversation = async (sessionId: number, forceNew = false): Promise<number | null> => {
    const existingConversationId = get().conversationId;
    if (!forceNew && existingConversationId) {
      return existingConversationId;
    }

    const response = await chatbotApi.createConversation();
    if (get().sessionId !== sessionId) {
      return null;
    }

    const payload = response.data as { id?: unknown; Id?: unknown };
    const conversationId = Number(payload.id ?? payload.Id);
    if (!Number.isFinite(conversationId)) {
      return null;
    }

    persistConversationId(conversationId);
    set({ conversationId });
    return conversationId;
  };

  return {
    messages: readStoredMessages(),
    conversationId: readStoredConversationId(),
    isTyping: false,
    isLoadingHistory: false,
    sessionId: 0,
    hydratedConversationId: null,
    hydratingConversationId: null,

    ensureWelcome: (welcomeMessage) => {
      if (get().messages.length > 0) return;

      const messages = [welcomeMessage];
      persistMessages(messages);
      set({ messages });
    },

    resetChat: (welcomeMessage) => {
      clearChatStorage();
      const messages = [welcomeMessage];
      persistMessages(messages);
      set((state) => ({
        messages,
        conversationId: null,
        isTyping: false,
        isLoadingHistory: false,
        sessionId: state.sessionId + 1,
        hydratedConversationId: null,
        hydratingConversationId: null,
      }));
    },

    hydrateConversation: async ({ isAuthenticated, welcomeMessage }) => {
      const state = get();
      const conversationId = state.conversationId;

      if (!isAuthenticated || conversationId === null) {
        if (conversationId === null) {
          set({ hydratedConversationId: null, hydratingConversationId: null });
        }
        return;
      }

      if (
        state.hydratedConversationId === conversationId
        || state.hydratingConversationId === conversationId
        || state.messages.length > 1
      ) {
        return;
      }

      const sessionId = state.sessionId;
      set({ isLoadingHistory: true, hydratingConversationId: conversationId });

      try {
        const response = await chatbotApi.getMessages(conversationId);
        if (get().sessionId !== sessionId || get().conversationId !== conversationId) {
          return;
        }

        const historyMessages = toHistoryMessages(response.data);
        const messages = historyMessages.length > 0 ? historyMessages : [welcomeMessage];
        persistMessages(messages);
        set({ messages, hydratedConversationId: conversationId });
      } catch (error) {
        if (get().sessionId !== sessionId || get().conversationId !== conversationId) {
          return;
        }

        if (getResponseStatus(error) === 404) {
          persistConversationId(null);
          const messages = [welcomeMessage];
          persistMessages(messages);
          set({ conversationId: null, messages, hydratedConversationId: null });
        }
      } finally {
        if (get().sessionId === sessionId && get().hydratingConversationId === conversationId) {
          set({ isLoadingHistory: false, hydratingConversationId: null });
        }
      }
    },

    sendMessage: async ({
      content,
      image,
      welcomeMessage,
      createConversationError,
      generalError,
      emptyResponseMessage,
    }) => {
      if (get().isTyping) return;

      const sessionId = get().sessionId;
      const userMessage: ChatMessage = {
        id: Date.now(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        imageDataUrl: image?.dataUrl,
      };

      appendMessage(userMessage, welcomeMessage);
      set({ isTyping: true });

      try {
        let conversationId = await ensureConversation(sessionId);
        if (get().sessionId !== sessionId) return;
        if (!conversationId) {
          throw new Error(createConversationError);
        }

        const sendData: { content: string; imageBase64?: string; imageMimeType?: string } = { content };
        if (image) {
          sendData.imageBase64 = image.base64;
          sendData.imageMimeType = image.mimeType;
        }

        let response;
        try {
          response = await chatbotApi.sendMessage(conversationId, sendData);
        } catch (sendError) {
          if (getResponseStatus(sendError) !== 404) {
            throw sendError;
          }

          persistConversationId(null);
          set({ conversationId: null, hydratedConversationId: null });
          conversationId = await ensureConversation(sessionId, true);
          if (get().sessionId !== sessionId) return;
          if (!conversationId) {
            throw new Error(createConversationError, { cause: sendError });
          }

          response = await chatbotApi.sendMessage(conversationId, sendData);
        }

        if (get().sessionId !== sessionId) return;

        const assistantMessage: ChatMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: getBotContent(response.data, emptyResponseMessage),
          timestamp: new Date().toISOString(),
          hasSafetyWarning: getSafetyWarning(response.data),
        };

        appendMessage(assistantMessage);
      } catch (error) {
        if (get().sessionId !== sessionId) return;

        const message = getResponseMessage(error)
          || (error instanceof Error ? error.message : generalError);
        appendMessage({
          id: Date.now() + 1,
          role: 'assistant',
          content: `Warning: ${message}`,
          timestamp: new Date().toISOString(),
        });
      } finally {
        if (get().sessionId === sessionId) {
          set({ isTyping: false });
        }
      }
    },
  };
});
