// Repos/Workspaces Page - Manage workspaces and quick git actions

import { useEffect, useState, useCallback } from 'react';
import { useWorkspaceStore } from '../stores/workspace';
import { useSettingsStore } from '../stores/settings';
import { AppLayout } from '../components/AppLayout';
import { QuickActions } from '../components/actions/QuickActions';
import { workspaces as workspacesApi, type ScannedRepo } from '../services/api';

export function ReposPage() {
  const {
    workspaceList,
    selectedWorkspaceId,
    gitStateByWorkspace,
    isLoading,
    error,
    loadWorkspaces,
    selectWorkspace,
    registerWorkspace,
    removeWorkspace,
    loadGitStatus,
    clearError,
  } = useWorkspaceStore();

  const selectedWorkspace = workspaceList.find((w) => w.id === selectedWorkspaceId) ?? null;
  const gitStatus = selectedWorkspaceId ? gitStateByWorkspace[selectedWorkspaceId]?.gitStatus : null;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [scannedRepos, setScannedRepos] = useState<ScannedRepo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { projectsPath, setProjectsPath } = useSettingsStore();

  const scanForRepos = useCallback(async () => {
    let scanPath = projectsPath;

    // Auto-detect default path if not configured
    if (!scanPath) {
      try {
        const { path } = await workspacesApi.getDefaultScanPath();
        scanPath = path;
        setProjectsPath(scanPath);
      } catch {
        setScanError('Could not determine default scan path. Set it in Settings.');
        return;
      }
    }

    setIsScanning(true);
    setScanError(null);
    try {
      const repos = await workspacesApi.scan(scanPath);
      setScannedRepos(repos);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed');
      setScannedRepos([]);
    } finally {
      setIsScanning(false);
    }
  }, [projectsPath, setProjectsPath]);

  const handleAddFromScan = async (repo: ScannedRepo) => {
    await registerWorkspace(repo.path, repo.name);
    // Re-scan to update isRegistered status
    await scanForRepos();
  };

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Scan for repos when modal opens
  useEffect(() => {
    if (showAddModal) {
      scanForRepos();
    }
  }, [showAddModal, scanForRepos]);

  // Load git status when workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      loadGitStatus(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, loadGitStatus]);

  const handleSelectWorkspace = (id: string) => {
    if (selectedWorkspaceId === id) return;
    selectWorkspace(id);
  };

  // Folder icon component
  const FolderIcon = ({ isActive }: { isActive: boolean }) => (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-accent/20' : 'bg-bg-tertiary'}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`w-5 h-5 ${isActive ? 'text-accent' : 'text-text-secondary'}`}
      >
        <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
      </svg>
    </div>
  );

  // Trash icon component
  const TrashButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors flex-shrink-0"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
      </svg>
    </button>
  );

  // Git status summary text
  const getGitStatusText = (status: typeof gitStatus) => {
    if (!status) return 'Loading...';

    const totalChanges = status.staged + status.unstaged + status.untracked;
    if (totalChanges > 0) return `${totalChanges} changes`;
    return 'clean';
  };

  return (
    <AppLayout>
      {/* Header */}
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-secondary flex-shrink-0">
        <div className="flex-1">
          <h1 className="text-base font-medium text-text-primary">Workspaces</h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
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
              d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-danger/20 rounded-xl flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-danger">{error}</span>
          <button onClick={clearError} className="w-10 h-10 flex items-center justify-center text-danger hover:text-danger/80">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Workspace List */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && workspaceList.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : workspaceList.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon isActive={false} />
            <p className="mt-4 text-text-secondary">No workspaces yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Add Workspace
            </button>
          </div>
        ) : (
          <>
            {/* Selected Workspace */}
            {selectedWorkspace && (
              <div className="p-4 bg-bg-secondary rounded-2xl border border-accent/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <FolderIcon isActive={true} />
                    <div>
                      <span className="font-semibold text-text-primary">
                        {selectedWorkspace.name}
                      </span>
                      <p className="text-sm text-text-secondary">
                        <span className="text-success">{gitStatus?.branch || 'main'}</span>
                        {gitStatus && (
                          <span className="ml-1">{getGitStatusText(gitStatus)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrashButton onClick={() => setDeleteConfirmId(selectedWorkspace.id)} />
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-accent">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-text-muted mb-4 truncate">{selectedWorkspace.path}</p>

                {/* Quick Actions Button */}
                <button
                  onClick={() => setShowQuickActions(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 min-h-[44px] bg-accent/10 text-accent rounded-xl text-sm font-medium hover:bg-accent/20 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
                  </svg>
                  Quick Actions
                </button>
              </div>
            )}

            {/* Other Workspaces */}
            {workspaceList
              .filter((w) => w.id !== selectedWorkspaceId)
              .map((workspace) => (
                <div
                  key={workspace.id}
                  onClick={() => handleSelectWorkspace(workspace.id)}
                  className="w-full p-4 bg-bg-secondary rounded-2xl border border-border hover:border-accent/50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FolderIcon isActive={false} />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-text-primary">
                        {workspace.name}
                      </span>
                      <p className="text-sm text-text-secondary truncate">
                        {workspace.path}
                      </p>
                    </div>
                    <TrashButton onClick={() => setDeleteConfirmId(workspace.id)} />
                  </div>
                </div>
              ))}
          </>
        )}
      </main>

      {/* Add Workspace Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-bg-elevated rounded-2xl p-6 mx-4 w-full max-w-md max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Add Workspace</h2>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
              {isScanning ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
                  <span className="ml-3 text-sm text-text-muted">Scanning for repos...</span>
                </div>
              ) : scanError ? (
                <div className="text-center py-6">
                  <p className="text-sm text-danger mb-2">{scanError}</p>
                  <button onClick={scanForRepos} className="text-sm text-accent hover:text-accent/80">
                    Retry
                  </button>
                </div>
              ) : scannedRepos.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-text-muted mb-1">No git repos found</p>
                  <p className="text-xs text-text-muted">Check your projects path in Settings</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {scannedRepos.map((repo) => (
                    <div
                      key={repo.path}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        repo.isRegistered ? 'bg-bg-secondary opacity-50' : 'bg-bg-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-text-secondary">
                          <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{repo.name}</p>
                        <p className="text-xs text-text-muted truncate">{repo.path}</p>
                      </div>
                      {repo.isRegistered ? (
                        <span className="text-xs text-text-muted px-2 py-1 bg-bg-tertiary rounded-lg flex-shrink-0">Added</span>
                      ) : (
                        <button
                          onClick={() => handleAddFromScan(repo)}
                          disabled={isLoading}
                          className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors flex-shrink-0"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-bg-tertiary text-text-secondary rounded-xl text-sm font-medium hover:bg-bg-surface transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workspace Confirm Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-bg-elevated rounded-2xl p-6 mx-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Remove Workspace</h3>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to remove &quot;{workspaceList.find((w) => w.id === deleteConfirmId)?.name}&quot;?
              This will delete all conversations, tasks, and reviews associated with this workspace. The files on disk are not affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 bg-bg-tertiary text-text-secondary rounded-xl text-sm font-medium hover:bg-bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeWorkspace(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-danger text-white rounded-xl text-sm font-medium hover:bg-danger/90 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Panel */}
      <QuickActions isOpen={showQuickActions} onClose={() => setShowQuickActions(false)} />
    </AppLayout>
  );
}
