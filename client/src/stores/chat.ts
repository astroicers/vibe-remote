// Chat Store

import { create } from 'zustand';
import { chat, type Conversation, type Message } from '../services/api';
import { ws, sendChatMessage } from '../services/websocket';

interface ChatMessage extends Message {
  isStreaming?: boolean;
  streamedContent?: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Streaming state
  streamingMessage: string;
  isStreaming: boolean;

  // Actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: () => Promise<string>;
  sendMessage: (content: string, selectedFiles?: string[]) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => {
  // Setup WebSocket handlers
  const setupWSHandlers = () => {
    ws.on('conversation_created', (data) => {
      const conversationId = data.conversationId as string;
      set((state) => ({
        currentConversation: state.currentConversation || {
          id: conversationId,
          workspace_id: '',
          title: 'New Conversation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }));
    });

    ws.on('chat_start', () => {
      set({ isStreaming: true, streamingMessage: '' });
    });

    ws.on('chat_chunk', (data) => {
      const text = data.text as string;
      set((state) => ({
        streamingMessage: state.streamingMessage + text,
      }));
    });

    ws.on('tool_use', (data) => {
      console.log('Tool use:', data.tool, data.input);
    });

    ws.on('tool_result', (data) => {
      console.log('Tool result:', data.tool, data.isError ? 'ERROR' : 'OK');
    });

    ws.on('chat_complete', (_data) => {
      const { streamingMessage } = get();

      // Add completed message to messages
      const newMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: streamingMessage,
        created_at: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, newMessage],
        streamingMessage: '',
        isStreaming: false,
        isSending: false,
      }));

      // Refresh conversations list
      get().loadConversations();
    });

    ws.on('chat_error', (data) => {
      set({
        error: data.error as string,
        isStreaming: false,
        isSending: false,
      });
    });

    ws.on('diff_ready', (data) => {
      console.log('Diff ready:', data.files);
      // Could trigger navigation to diff page or show notification
    });
  };

  // Setup handlers when module loads
  setupWSHandlers();

  return {
    conversations: [],
    currentConversation: null,
    messages: [],
    isLoading: false,
    isSending: false,
    error: null,
    streamingMessage: '',
    isStreaming: false,

    loadConversations: async () => {
      set({ isLoading: true, error: null });
      try {
        const conversations = await chat.listConversations();
        set({ conversations, isLoading: false });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load conversations',
        });
      }
    },

    loadConversation: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        const data = await chat.getConversation(id);
        set({
          currentConversation: data,
          messages: data.messages,
          isLoading: false,
        });
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load conversation',
        });
      }
    },

    createConversation: async () => {
      const conversation = await chat.createConversation({});
      set({
        currentConversation: conversation,
        messages: [],
      });
      return conversation.id;
    },

    sendMessage: (content: string, selectedFiles?: string[]) => {
      const { currentConversation } = get();

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, userMessage],
        isSending: true,
        error: null,
      }));

      // Send via WebSocket
      sendChatMessage(content, currentConversation?.id, selectedFiles);
    },

    clearError: () => set({ error: null }),
  };
});
