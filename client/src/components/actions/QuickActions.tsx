// Quick Actions Panel - Git operations and common actions

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../../stores/workspace';
import { GitStatusCard } from './GitStatusCard';
import { ActionButton } from './ActionButton';
import { BranchSelector } from './BranchSelector';

interface QuickActionsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickActions({ isOpen, onClose }: QuickActionsProps) {
  const navigate = useNavigate();
  const {
    selectedWorkspaceId,
    gitStateByWorkspace,
    isLoading,
    error,
    loadGitStatus,
    stageFiles,
    commit,
    push,
    pull,
    clearError,
  } = useWorkspaceStore();

  const wsId = selectedWorkspaceId || '';
  const gitStatus = wsId ? gitStateByWorkspace[wsId]?.gitStatus ?? null : null;

  const [commitMessage, setCommitMessage] = useState('');
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showBranches, setShowBranches] = useState(false);

  if (!isOpen) return null;

  const handleStageAll = async () => {
    if (!wsId) return;
    setActionLoading('stage');
    try {
      await stageFiles(wsId, ['.']);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || !wsId) return;

    setActionLoading('commit');
    try {
      await commit(wsId, commitMessage.trim());
      setCommitMessage('');
      setShowCommitInput(false);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePush = async () => {
    if (!wsId) return;
    setActionLoading('push');
    try {
      await push(wsId);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePull = async () => {
    if (!wsId) return;
    setActionLoading('pull');
    try {
      await pull(wsId);
    } finally {
      setActionLoading(null);
    }
  };

  const hasUnstagedChanges = gitStatus && (gitStatus.unstaged > 0 || gitStatus.untracked > 0);
  const hasStagedChanges = gitStatus && gitStatus.staged > 0;
  const canPush = gitStatus && gitStatus.ahead > 0;
  const shouldPull = gitStatus && gitStatus.behind > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative mt-auto bg-bg-elevated rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4">
          <h2 className="text-lg font-semibold text-text-primary">Quick Actions</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-tertiary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-text-muted"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-4 p-3 bg-danger/20 rounded-xl flex items-center justify-between">
            <span className="text-sm text-danger">{error}</span>
            <button onClick={clearError} className="text-danger hover:text-danger/80">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
          {/* Git Status */}
          <GitStatusCard
            status={gitStatus}
            onRefresh={() => wsId && loadGitStatus(wsId)}
            isLoading={isLoading}
          />

          {/* Commit input */}
          {showCommitInput && (
            <div className="p-4 bg-bg-secondary rounded-2xl border border-border space-y-3">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="w-full h-24 p-3 bg-bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCommitInput(false);
                    setCommitMessage('');
                  }}
                  className="flex-1 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm font-medium hover:bg-bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || actionLoading === 'commit'}
                  className="flex-1 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'commit' ? 'Committing...' : 'Commit'}
                </button>
              </div>
            </div>
          )}

          {/* Git Actions */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
              Git Actions
            </h3>

            {hasUnstagedChanges && (
              <ActionButton
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                  </svg>
                }
                label="Stage All Changes"
                description={`${gitStatus!.unstaged + gitStatus!.untracked} files to stage`}
                onClick={handleStageAll}
                loading={actionLoading === 'stage'}
                variant="success"
              />
            )}

            {hasStagedChanges && !showCommitInput && (
              <ActionButton
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                }
                label="Commit Changes"
                description={`${gitStatus!.staged} staged files`}
                onClick={() => setShowCommitInput(true)}
                variant="success"
              />
            )}

            {canPush && (
              <ActionButton
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06l-6.22-6.22V21a.75.75 0 0 1-1.5 0V4.81l-6.22 6.22a.75.75 0 1 1-1.06-1.06l7.5-7.5Z" clipRule="evenodd" />
                  </svg>
                }
                label="Push to Remote"
                description={`${gitStatus!.ahead} commits to push`}
                onClick={handlePush}
                loading={actionLoading === 'push'}
              />
            )}

            {shouldPull && (
              <ActionButton
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M12.53 21.53a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 1 1 1.06-1.06l6.22 6.22V3a.75.75 0 0 1 1.5 0v16.19l6.22-6.22a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                }
                label="Pull from Remote"
                description={`${gitStatus!.behind} commits behind`}
                onClick={handlePull}
                loading={actionLoading === 'pull'}
                variant="warning"
              />
            )}

            {/* Always show pull option if no pending pull */}
            {!shouldPull && (
              <ActionButton
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M12.53 21.53a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 1 1 1.06-1.06l6.22 6.22V3a.75.75 0 0 1 1.5 0v16.19l6.22-6.22a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                }
                label="Pull Latest"
                description="Fetch and merge remote changes"
                onClick={handlePull}
                loading={actionLoading === 'pull'}
              />
            )}

            <ActionButton
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" clipRule="evenodd" />
                </svg>
              }
              label="Switch Branch"
              description={gitStatus?.branch ? `Current: ${gitStatus.branch}` : 'Select branch'}
              onClick={() => setShowBranches(true)}
            />
          </div>

          {/* Navigation */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
              Navigate
            </h3>

            <ActionButton
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
                  <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                </svg>
              }
              label="Review Changes"
              description="View and approve diff"
              onClick={() => {
                onClose();
                navigate('/diff');
              }}
            />

            <ActionButton
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M2.25 5.25a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v13.5a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V5.25Zm3.75.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM6 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM6 13.5a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clipRule="evenodd" />
                </svg>
              }
              label="Workspaces"
              description="Manage repositories"
              onClick={() => {
                onClose();
                navigate('/repos');
              }}
            />
          </div>
        </div>
      </div>

      {/* Branch Selector */}
      {wsId && (
        <BranchSelector
          isOpen={showBranches}
          onClose={() => setShowBranches(false)}
          workspaceId={wsId}
        />
      )}
    </div>
  );
}
