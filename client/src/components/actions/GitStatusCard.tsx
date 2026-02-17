// Git Status Card - Shows current git status summary

import type { GitStatus } from '../../services/api';

interface GitStatusCardProps {
  status: GitStatus | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function GitStatusCard({ status, onRefresh, isLoading }: GitStatusCardProps) {
  if (!status) {
    return (
      <div className="p-4 bg-bg-secondary rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-bg-tertiary rounded-lg flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-text-muted"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-text-secondary">No workspace selected</p>
            <p className="text-xs text-text-muted">Select a repository to see status</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status.isGitRepo) {
    return (
      <div className="p-4 bg-bg-secondary rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-warning"
            >
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-text-secondary">Not a Git repository</p>
            <p className="text-xs text-text-muted">Initialize git to track changes</p>
          </div>
        </div>
      </div>
    );
  }

  const hasChanges = !status.isClean;

  return (
    <div className="p-4 bg-bg-secondary rounded-2xl border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-accent"
          >
            <path
              fillRule="evenodd"
              d="M3 2.25a.75.75 0 0 0-.75.75v.54l1.838 1.838a1.5 1.5 0 0 1 .44 1.061V8.25h3.75V6.389a1.5 1.5 0 0 1 .44-1.06L10.5 3.5V3A.75.75 0 0 0 9.75 2.25H3Zm11.25 0a.75.75 0 0 0-.75.75v.5l-1.838 1.839a1.5 1.5 0 0 0-.44 1.06V8.25h3.75V6.389a1.5 1.5 0 0 0-.44-1.06L12.75 3.5V3a.75.75 0 0 0-.75-.75h-1.5Z"
              clipRule="evenodd"
            />
            <path d="M3 9.75v9.75a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 19.5V9.75H3Z" />
          </svg>
          <span className="text-sm font-medium text-text-primary">{status.branch}</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-tertiary transition-colors disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`w-4 h-4 text-text-muted ${isLoading ? 'animate-spin' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Status indicators */}
      <div className="grid grid-cols-3 gap-2">
        {/* Ahead/Behind */}
        {(status.ahead > 0 || status.behind > 0) && (
          <div className="col-span-3 flex items-center gap-4 p-2 bg-bg-tertiary rounded-lg mb-2">
            {status.ahead > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3 h-3 text-success"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.47 2.47a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06l-6.22-6.22V21a.75.75 0 0 1-1.5 0V4.81l-6.22 6.22a.75.75 0 1 1-1.06-1.06l7.5-7.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-success">{status.ahead} ahead</span>
              </div>
            )}
            {status.behind > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3 h-3 text-warning"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.53 21.53a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 1 1 1.06-1.06l6.22 6.22V3a.75.75 0 0 1 1.5 0v16.19l6.22-6.22a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-warning">{status.behind} behind</span>
              </div>
            )}
          </div>
        )}

        {/* Staged */}
        <div className="flex flex-col items-center p-2 bg-bg-tertiary rounded-lg">
          <span
            className={`text-lg font-semibold ${
              status.staged > 0 ? 'text-success' : 'text-text-muted'
            }`}
          >
            {status.staged}
          </span>
          <span className="text-xs text-text-muted">Staged</span>
        </div>

        {/* Unstaged */}
        <div className="flex flex-col items-center p-2 bg-bg-tertiary rounded-lg">
          <span
            className={`text-lg font-semibold ${
              status.unstaged > 0 ? 'text-warning' : 'text-text-muted'
            }`}
          >
            {status.unstaged}
          </span>
          <span className="text-xs text-text-muted">Modified</span>
        </div>

        {/* Untracked */}
        <div className="flex flex-col items-center p-2 bg-bg-tertiary rounded-lg">
          <span
            className={`text-lg font-semibold ${
              status.untracked > 0 ? 'text-accent' : 'text-text-muted'
            }`}
          >
            {status.untracked}
          </span>
          <span className="text-xs text-text-muted">New</span>
        </div>
      </div>

      {/* Clean status */}
      {!hasChanges && (
        <div className="mt-3 flex items-center justify-center gap-2 p-2 bg-success/10 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-success"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-success">Working tree clean</span>
        </div>
      )}
    </div>
  );
}
