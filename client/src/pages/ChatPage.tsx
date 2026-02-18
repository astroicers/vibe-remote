import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageList, ChatInput, TokenUsageCard, ToolApprovalCard } from '../components/chat';
import { QuickActions } from '../components/actions';
import { useChatStore } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { useWorkspaceStore } from '../stores/workspace';

export function ChatPage() {
  const navigate = useNavigate();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const { isAuthenticated, checkAuth } = useAuthStore();
  const {
    messages,
    streamingMessage,
    isStreaming,
    isSending,
    error,
    sendMessage,
    clearError,
    lastTokenUsage,
    showTokenUsage,
    dismissTokenUsage,
    currentConversation,
    retryConversation,
    pendingApprovals,
    approveToolUse,
    rejectToolUse,
  } = useChatStore();
  const { loadActiveWorkspace, loadGitStatus } = useWorkspaceStore();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // For development, auto-login
      const devLogin = async () => {
        try {
          await useAuthStore.getState().devQuickPair('Vibe Remote Dev');
        } catch (e) {
          console.error('Dev login failed:', e);
        }
      };
      devLogin();
    }
  }, [isAuthenticated]);

  // Load workspace and git status
  useEffect(() => {
    if (isAuthenticated) {
      loadActiveWorkspace();
    }
  }, [isAuthenticated, loadActiveWorkspace]);

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-secondary">
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-tertiary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-text-secondary"
          >
            <path
              fillRule="evenodd"
              d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="flex-1 ml-3">
          <h1 className="text-base font-medium text-text-primary">Vibe Remote</h1>
          <p className="text-xs text-text-muted">New Conversation</p>
        </div>

        <button
          onClick={() => navigate('/repos')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-tertiary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-text-secondary"
          >
            <path
              fillRule="evenodd"
              d="M2.25 5.25a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v13.5a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V5.25Zm3.75.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM6 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM6 13.5a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-danger/20 text-danger text-sm flex items-center gap-2">
          <span className="flex-1">{error}</span>
          {currentConversation && (
            <button
              onClick={() => {
                clearError();
                retryConversation(currentConversation.id);
              }}
              className="px-3 py-1 bg-danger/30 hover:bg-danger/40 rounded-full text-xs font-medium transition-colors"
            >
              Retry
            </button>
          )}
          <button onClick={clearError} className="w-6 h-6 flex items-center justify-center text-danger hover:text-danger/80">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        streamingMessage={streamingMessage}
        isStreaming={isStreaming}
      />

      {/* Token Usage Card */}
      {showTokenUsage && lastTokenUsage && (
        <TokenUsageCard
          tokenUsage={lastTokenUsage}
          onDismiss={dismissTokenUsage}
        />
      )}

      {/* Pending Tool Approvals */}
      {pendingApprovals.map((approval) => (
        <ToolApprovalCard
          key={approval.toolId}
          approval={approval}
          onApprove={approveToolUse}
          onReject={rejectToolUse}
          isProcessing={isSending}
        />
      ))}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onQuickActions={() => {
          loadGitStatus();
          setShowQuickActions(true);
        }}
        disabled={isSending || isStreaming}
        placeholder={isStreaming ? 'AI is thinking...' : 'Type a message...'}
      />

      {/* Quick Actions Panel */}
      <QuickActions
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
      />

      {/* Bottom navigation */}
      <nav className="flex items-center justify-around h-14 border-t border-border bg-bg-secondary">
        <button className="flex flex-col items-center justify-center flex-1 h-full text-accent">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-0.5">Chat</span>
        </button>

        <button
          onClick={() => navigate('/diff')}
          className="flex flex-col items-center justify-center flex-1 h-full text-text-muted hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z"
              clipRule="evenodd"
            />
            <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
          </svg>
          <span className="text-xs mt-0.5">Diff</span>
        </button>

        <button
          onClick={() => navigate('/tasks')}
          className="flex flex-col items-center justify-center flex-1 h-full text-text-muted hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M2.625 6.75a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0A.75.75 0 0 1 8.25 6h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75ZM2.625 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 12a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 7.5 12Zm-4.875 5.25a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-0.5">Tasks</span>
        </button>

        <button
          onClick={() => navigate('/settings')}
          className="flex flex-col items-center justify-center flex-1 h-full text-text-muted hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-0.5">Settings</span>
        </button>
      </nav>
    </div>
  );
}
