// Chat Store - Per-workspace partitioned state

import { create } from 'zustand';
import { chat, type Conversation, type Message } from '../services/api';
import { ws, sendChatMessage } from '../services/websocket';
import { useWorkspaceStore } from './workspace';
import { useSettingsStore } from './settings';
import { useToastStore } from './toast';

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

interface WorkspaceChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: ChatMessage[];
  streamingMessage: string;
  isStreaming: boolean;
  isSending: boolean;
  lastTokenUsage: TokenUsage | null;
  showTokenUsage: boolean;
  pendingApprovals: PendingToolApproval[];
  unreadCount: number;
  selectedFiles: string[];
}

function createDefaultWorkspaceChatState(): WorkspaceChatState {
  return {
    conversations: [],
    currentConversationId: null,
    messages: [],
    streamingMessage: '',
    isStreaming: false,
    isSending: false,
    lastTokenUsage: null,
    showTokenUsage: false,
    pendingApprovals: [],
    unreadCount: 0,
    selectedFiles: [],
  };
}

interface ChatState {
  workspaceChats: Record<string, WorkspaceChatState>;
  error: string | null;

  getWorkspaceChat: (workspaceId: string) => WorkspaceChatState;

  // All actions take workspaceId
  loadConversations: (workspaceId: string) => Promise<void>;
  loadConversation: (workspaceId: string, conversationId: string) => Promise<void>;
  createConversation: (workspaceId: string) => Promise<string>;
  selectConversation: (workspaceId: string, conversationId: string) => void;
  sendMessage: (workspaceId: string, content: string, selectedFiles?: string[]) => void;
  retryConversation: (workspaceId: string, conversationId: string) => void;

  deleteConversation: (workspaceId: string, conversationId: string) => Promise<void>;

  setSelectedFiles: (workspaceId: string, files: string[]) => void;

  incrementUnread: (workspaceId: string) => void;
  clearUnread: (workspaceId: string) => void;

  clearError: () => void;
  dismissTokenUsage: (workspaceId: string) => void;
  approveToolUse: (toolId: string) => void;
  rejectToolUse: (toolId: string, reason?: string) => void;
}

function updateWorkspaceChat(
  state: ChatState,
  workspaceId: string,
  updater: (chat: WorkspaceChatState) => Partial<WorkspaceChatState>
): Partial<ChatState> {
  const current = state.workspaceChats[workspaceId] || createDefaultWorkspaceChatState();
  return {
    workspaceChats: {
      ...state.workspaceChats,
      [workspaceId]: { ...current, ...updater(current) },
    },
  };
}

// Prevent duplicate WS handler registration (React StrictMode double-mount)
let wsHandlersInitialized = false;

// Deduplicate messages by ID to prevent double-append from StrictMode or duplicate WS events
function addMessageIfNotExists(messages: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (messages.some((m) => m.id === msg.id)) return messages;
  return [...messages, msg];
}

