// Branch Selector - BottomSheet for branch management

import { useState, useEffect } from 'react';
import { BottomSheet } from '../BottomSheet';
import { workspaces, type GitBranches } from '../../services/api';
import { useWorkspaceStore } from '../../stores/workspace';

interface BranchSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function BranchSelector({ isOpen, onClose, workspaceId }: BranchSelectorProps) {
  const [branches, setBranches] = useState<GitBranches | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loadGitStatus, loadBranches } = useWorkspaceStore();

  // Fetch branches when opened
  useEffect(() => {
    if (isOpen && workspaceId) {
      setIsLoading(true);
      setError(null);
      workspaces
        .getBranches(workspaceId)
        .then((data) => {
          setBranches(data);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load branches');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, workspaceId]);

  const handleCheckout = async (branch: string) => {
    if (!workspaceId || branch === branches?.current) return;

    setCheckoutLoading(branch);
    setError(null);
    try {
      await workspaces.checkout(workspaceId, branch, false);
      await loadGitStatus(workspaceId);
      await loadBranches(workspaceId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to checkout branch');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCreateBranch = async () => {
    const trimmed = newBranchName.trim();
    if (!trimmed || !workspaceId) return;

    setCreateLoading(true);
    setError(null);
    try {
      await workspaces.checkout(workspaceId, trimmed, true);
      await loadGitStatus(workspaceId);
      await loadBranches(workspaceId);
      setNewBranchName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Branches">
      <div className="px-4 py-3 space-y-3">
        {/* Create new branch input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="New branch name..."
            className="flex-1 px-3 py-2.5 bg-bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateBranch();
            }}
          />
          <button
            onClick={handleCreateBranch}
            disabled={!newBranchName.trim() || createLoading}
            className="px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createLoading ? 'Creating...' : 'Create'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-danger/20 rounded-xl">
            <span className="text-sm text-danger">{error}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
          </div>
        )}

        {/* Branch list */}
        {!isLoading && branches && (
          <div className="space-y-1">
            {branches.all.map((branch) => {
              const isCurrent = branch === branches.current;
              const isCheckingOut = checkoutLoading === branch;

              return (
                <button
                  key={branch}
                  onClick={() => handleCheckout(branch)}
                  disabled={isCurrent || isCheckingOut}
                  className="p-3 rounded-xl flex items-center gap-3 w-full text-left hover:bg-bg-tertiary disabled:cursor-default transition-colors"
                >
                  {/* Branch icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className={`w-4 h-4 flex-shrink-0 ${isCurrent ? 'text-accent' : 'text-text-muted'}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
                      clipRule="evenodd"
                    />
                  </svg>

                  {/* Branch name */}
                  <span
                    className={`text-sm flex-1 truncate ${isCurrent ? 'text-accent font-medium' : 'text-text-primary'}`}
                  >
                    {branch}
                  </span>

                  {/* Loading spinner for checkout */}
                  {isCheckingOut && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
                  )}

                  {/* Checkmark for current branch */}
                  {isCurrent && !isCheckingOut && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-accent flex-shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && branches && branches.all.length === 0 && (
          <div className="py-8 text-center text-sm text-text-muted">
            No branches found
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
