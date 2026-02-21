import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileList, DiffViewer, ReviewActions, DiffCommentInput, DiffCommentList } from '../components/diff';
import { AppLayout } from '../components/AppLayout';
import { BottomSheet } from '../components/BottomSheet';
import { useDiffStore } from '../stores/diff';
import { useWorkspaceStore } from '../stores/workspace';
import { useChatStore } from '../stores/chat';

export function DiffPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reviewId = searchParams.get('review');

  const { selectedWorkspaceId } = useWorkspaceStore();
  const wsId = selectedWorkspaceId || '';

  const {
    getDiffState,
    isLoading,
    error,
    loadCurrentDiff,
    loadReview,
    createReview,
    approveAll,
    rejectAll,
    approveFile,
    rejectFile,
    addComment,
    selectFile,
    clearError,
  } = useDiffStore();

  const wsDiff = getDiffState(wsId);
  const { currentDiff, currentReview, selectedFile } = wsDiff;

  const { createConversation, sendMessage } = useChatStore();

  const [showFileSheet, setShowFileSheet] = useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);

  // Load diff or review on mount
  useEffect(() => {
    if (!wsId) return;
    if (reviewId) {
      loadReview(wsId, reviewId);
    } else {
      loadCurrentDiff(wsId);
    }
  }, [wsId, reviewId, loadReview, loadCurrentDiff]);

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

  // Auto-select first file when diff loads
  useEffect(() => {
    if (wsId && files.length > 0 && !selectedFile) {
      selectFile(wsId, files[0]);
    }
  }, [wsId, files, selectedFile, selectFile]);

  // Current file index for prev/next navigation
  const currentIndex = selectedFile
    ? files.findIndex((f) => f.path === selectedFile.path)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < files.length - 1;

  const goToPrevFile = () => {
    if (hasPrev && wsId) selectFile(wsId, files[currentIndex - 1]);
  };
  const goToNextFile = () => {
    if (hasNext && wsId) selectFile(wsId, files[currentIndex + 1]);
  };

  // Swipe-to-navigate between files
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleSwipeStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0 && hasPrev) {
        goToPrevFile();
      } else if (deltaX < 0 && hasNext) {
        goToNextFile();
      }
    }
  };

  const handleRejectAll = async () => {
    if (!wsId) return;
    await rejectAll(wsId);
    const review = getDiffState(wsId).currentReview;
    const userComments = review?.comments.filter((c) => c.author === 'user') || [];
    if (userComments.length > 0) {
      setShowFeedbackPrompt(true);
    }
  };

  const handleSendFeedbackToAI = async () => {
    if (!wsId) return;
    const review = currentReview;
    if (!review) return;
    const userComments = review.comments.filter((c) => c.author === 'user');
    const formatted = userComments
      .map((c) => {
        const linePart = c.lineNumber ? `, line ${c.lineNumber}` : '';
        return `- ${c.content} (file: ${c.filePath}${linePart})`;
      })
      .join('\n');
    const message = `Please address the following review feedback and make the requested changes:\n\n${formatted}`;
    await createConversation(wsId);
    sendMessage(wsId, message);
    setShowFeedbackPrompt(false);
    navigate('/chat');
  };

  const handleCreateReview = async () => {
    if (!wsId) return;
    try {
      const review = await createReview(wsId);
      navigate(`/diff?review=${review.id}`);
    } catch {
      // Error handled by store
    }
  };

  return (
    <AppLayout>
      {/* Header — tap to open file list */}
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-secondary flex-shrink-0">
        <button
          onClick={() => files.length > 0 && setShowFileSheet(true)}
          className="flex-1 text-left"
        >
          <h1 className="text-base font-medium text-text-primary">
            {currentReview ? 'Diff Review' : 'Current Changes'}
          </h1>
          <p className="text-xs text-text-muted flex items-center gap-1">
            {files.length} file(s){' '}
            <span className="text-diff-add-text">+{totalInsertions}</span>{' '}
            <span className="text-diff-del-text">-{totalDeletions}</span>
            {files.length > 0 && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-0.5">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            )}
          </p>
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-danger/20 text-danger text-sm flex items-center justify-between flex-shrink-0">
          <span>{error}</span>
          <button onClick={clearError} className="w-8 h-8 flex items-center justify-center text-danger hover:text-danger/80">
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

      {/* Main content - Diff viewer */}
      {!isLoading && files.length > 0 && (
        <div
          className="flex-1 overflow-auto"
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
        >
          {selectedFile ? (
            <div>
              {/* File header with prev/next navigation */}
              <div className="sticky top-0 z-10 px-4 py-2.5 bg-bg-secondary border-b border-border">
                <div className="flex items-center gap-2">
                  {/* Prev button */}
                  <button
                    onClick={goToPrevFile}
                    disabled={!hasPrev}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-tertiary disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-secondary">
                      <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${
                          selectedFile.status === 'added'
                            ? 'bg-success/20 text-success'
                            : selectedFile.status === 'deleted'
                            ? 'bg-danger/20 text-danger'
                            : selectedFile.status === 'renamed'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-accent/20 text-accent'
                        }`}
                      >
                        {selectedFile.status === 'added'
                          ? 'A'
                          : selectedFile.status === 'deleted'
                          ? 'D'
                          : selectedFile.status === 'renamed'
                          ? 'R'
                          : 'M'}
                      </span>
                      <p className="text-sm font-medium text-text-primary truncate">
                        {selectedFile.path.split('/').pop()}
                      </p>
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {selectedFile.path.split('/').slice(0, -1).join('/') || '/'}{' '}
                      <span className="text-diff-add-text">+{selectedFile.insertions}</span>{' '}
                      <span className="text-diff-del-text">-{selectedFile.deletions}</span>{' '}
                      <span className="text-text-muted">({currentIndex + 1}/{files.length})</span>
                    </p>
                  </div>

                  {/* Next button */}
                  <button
                    onClick={goToNextFile}
                    disabled={!hasNext}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-tertiary disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-text-secondary">
                      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Per-file actions */}
                  {currentReview && currentReview.status === 'pending' && (
                    <>
                      <div className="w-px h-6 bg-border" />
                      <button
                        onClick={() => wsId && rejectFile(wsId, selectedFile.path)}
                        className="px-3 py-2 text-xs bg-danger/20 text-danger rounded hover:bg-danger/30"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => wsId && approveFile(wsId, selectedFile.path)}
                        className="px-3 py-2 text-xs bg-success/20 text-success rounded hover:bg-success/30"
                      >
                        Approve
                      </button>
                    </>
                  )}
                </div>
              </div>

              <DiffViewer file={selectedFile} />

              {/* Comments section for current file */}
              {currentReview && (
                <div className="border-t border-border">
                  <DiffCommentList
                    comments={currentReview.comments.filter(
                      (c) => c.filePath === selectedFile.path
                    )}
                    filePath={selectedFile.path}
                  />
                  <DiffCommentInput
                    onSubmit={(content) =>
                      addComment(wsId, selectedFile.path, content)
                    }
                    disabled={currentReview.status !== 'pending'}
                    placeholder={`Comment on ${selectedFile.path.split('/').pop()}...`}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              <button
                onClick={() => setShowFileSheet(true)}
                className="text-accent hover:underline"
              >
                Select a file to view changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      {!isLoading && files.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-bg-secondary flex-shrink-0">
          {currentReview ? (
            <ReviewActions
              status={currentReview.status}
              onApproveAll={() => wsId && approveAll(wsId)}
              onRejectAll={handleRejectAll}
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

      {/* File list Bottom Sheet */}
      <BottomSheet
        isOpen={showFileSheet}
        onClose={() => setShowFileSheet(false)}
        title={`${files.length} files changed`}
      >
        <FileList
          files={files}
          selectedPath={selectedFile?.path || null}
          onSelect={(file) => {
            if (wsId) selectFile(wsId, file);
            setShowFileSheet(false);
          }}
        />
      </BottomSheet>

      {/* Feedback Prompt Dialog */}
      {showFeedbackPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowFeedbackPrompt(false)} />
          <div className="relative bg-bg-elevated rounded-2xl p-6 mx-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Send Feedback to AI?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Your review has comments. Would you like to send them to AI for re-editing?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFeedbackPrompt(false)}
                className="flex-1 py-2.5 bg-bg-tertiary text-text-secondary rounded-xl text-sm font-medium hover:bg-bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendFeedbackToAI}
                className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Send to AI
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
