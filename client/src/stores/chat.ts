// Chat Store

import { create } from 'zustand';
import { chat, type Conversation, type Message } from '../services/api';
import { ws, sendChatMessage } from '../services/websocket';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export interface PendingToolApproval {
  toolId: string;
  name: string;
  input: Record<string, unknown>;
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

interface ChatMessage extends Message {
  isStreaming?: boolean;
  streamedContent?: string;
  tokenUsage?: TokenUsage;
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

  // Token usage from last completed message
  lastTokenUsage: TokenUsage | null;
  showTokenUsage: boolean;

  // Tool approval
  pendingApprovals: PendingToolApproval[];

  // Actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: () => Promise<string>;
  sendMessage: (content: string, selectedFiles?: string[]) => void;
  retryConversation: (conversationId: string) => void;
  clearError: () => void;
  dismissTokenUsage: () => void;
  approveToolUse: (toolId: string) => void;
  rejectToolUse: (toolId: string, reason?: string) => void;
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

    ws.on('chat_complete', (data) => {
      const { streamingMessage } = get();
      const tokenUsage = data.tokenUsage as TokenUsage | undefined;

      // Add completed message to messages
      const newMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: streamingMessage,
        created_at: new Date().toISOString(),
        tokenUsage,
      };

      set((state) => ({
        messages: [...state.messages, newMessage],
        streamingMessage: '',
        isStreaming: false,
        isSending: false,
        lastTokenUsage: tokenUsage || null,
        showTokenUsage: !!tokenUsage,
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

    ws.on('tool_approval_request', (data) => {
      const approval: PendingToolApproval = {
        toolId: data.toolId as string,
        name: data.name as string,
        input: data.input as Record<string, unknown>,
        title: data.title as string,
        description: data.description as string,
        risk: data.risk as 'low' | 'medium' | 'high',
      };
      set((state) => ({
        pendingApprovals: [...state.pendingApprovals, approval],
      }));
    });

    ws.on('tool_approval_confirmed', (data) => {
      const toolId = data.toolId as string;
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter((a) => a.toolId !== toolId),
      }));
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
    lastTokenUsage: null,
    showTokenUsage: false,
    pendingApprovals: [],

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

    dismissTokenUsage: () => set({ showTokenUsage: false }),

    retryConversation: (conversationId: string) => {
      set({ isSending: true, error: null });
      ws.send({
        type: 'chat_retry',
        conversationId,
      });
    },

    approveToolUse: (toolId: string) => {
      ws.send({
        type: 'tool_approval_response',
        toolId,
        approved: true,
      });
      // Optimistically remove from pending
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter((a) => a.toolId !== toolId),
      }));
    },

    rejectToolUse: (toolId: string, reason?: string) => {
      ws.send({
        type: 'tool_approval_response',
        toolId,
        approved: false,
        reason,
      });
      // Optimistically remove from pending
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter((a) => a.toolId !== toolId),
      }));
    },
  };
});
