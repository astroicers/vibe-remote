// Workspace Tabs - Horizontally scrollable tab bar

import { useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspace';
import { useChatStore } from '../stores/chat';

export function WorkspaceTabs() {
  const {
    workspaceList,
    selectedWorkspaceId,
    selectWorkspace,
  } = useWorkspaceStore();
  const { workspaceChats } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to selected tab
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = selectedRef.current;
      const containerLeft = container.scrollLeft;
      const containerRight = containerLeft + container.clientWidth;
      const tabLeft = tab.offsetLeft;
      const tabRight = tabLeft + tab.clientWidth;

      if (tabLeft < containerLeft || tabRight > containerRight) {
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedWorkspaceId]);

  if (workspaceList.length <= 1) return null;

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1 px-3 py-1.5 bg-bg-primary border-b border-border overflow-x-auto scrollbar-hide flex-shrink-0"
    >
      {workspaceList.map((ws) => {
        const isSelected = ws.id === selectedWorkspaceId;
        const wsChat = workspaceChats[ws.id];
        const unread = wsChat?.unreadCount || 0;
        const isStreaming = wsChat?.isStreaming || false;

        return (
          <button
            key={ws.id}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => selectWorkspace(ws.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              isSelected
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'bg-bg-secondary text-text-secondary border border-transparent hover:bg-bg-tertiary'
            }`}
          >
            {/* Streaming indicator */}
            {isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse flex-shrink-0" />
            )}

            <span className="truncate max-w-[100px]">{ws.name}</span>

            {/* Unread badge */}
            {unread > 0 && (
              <span className="w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
