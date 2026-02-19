// ConversationSelector - BottomSheet for switching conversations within a workspace

import { useEffect } from 'react';
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
  const { workspaceChats, loadConversations, selectConversation } = useChatStore();
  const wsChat = workspaceChats[workspaceId];
  const conversations = wsChat?.conversations || [];
  const currentId = wsChat?.currentConversationId;

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadConversations(workspaceId);
    }
  }, [isOpen, workspaceId, loadConversations]);

  const handleSelect = (conv: Conversation) => {
    selectConversation(workspaceId, conv.id);
    onClose();
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
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  conv.id === currentId
                    ? 'bg-accent/10 border border-accent/30'
                    : 'hover:bg-bg-tertiary'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 flex-shrink-0 ${conv.id === currentId ? 'text-accent' : 'text-text-muted'}`}>
                  <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${conv.id === currentId ? 'text-accent' : 'text-text-primary'}`}>
                    {conv.title || 'Untitled'}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatTime(conv.updated_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
