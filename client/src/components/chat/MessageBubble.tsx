// Message Bubble Component

import { memo } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

function MessageBubbleComponent({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 ${isUser ? 'animate-msg-in-right' : 'animate-msg-in-left'}`}>
      <div
        className={`${isUser ? 'max-w-[85%]' : 'max-w-[92%]'} px-4 py-3 ${
          isUser
            ? 'bg-accent-muted text-text-primary rounded-[16px_16px_4px_16px]'
            : 'bg-bg-secondary text-text-primary rounded-[4px_16px_16px_16px]'
        }`}
      >
        {/* Content with markdown-like rendering */}
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {content.split('```').map((segment, i) => {
            if (i % 2 === 1) {
              // Code block
              const [lang, ...codeLines] = segment.split('\n');
              const code = codeLines.join('\n');
              return (
                <pre
                  key={i}
                  className="my-2 p-3 bg-bg-primary rounded-lg overflow-x-auto text-xs font-mono"
                >
                  {lang && (
                    <div className="text-text-muted text-xs mb-2">{lang}</div>
                  )}
                  <code>{code}</code>
                </pre>
              );
            }
            // Regular text - handle inline code
            return (
              <span key={i}>
                {segment.split('`').map((part, j) =>
                  j % 2 === 1 ? (
                    <code
                      key={j}
                      className="px-1.5 py-0.5 bg-bg-primary rounded text-xs font-mono"
                    >
                      {part}
                    </code>
                  ) : (
                    part
                  )
                )}
              </span>
            );
          })}
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="inline-block w-2.5 h-5 ml-1 bg-accent animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);
