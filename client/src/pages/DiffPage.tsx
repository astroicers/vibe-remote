import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileList, DiffViewer, ReviewActions } from '../components/diff';
import { useDiffStore } from '../stores/diff';

export function DiffPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reviewId = searchParams.get('review');

  const {
    currentDiff,
    currentReview,
    selectedFile,
    isLoading,
    error,
    loadCurrentDiff,
    loadReview,
    createReview,
    approveAll,
    rejectAll,
    approveFile,
    rejectFile,
    selectFile,
    clearError,
  } = useDiffStore();

  const [showFileList, setShowFileList] = useState(false);

  // Load diff or review on mount
  useEffect(() => {
    if (reviewId) {
      loadReview(reviewId);
    } else {
      loadCurrentDiff();
    }
  }, [reviewId, loadReview, loadCurrentDiff]);

  // Determine which data to display
  const files = currentReview?.files || currentDiff?.files || [];
  const totalInsertions =
    currentReview?.files.reduce((sum, f) => sum + f.insertions, 0) ||
    currentDiff?.totalInsertions ||
    0;
  const totalDeletions =
    currentReview?.files.reduce((sum, f) => sum + f.deletions, 0) ||
    currentDiff?.totalDeletions ||
    0;

  const handleCreateReview = async () => {
    try {
      const review = await createReview();
      navigate(`/diff?review=${review.id}`);
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-secondary">
        <button
          onClick={() => navigate('/')}
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
              d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="flex-1 ml-3">
          <h1 className="text-base font-medium text-text-primary">
            {currentReview ? 'Diff Review' : 'Current Changes'}
          </h1>
          <p className="text-xs text-text-muted">
            {files.length} file(s) changed{' '}
            <span className="text-diff-add-text">+{totalInsertions}</span>{' '}
            <span className="text-diff-del-text">-{totalDeletions}</span>
          </p>
        </div>

        {/* File list toggle */}
        <button
          onClick={() => setShowFileList(!showFileList)}
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
              d="M2.625 6.75a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0A.75.75 0 0 1 8.25 6h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75ZM2.625 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 12a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 7.5 12Zm-4.875 5.25a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-danger/20 text-danger text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="w-6 h-6 flex items-center justify-center text-danger hover:text-danger/80">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-muted">Loading...</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && files.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-text-muted">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-tertiary flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-success">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-text-secondary mb-2">
              No changes
            </h3>
            <p className="text-sm">
              Working tree is clean. Make some changes to see the diff.
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      {!isLoading && files.length > 0 && (
        <div className="flex-1 flex overflow-hidden">
          {/* File list sidebar (mobile: overlay) */}
          {showFileList && (
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setShowFileList(false)}
            />
          )}
          <div
            className={`${
              showFileList ? 'translate-x-0' : '-translate-x-full'
            } fixed left-0 top-14 bottom-0 w-64 z-50 bg-bg-secondary border-r border-border transition-transform md:relative md:translate-x-0 md:w-72`}
          >
            <FileList
              files={files}
              selectedPath={selectedFile?.path || null}
              onSelect={(file) => {
                selectFile(file);
                setShowFileList(false);
              }}
            />
          </div>

          {/* Diff viewer */}
          <div className="flex-1 overflow-auto">
            {selectedFile ? (
              <div>
                {/* File header */}
                <div className="sticky top-0 px-4 py-3 bg-bg-secondary border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text-primary">
                        {selectedFile.path.split('/').pop()}
                      </p>
                      <p className="text-xs text-text-muted">
                        {selectedFile.status}{' '}
                        <span className="text-diff-add-text">
                          +{selectedFile.insertions}
                        </span>{' '}
                        <span className="text-diff-del-text">
                          -{selectedFile.deletions}
                        </span>
                      </p>
                    </div>

                    {/* Per-file actions */}
                    {currentReview && currentReview.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => rejectFile(selectedFile.path)}
                          className="px-3 py-1 text-xs bg-danger/20 text-danger rounded hover:bg-danger/30"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => approveFile(selectedFile.path)}
                          className="px-3 py-1 text-xs bg-success/20 text-success rounded hover:bg-success/30"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <DiffViewer file={selectedFile} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted">
                Select a file to view changes
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      {!isLoading && files.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-bg-secondary">
          {currentReview ? (
            <ReviewActions
              status={currentReview.status}
              onApproveAll={approveAll}
              onRejectAll={rejectAll}
              isLoading={isLoading}
            />
          ) : (
            <button
              onClick={handleCreateReview}
              className="w-full py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover transition-colors"
            >
              Start Review
            </button>
          )}
        </div>
      )}

      {/* Bottom navigation */}
      <nav className="flex items-center justify-around h-14 border-t border-border bg-bg-secondary">
        <button
          onClick={() => navigate('/')}
          className="flex flex-col items-center justify-center flex-1 h-full text-text-muted hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-0.5">Chat</span>
        </button>

        <button className="flex flex-col items-center justify-center flex-1 h-full text-accent">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z"
              clipRule="evenodd"
            />
            <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
          </svg>
          <span className="text-xs mt-0.5">Diff</span>
        </button>

        <button
          onClick={() => navigate('/tasks')}
          className="flex flex-col items-center justify-center flex-1 h-full text-text-muted hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M2.625 6.75a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0A.75.75 0 0 1 8.25 6h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75ZM2.625 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 12a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 7.5 12Zm-4.875 5.25a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-0.5">Tasks</span>
        </button>

        <button
          onClick={() => navigate('/settings')}
          className="flex flex-col items-center justify-center flex-1 h-full text-text-muted hover:text-text-secondary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-0.5">Settings</span>
        </button>
      </nav>
    </div>
  );
}
