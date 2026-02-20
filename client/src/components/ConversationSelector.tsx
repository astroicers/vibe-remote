// ConversationSelector - BottomSheet for switching conversations within a workspace

import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { useChatStore } from '../stores/chat';
import type { Conversation } from '../services/api';

interface ConversationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onNewConversation: () => void;
}

export function ConversationSelector({
  isOpen,
  onClose,
  workspaceId,
  onNewConversation,
}: ConversationSelectorProps) {
  const { workspaceChats, loadConversations, selectConversation, deleteConversation } = useChatStore();
  const wsChat = workspaceChats[workspaceId];
  const conversations = wsChat?.conversations || [];
  const currentId = wsChat?.currentConversationId;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadConversations(workspaceId);
    }
    // Reset confirm state when sheet closes
    if (!isOpen) {
      setConfirmDeleteId(null);
    }
  }, [isOpen, workspaceId, loadConversations]);

  const handleSelect = (conv: Conversation) => {
    // Don't select if we're in confirm-delete mode for this item
    if (confirmDeleteId === conv.id) return;
    selectConversation(workspaceId, conv.id);
    onClose();
  };

  const handleDeleteTap = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (confirmDeleteId === convId) {
      // Second tap — actually delete
      performDelete(convId);
    } else {
      // First tap — show confirm
      setConfirmDeleteId(convId);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const performDelete = async (convId: string) => {
    setDeletingId(convId);
    setConfirmDeleteId(null);
    await deleteConversation(workspaceId, convId);
    setDeletingId(null);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Conversations">
      <div className="px-4 py-2">
        {/* New conversation button */}
        <button
          onClick={() => {
            onNewConversation();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 transition-colors mb-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">New Conversation</span>
        </button>

        {/* Conversation list */}
        {conversations.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-6">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => {
              const isConfirming = confirmDeleteId === conv.id;
              const isDeleting = deletingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelect(conv)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                    isConfirming
                      ? 'bg-danger/10 border border-danger/30'
                      : conv.id === currentId
                        ? 'bg-accent/10 border border-accent/30'
                        : 'hover:bg-bg-tertiary border border-transparent'
                  } ${isDeleting ? 'opacity-50' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 flex-shrink-0 ${conv.id === currentId && !isConfirming ? 'text-accent' : 'text-text-muted'}`}>
                    <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${conv.id === currentId && !isConfirming ? 'text-accent' : 'text-text-primary'}`}>
                      {conv.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {isConfirming ? 'Tap delete again to confirm' : formatTime(conv.updated_at)}
                    </p>
                  </div>

                  {/* Confirm/Cancel buttons when confirming */}
                  {isConfirming ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={handleCancelDelete}
                        className="px-2.5 py-1 text-xs rounded-lg text-text-secondary bg-bg-tertiary hover:bg-bg-surface transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => handleDeleteTap(e, conv.id)}
                        disabled={isDeleting}
                        className="px-2.5 py-1 text-xs rounded-lg text-white bg-danger hover:bg-danger/80 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteTap(e, conv.id)}
                      disabled={isDeleting}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