export const useChatStore = create<ChatState>((set, get) => {
  // Setup WebSocket handlers
  const setupWSHandlers = () => {
    if (wsHandlersInitialized) return;
    wsHandlersInitialized = true;
    ws.on('conversation_created', (data) => {
      const workspaceId = data.workspaceId as string;
      const conversationId = data.conversationId as string;
      set((state) =>
        updateWorkspaceChat(state, workspaceId, (chat) => ({
          currentConversationId: chat.currentConversationId || conversationId,
        }))
      );
    });

    ws.on('chat_start', (data) => {
      const workspaceId = data.workspaceId as string;
      set((state) =>
        updateWorkspaceChat(state, workspaceId, () => ({
          isStreaming: true,
          streamingMessage: '',
        }))
      );
    });

    ws.on('chat_chunk', (data) => {
      const workspaceId = data.workspaceId as string;
      const text = data.text as string;
      set((state) =>
        updateWorkspaceChat(state, workspaceId, (chat) => ({
          streamingMessage: chat.streamingMessage + text,
        }))
      );
    });

    ws.on('tool_use', (data) => {
      console.log('Tool use:', data.tool, data.input);
    });

    ws.on('tool_result', (data) => {
      console.log('Tool result:', data.tool, data.isError ? 'ERROR' : 'OK');
    });

    ws.on('chat_complete', (data) => {
      const workspaceId = data.workspaceId as string;
      const tokenUsage = data.tokenUsage as TokenUsage | undefined;

      set((state) => {
        const wsChat = state.workspaceChats[workspaceId] || createDefaultWorkspaceChatState();
        const newMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: wsChat.streamingMessage,
          created_at: new Date().toISOString(),
          tokenUsage,
        };
        return updateWorkspaceChat(state, workspaceId, () => ({
          messages: addMessageIfNotExists(wsChat.messages, newMessage),
          streamingMessage: '',
          isStreaming: false,
          isSending: false,
          lastTokenUsage: tokenUsage || null,
          showTokenUsage: !!tokenUsage,
        }));
      });

      // Check if background workspace — cross-store access
      const selectedWsId = useWorkspaceStore.getState().selectedWorkspaceId;
      if (workspaceId !== selectedWsId) {
        get().incrementUnread(workspaceId);
      }

      // Refresh conversations list for this workspace
      get().loadConversations(workspaceId);
    });

    ws.on('chat_error', (data) => {
      const workspaceId = data.workspaceId as string;
      if (workspaceId) {
        set((state) =>
          updateWorkspaceChat(state, workspaceId, () => ({
            isStreaming: false,
            isSending: false,
          }))
        );
      }
      const errorMsg = data.error as string;
      set({ error: errorMsg });
      useToastStore.getState().addToast(errorMsg, 'error');
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
      // Tool approvals are per-device, not workspace-scoped
      // Add to all workspace chats that are currently streaming, or to the selected workspace
      const selectedWsId = useWorkspaceStore.getState().selectedWorkspaceId;
      if (selectedWsId) {
        set((state) =>
          updateWorkspaceChat(state, selectedWsId, (chat) => ({
            pendingApprovals: [...chat.pendingApprovals, approval],
          }))
        );
      }
    });

    ws.on('tool_approval_confirmed', (data) => {
      const toolId = data.toolId as string;
      // Remove from all workspace chats
      set((state) => {
        const updated: Record<string, WorkspaceChatState> = {};
        for (const [wsId, wsChat] of Object.entries(state.workspaceChats)) {
          const filtered = wsChat.pendingApprovals.filter((a) => a.toolId !== toolId);
          if (filtered.length !== wsChat.pendingApprovals.length) {
            updated[wsId] = { ...wsChat, pendingApprovals: filtered };
          } else {
            updated[wsId] = wsChat;
          }
        }
        return { workspaceChats: updated };
      });
    });
  };

  // Setup handlers when module loads
  setupWSHandlers();

  return {
    workspaceChats: {},
    error: null,

    getWorkspaceChat: (workspaceId: string) => {
      return get().workspaceChats[workspaceId] || createDefaultWorkspaceChatState();
    },

    loadConversations: async (workspaceId: string) => {
      try {
        const conversations = await chat.listConversations(workspaceId);
        set((state) => {
          const current = state.workspaceChats[workspaceId] || createDefaultWorkspaceChatState();
          // Auto-select the most recent conversation if none is selected
          const shouldAutoSelect = !current.currentConversationId && conversations.length > 0;
          return updateWorkspaceChat(state, workspaceId, () => ({
            conversations,
            ...(shouldAutoSelect ? { currentConversationId: conversations[0].id } : {}),
          }));
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load conversations';
        set({ error: msg });
        useToastStore.getState().addToast(msg, 'error');
      }
    },

    loadConversation: async (workspaceId: string, conversationId: string) => {
      try {
        const data = await chat.getConversation(conversationId);
        set((state) =>
          updateWorkspaceChat(state, workspaceId, () => ({
            currentConversationId: conversationId,
            messages: data.messages,
          }))
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load conversation';
        set({ error: msg });
        useToastStore.getState().addToast(msg, 'error');
      }
    },

    createConversation: async (workspaceId: string) => {
      try {
        // Refresh conversations from server to get latest titles
        await get().loadConversations(workspaceId);
        const wsChat = get().getWorkspaceChat(workspaceId);

        // Check if there's already an empty conversation (title still "New Conversation")
        const emptyConv = wsChat.conversations.find((c) => c.title === 'New Conversation');
        if (emptyConv) {
          // Reuse existing empty conversation
          set((state) =>
            updateWorkspaceChat(state, workspaceId, () => ({
              currentConversationId: emptyConv.id,
              messages: [],
            }))
          );
          return emptyConv.id;
        }

        const conversation = await chat.createConversation({ workspaceId });
        set((state) =>
          updateWorkspaceChat(state, workspaceId, (current) => ({
            conversations: [conversation, ...current.conversations],
            currentConversationId: conversation.id,
            messages: [],
          }))
        );
        return conversation.id;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to create conversation';
        set({ error: msg });
        useToastStore.getState().addToast(msg, 'error');
        throw error;
      }
    },

    selectConversation: (workspaceId: string, conversationId: string) => {
      set((state) =>
        updateWorkspaceChat(state, workspaceId, () => ({
          currentConversationId: conversationId,
        }))
      );
    },

    sendMessage: (workspaceId: string, content: string, selectedFiles?: string[]) => {
      const wsChat = get().getWorkspaceChat(workspaceId);
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      set((state) =>
        updateWorkspaceChat(state, workspaceId, (chat) => ({
          messages: addMessageIfNotExists(chat.messages, userMessage),
          isSending: true,
        }))
      );
      set({ error: null });
      // Send model key directly — server resolves to full model ID
      const modelSetting = useSettingsStore.getState().model;
      sendChatMessage(content, workspaceId, wsChat.currentConversationId || undefined, selectedFiles, modelSetting);
    },

    retryConversation: (workspaceId: string, conversationId: string) => {
      set((state) =>
        updateWorkspaceChat(state, workspaceId, () => ({
          isSending: true,
        }))
      );
      set({ error: null });
      ws.send({
        type: 'chat_retry',
        workspaceId,
        conversationId,
      });
    },

    deleteConversation: async (workspaceId: string, conversationId: string) => {
      try {
        await chat.deleteConversation(conversationId);
        set((state) => {
          const wsChat = state.workspaceChats[workspaceId] || createDefaultWorkspaceChatState();
          const remaining = wsChat.conversations.filter((c) => c.id !== conversationId);
          const needNewSelection = wsChat.currentConversationId === conversationId;
          return updateWorkspaceChat(state, workspaceId, () => ({
            conversations: remaining,
            ...(needNewSelection
              ? {
                  currentConversationId: remaining.length > 0 ? remaining[0].id : null,
                  messages: [],
                }
              : {}),
          }));
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to delete conversation';
        set({ error: msg });
        useToastStore.getState().addToast(msg, 'error');
      }
    },

    setSelectedFiles: (workspaceId: string, files: string[]) => {
      set((state) =>
        updateWorkspaceChat(state, workspaceId, () => ({
          selectedFiles: files,
        }))
      );
    },

    incrementUnread: (workspaceId: string) => {
      set((state) =>
        updateWorkspaceChat(state, workspaceId, (chat) => ({
          unreadCount: chat.unreadCount + 1,
        }))
      );
    },

    clearUnread: (workspaceId: string) => {
      set((state) =>
        updateWorkspaceChat(state, workspaceId, () => ({
          unreadCount: 0,
        }))
      );
    },

    clearError: () => set({ error: null }),

    dismissTokenUsage: (workspaceId: string) => {
      set((state) =>
        updateWorkspaceChat(state, workspaceId, () => ({
          showTokenUsage: false,
        }))
      );
    },

    approveToolUse: (toolId: string) => {
      ws.send({
        type: 'tool_approval_response',
        toolId,
        approved: true,
      });
      // Optimistically remove from all workspace chats
      set((state) => {
        const updated: Record<string, WorkspaceChatState> = {};
        for (const [wsId, wsChat] of Object.entries(state.workspaceChats)) {
          updated[wsId] = {
            ...wsChat,
            pendingApprovals: wsChat.pendingApprovals.filter((a) => a.toolId !== toolId),
          };
        }
        return { workspaceChats: updated };
      });
    },

    rejectToolUse: (toolId: string, reason?: string) => {
      ws.send({
        type: 'tool_approval_response',
        toolId,
        approved: false,
        reason,
      });
      // Optimistically remove from all workspace chats
      set((state) => {
        const updated: Record<string, WorkspaceChatState> = {};
        for (const [wsId, wsChat] of Object.entries(state.workspaceChats)) {
          updated[wsId] = {
            ...wsChat,
            pendingApprovals: wsChat.pendingApprovals.filter((a) => a.toolId !== toolId),
          };
        }
        return { workspaceChats: updated };
      });
    },
  };
});
