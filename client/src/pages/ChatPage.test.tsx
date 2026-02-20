import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatPage } from './ChatPage';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock child components to isolate page logic
vi.mock('../components/chat', () => ({
  MessageList: ({ messages, streamingMessage, isStreaming }: any) => (
    <div data-testid="message-list" data-count={messages?.length ?? 0} data-streaming={isStreaming}>
      {streamingMessage && <span data-testid="streaming-msg">{streamingMessage}</span>}
    </div>
  ),
  ChatInput: ({ onSend, disabled, placeholder }: any) => (
    <div data-testid="chat-input" data-disabled={disabled} data-placeholder={placeholder}>
      <button onClick={() => onSend('test message')}>Send</button>
    </div>
  ),
  TokenUsageCard: ({ tokenUsage, onDismiss }: any) => (
    <div data-testid="token-usage-card">
      <span>{tokenUsage.costUsd}</span>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
  ToolApprovalCard: ({ approval, onApprove, onReject }: any) => (
    <div data-testid="tool-approval-card">
      <span>{approval.name}</span>
      <button onClick={() => onApprove(approval.toolId)}>Approve</button>
      <button onClick={() => onReject(approval.toolId)}>Reject</button>
    </div>
  ),
  ContextFileSheet: () => <div data-testid="context-file-sheet" />,
  PromptTemplateSheet: () => <div data-testid="prompt-template-sheet" />,
}));

vi.mock('../components/actions', () => ({
  QuickActions: () => <div data-testid="quick-actions" />,
}));

vi.mock('../components/AppLayout', () => ({
  AppLayout: ({ children }: any) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('../components/ConversationSelector', () => ({
  ConversationSelector: () => <div data-testid="conversation-selector" />,
}));

// Mock stores
const mockSendMessage = vi.fn();
const mockClearError = vi.fn();
const mockDismissTokenUsage = vi.fn();
const mockRetryConversation = vi.fn();
const mockApproveToolUse = vi.fn();
const mockRejectToolUse = vi.fn();
const mockCreateConversation = vi.fn();
const mockLoadConversations = vi.fn();
const mockLoadConversation = vi.fn();
const mockClearUnread = vi.fn();
const mockSetSelectedFiles = vi.fn();

let mockChatStoreState: Record<string, any> = {};

vi.mock('../stores/chat', () => ({
  useChatStore: Object.assign(
    (selector?: (state: any) => any) => {
      const state = {
        getWorkspaceChat: vi.fn().mockImplementation((_wsId: string) => {
          return mockChatStoreState.wsChat || {
            messages: [],
            streamingMessage: '',
            isStreaming: false,
            isSending: false,
            lastTokenUsage: null,
            showTokenUsage: false,
            pendingApprovals: [],
            currentConversationId: null,
            conversations: [],
            selectedFiles: [],
          };
        }),
        sendMessage: mockSendMessage,
        clearError: mockClearError,
        dismissTokenUsage: mockDismissTokenUsage,
        retryConversation: mockRetryConversation,
        approveToolUse: mockApproveToolUse,
        rejectToolUse: mockRejectToolUse,
        createConversation: mockCreateConversation,
        loadConversations: mockLoadConversations,
        loadConversation: mockLoadConversation,
        clearUnread: mockClearUnread,
        setSelectedFiles: mockSetSelectedFiles,
        error: mockChatStoreState.error || null,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: vi.fn().mockReturnValue({
        devQuickPair: vi.fn(),
      }),
    }
  ),
}));

let mockWorkspaceStoreState: Record<string, any> = {};

vi.mock('../stores/workspace', () => ({
  useWorkspaceStore: (selector?: (state: any) => any) => {
    const state = {
      selectedWorkspaceId: mockWorkspaceStoreState.selectedWorkspaceId ?? null,
      selectedWorkspace: () => mockWorkspaceStoreState.workspace ?? null,
      loadWorkspaces: vi.fn(),
      loadGitStatus: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

let mockAuthStoreState: Record<string, any> = {};

vi.mock('../stores/auth', () => ({
  useAuthStore: Object.assign(
    (selector?: (state: any) => any) => {
      const state = {
        isAuthenticated: mockAuthStoreState.isAuthenticated ?? true,
        checkAuth: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
    {
      getState: vi.fn().mockReturnValue({
        devQuickPair: vi.fn().mockResolvedValue(undefined),
      }),
    }
  ),
}));

function renderChatPage() {
  return render(
    <MemoryRouter>
      <ChatPage />
    </MemoryRouter>
  );
}

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatStoreState = {};
    mockWorkspaceStoreState = {};
    mockAuthStoreState = { isAuthenticated: true };
  });

  it('shows "No workspace selected" when no workspace is selected', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = null;
    renderChatPage();

    expect(screen.getByText('No workspace selected')).toBeInTheDocument();
    expect(screen.getByText('Add Workspace')).toBeInTheDocument();
  });

  it('navigates to /repos when "Add Workspace" is clicked', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = null;
    renderChatPage();

    fireEvent.click(screen.getByText('Add Workspace'));
    expect(mockNavigate).toHaveBeenCalledWith('/repos');
  });

  it('renders header with workspace name when workspace is selected', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'My Project', path: '/tmp/project' };
    renderChatPage();

    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('shows error banner when error is set', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    mockChatStoreState.error = 'Something went wrong';
    renderChatPage();

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows Retry button when error and conversationId exist', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    mockChatStoreState.error = 'Connection lost';
    mockChatStoreState.wsChat = {
      messages: [],
      streamingMessage: '',
      isStreaming: false,
      isSending: false,
      lastTokenUsage: null,
      showTokenUsage: false,
      pendingApprovals: [],
      currentConversationId: 'conv-1',
      conversations: [],
      selectedFiles: [],
    };
    renderChatPage();

    expect(screen.getByText('Retry')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(mockClearError).toHaveBeenCalled();
    expect(mockRetryConversation).toHaveBeenCalledWith('ws-1', 'conv-1');
  });

  it('disables ChatInput when streaming', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    mockChatStoreState.wsChat = {
      messages: [],
      streamingMessage: 'partial response...',
      isStreaming: true,
      isSending: false,
      lastTokenUsage: null,
      showTokenUsage: false,
      pendingApprovals: [],
      currentConversationId: null,
      conversations: [],
      selectedFiles: [],
    };
    renderChatPage();

    const chatInput = screen.getByTestId('chat-input');
    expect(chatInput).toHaveAttribute('data-disabled', 'true');
  });

  it('renders MessageList component when workspace is selected', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    renderChatPage();

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  it('renders ChatInput component when workspace is selected', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    renderChatPage();

    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('calls sendMessage when message is submitted', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    renderChatPage();

    fireEvent.click(screen.getByText('Send'));
    expect(mockSendMessage).toHaveBeenCalledWith('ws-1', 'test message', undefined);
  });

  it('shows ToolApprovalCard when there are pendingApprovals', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    mockChatStoreState.wsChat = {
      messages: [],
      streamingMessage: '',
      isStreaming: false,
      isSending: false,
      lastTokenUsage: null,
      showTokenUsage: false,
      pendingApprovals: [
        {
          toolId: 'tool-1',
          name: 'write_file',
          input: { path: '/tmp/test.ts' },
          title: 'Write File',
          description: 'Write to /tmp/test.ts',
          risk: 'medium',
        },
      ],
      currentConversationId: null,
      conversations: [],
      selectedFiles: [],
    };
    renderChatPage();

    expect(screen.getByTestId('tool-approval-card')).toBeInTheDocument();
    expect(screen.getByText('write_file')).toBeInTheDocument();
  });

  it('shows TokenUsageCard when showTokenUsage and lastTokenUsage are set', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockWorkspaceStoreState.workspace = { id: 'ws-1', name: 'Test', path: '/tmp' };
    mockChatStoreState.wsChat = {
      messages: [],
      streamingMessage: '',
      isStreaming: false,
      isSending: false,
      lastTokenUsage: {
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheCreationTokens: 100,
        costUsd: 0.05,
      },
      showTokenUsage: true,
      pendingApprovals: [],
      currentConversationId: null,
      conversations: [],
      selectedFiles: [],
    };
    renderChatPage();

    expect(screen.getByTestId('token-usage-card')).toBeInTheDocument();
  });
});
