// Diff Comment List Component - Shows comments for a file with Send to AI button

import type { DiffComment } from '../../services/api';
import { useDiffStore } from '../../stores/diff';
import { useWorkspaceStore } from '../../stores/workspace';

interface DiffCommentListProps {
  comments: DiffComment[];
  filePath: string;
}

export function DiffCommentList({ comments, filePath }: DiffCommentListProps) {
  const { selectedWorkspaceId } = useWorkspaceStore();
  const { sendFeedback, getDiffState } = useDiffStore();

  if (comments.length === 0) {
    return null;
  }

  const userComments = comments.filter((c) => c.author === 'user');
  const feedbackProcessing = selectedWorkspaceId
    ? getDiffState(selectedWorkspaceId).feedbackProcessing
    : false;

  const handleSendToAI = async () => {
    if (!selectedWorkspaceId || userComments.length === 0) return;

    try {
      await sendFeedback(selectedWorkspaceId, [filePath]);
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Comments header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment items */}
      <div className="space-y-2">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {/* Send to AI button */}
      {userComments.length > 0 && (
        <button
          onClick={handleSendToAI}
          disabled={feedbackProcessing}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z"
              clipRule="evenodd"
            />
          </svg>
          Send feedback to AI
        </button>
      )}
    </div>
  );
}

function CommentItem({ comment }: { comment: DiffComment }) {
  const isAI = comment.author === 'ai';
  const timeStr = formatTime(comment.createdAt);

  return (
    <div
      className={`flex gap-2.5 ${isAI ? '' : ''}`}
    >
      {/* Author icon */}
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
          isAI
            ? 'bg-accent/20 text-accent'
            : 'bg-bg-tertiary text-text-secondary'
        }`}
      >
        {isAI ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              fillRule="evenodd"
              d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              fillRule="evenodd"
              d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Comment content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">
            {isAI ? 'AI' : 'You'}
          </span>
          <span className="text-xs text-text-muted">{timeStr}</span>
        </div>
        <p className="text-sm text-text-primary mt-0.5 break-words">
          {comment.content}
        </p>
        {comment.lineNumber && (
          <span className="inline-block mt-1 text-xs text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">
            Line {comment.lineNumber}
          </span>
        )}
      </div>
    </div>
  );
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  } catch {
    return '';
  }
}
