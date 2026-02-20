import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageList, ChatInput, TokenUsageCard, ToolApprovalCard, ContextFileSheet, PromptTemplateSheet } from '../components/chat';
import { QuickActions } from '../components/actions';
import { AppLayout } from '../components/AppLayout';
import { ConversationSelector } from '../components/ConversationSelector';
import { useChatStore } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { useWorkspaceStore } from '../stores/workspace';

export function ChatPage() {
  const navigate = useNavigate();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [showFileSheet, setShowFileSheet] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [prefillText, setPrefillText] = useState('');
  const { isAuthenticated, checkAuth } = useAuthStore();

  const {
    selectedWorkspaceId,
    selectedWorkspace,
    loadWorkspaces,
    loadGitStatus,
  } = useWorkspaceStore();

  const wsId = selectedWorkspaceId || '';
  const workspace = selectedWorkspace();

  const {
    getWorkspaceChat,
    sendMessage,
    clearError,
    dismissTokenUsage,
    retryConversation,
    approveToolUse,
    rejectToolUse,
    createConversation,
    loadConversations,
    loadConversation,
    clearUnread,
    setSelectedFiles,
    error,
  } = useChatStore();

  const wsChat = getWorkspaceChat(wsId);
  const {
    messages,
    streamingMessage,
    isStreaming,
    isSending,
    lastTokenUsage,
    showTokenUsage,
    pendingApprovals,
    currentConversationId,
    conversations,
    selectedFiles,
  } = wsChat;

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
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

  // Load workspaces on auth
  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaces();
    }
  }, [isAuthenticated, loadWorkspaces]);

  // Clear unread when switching to this workspace
  useEffect(() => {
    if (wsId) {
      clearUnread(wsId);
    }
  }, [wsId, clearUnread]);

  // Load conversations when workspace changes — auto-selects the most recent one
  useEffect(() => {
    if (wsId && isAuthenticated) {
      loadConversations(wsId);
    }
  }, [wsId, isAuthenticated, loadConversations]);

  // Load conversation messages when switching conversation
  useEffect(() => {
    if (wsId && currentConversationId) {
      loadConversation(wsId, currentConversationId);
    }
  }, [wsId, currentConversationId, loadConversation]);

  const handleSend = (content: string) => {
    if (!wsId) return;
    sendMessage(wsId, content, selectedFiles.length > 0 ? selectedFiles : undefined);
  };

  const handleNewConversation = async () => {
    if (!wsId) return;
    await createConversation(wsId);
  };

  // Find current conversation title
  const currentConv = conversations.find((c) => c.id === currentConversationId);
  const headerTitle = workspace?.name || 'Vibe Remote';
  const headerSubtitle = currentConv?.title || 'New Conversation';

  return (
    <AppLayout>
      {/* Header — tap to switch conversation */}
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-secondary flex-shrink-0">
        <button
          onClick={() => wsId && setShowConversations(true)}
          className="flex-1 text-left"
        >
          <h1 className="text-base font-medium text-text-primary">{headerTitle}</h1>
          <p className="text-xs text-text-muted flex items-center gap-1">
            {headerSubtitle}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </p>
        </button>

        {/* New conversation */}
        <button
          onClick={handleNewConversation}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-tertiary"
          title="New conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-text-secondary">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-danger/20 text-danger text-sm flex items-center gap-2 flex-shrink-0">
          <span className="flex-1">{error}</span>
          {currentConversationId && (
            <button
              onClick={() => {
                clearError();
                retryConversation(wsId, currentConversationId);
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

      {/* No workspace selected state */}
      {!wsId && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-text-muted">
            <p className="text-sm mb-4">No workspace selected</p>
            <button
              onClick={() => navigate('/repos')}
              className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium"
            >
              Add Workspace
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {wsId && (
        <>
          <MessageList
            messages={messages}
            streamingMessage={streamingMessage}
            isStreaming={isStreaming}
          />

          {/* Token Usage Card */}
          {showTokenUsage && lastTokenUsage && (
            <TokenUsageCard
              tokenUsage={lastTokenUsage}
              onDismiss={() => dismissTokenUsage(wsId)}
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
              if (wsId) loadGitStatus(wsId);
              setShowQuickActions(true);
            }}
            onAttachFiles={() => setShowFileSheet(true)}
            onTemplates={() => setShowTemplates(true)}
            selectedFileCount={selectedFiles.length}
            disabled={isSending || isStreaming}
            placeholder={isStreaming ? 'AI is thinking...' : 'Type a message...'}
            prefillText={prefillText}
          />
        </>
      )}

      {/* Quick Actions Panel */}
      <QuickActions isOpen={showQuickActions} onClose={() => setShowQuickActions(false)} />

      {/* Prompt Template Sheet */}
      {wsId && (
        <PromptTemplateSheet
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          workspaceId={wsId}
          onSelectTemplate={(content) => {
            setPrefillText(content);
            // Reset prefillText after a tick so the same template can be selected again
            setTimeout(() => setPrefillText(''), 0);
          }}
        />
      )}

      {/* Context File Sheet */}
      {wsId && (
        <ContextFileSheet
          isOpen={showFileSheet}
          onClose={() => setShowFileSheet(false)}
          workspaceId={wsId}
          selectedFiles={selectedFiles}
          onSelectionChange={(files) => setSelectedFiles(wsId, files)}
        />
      )}

      {/* Conversation Selector */}
      {wsId && (
        <ConversationSelector
          isOpen={showConversations}
          onClose={() => setShowConversations(false)}
          workspaceId={wsId}
          onNewConversation={handleNewConversation}
        />
      )}
    </AppLayout>
  );
}
