import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiffPage } from './DiffPage';

// Mock react-router-dom navigate and searchParams
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

// Mock child components
vi.mock('../components/diff', () => ({
  FileList: ({ files, onSelect }: any) => (
    <div data-testid="file-list">
      {files.map((f: any) => (
        <button key={f.path} onClick={() => onSelect(f)}>
          {f.path}
        </button>
      ))}
    </div>
  ),
  DiffViewer: ({ file }: any) => (
    <div data-testid="diff-viewer">{file.path}</div>
  ),
  ReviewActions: ({ status, onApproveAll, onRejectAll }: any) => (
    <div data-testid="review-actions" data-status={status}>
      <button onClick={onApproveAll}>Approve All</button>
      <button onClick={onRejectAll}>Reject All</button>
    </div>
  ),
  DiffCommentInput: () => <div data-testid="diff-comment-input" />,
  DiffCommentList: () => <div data-testid="diff-comment-list" />,
}));

vi.mock('../components/AppLayout', () => ({
  AppLayout: ({ children }: any) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('../components/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children, title }: any) =>
    isOpen ? (
      <div data-testid="bottom-sheet">
        <span>{title}</span>
        {children}
      </div>
    ) : null,
}));

// Mock stores
const mockLoadCurrentDiff = vi.fn();
const mockLoadReview = vi.fn();
const mockCreateReview = vi.fn();
const mockApproveAll = vi.fn();
const mockRejectAll = vi.fn();
const mockApproveFile = vi.fn();
const mockRejectFile = vi.fn();
const mockAddComment = vi.fn();
const mockSelectFile = vi.fn();
const mockClearError = vi.fn();

let mockDiffStoreState: Record<string, any> = {};

vi.mock('../stores/diff', () => ({
  useDiffStore: (selector?: (state: any) => any) => {
    const state = {
      getDiffState: vi.fn().mockImplementation(() => {
        return {
          currentDiff: mockDiffStoreState.currentDiff ?? null,
          currentReview: mockDiffStoreState.currentReview ?? null,
          selectedFile: mockDiffStoreState.selectedFile ?? null,
        };
      }),
      isLoading: mockDiffStoreState.isLoading ?? false,
      error: mockDiffStoreState.error ?? null,
      loadCurrentDiff: mockLoadCurrentDiff,
      loadReview: mockLoadReview,
      createReview: mockCreateReview,
      approveAll: mockApproveAll,
      rejectAll: mockRejectAll,
      approveFile: mockApproveFile,
      rejectFile: mockRejectFile,
      addComment: mockAddComment,
      selectFile: mockSelectFile,
      clearError: mockClearError,
    };
    return selector ? selector(state) : state;
  },
}));

let mockWorkspaceStoreState: Record<string, any> = {};

vi.mock('../stores/workspace', () => ({
  useWorkspaceStore: (selector?: (state: any) => any) => {
    const state = {
      selectedWorkspaceId: mockWorkspaceStoreState.selectedWorkspaceId ?? null,
    };
    return selector ? selector(state) : state;
  },
}));

const mockFileDiff = {
  path: 'src/index.ts',
  status: 'modified' as const,
  insertions: 10,
  deletions: 3,
  diff: '@@ -1,3 +1,10 @@',
};

const mockFileDiff2 = {
  path: 'src/utils.ts',
  status: 'added' as const,
  insertions: 20,
  deletions: 0,
  diff: '@@ -0,0 +1,20 @@',
};

function renderDiffPage() {
  return render(
    <MemoryRouter>
      <DiffPage />
    </MemoryRouter>
  );
}

describe('DiffPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiffStoreState = {};
    mockWorkspaceStoreState = {};
    mockSearchParams = new URLSearchParams();
  });

  it('shows empty state when no workspace and no files', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = null;
    renderDiffPage();

    expect(screen.getByText('No changes')).toBeInTheDocument();
    expect(screen.getByText('Working tree is clean. Make some changes to see the diff.')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockDiffStoreState.isLoading = true;
    renderDiffPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error banner when error is set', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockDiffStoreState.error = 'Failed to load diff';
    renderDiffPage();

    expect(screen.getByText('Failed to load diff')).toBeInTheDocument();
  });

  it('shows file header when files are present', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockDiffStoreState.currentDiff = {
      files: [mockFileDiff, mockFileDiff2],
      totalInsertions: 30,
      totalDeletions: 3,
    };
    mockDiffStoreState.selectedFile = mockFileDiff;
    renderDiffPage();

    // File name shown in header
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    // Header shows file count
    expect(screen.getByText(/2 file\(s\)/)).toBeInTheDocument();
  });

  it('shows prev/next navigation buttons', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockDiffStoreState.currentDiff = {
      files: [mockFileDiff, mockFileDiff2],
      totalInsertions: 30,
      totalDeletions: 3,
    };
    mockDiffStoreState.selectedFile = mockFileDiff;
    renderDiffPage();

    // The navigation buttons exist in the file header section
    expect(screen.getByText('(1/2)')).toBeInTheDocument();
  });

  it('calls loadCurrentDiff on mount when workspace is selected and no reviewId', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    renderDiffPage();

    expect(mockLoadCurrentDiff).toHaveBeenCalledWith('ws-1');
  });

  it('calls loadReview when reviewId search param is present', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockSearchParams = new URLSearchParams('review=review-123');
    renderDiffPage();

    expect(mockLoadReview).toHaveBeenCalledWith('ws-1', 'review-123');
    expect(mockLoadCurrentDiff).not.toHaveBeenCalled();
  });

  it('shows "Start Review" button when no active review and files exist', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockDiffStoreState.currentDiff = {
      files: [mockFileDiff],
      totalInsertions: 10,
      totalDeletions: 3,
    };
    mockDiffStoreState.selectedFile = mockFileDiff;
    renderDiffPage();

    expect(screen.getByText('Start Review')).toBeInTheDocument();
  });

  it('shows ReviewActions when there is an active review', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockDiffStoreState.currentReview = {
      id: 'review-1',
      status: 'pending',
      files: [mockFileDiff],
      comments: [],
    };
    mockDiffStoreState.selectedFile = mockFileDiff;
    renderDiffPage();

    expect(screen.getByTestId('review-actions')).toBeInTheDocument();
  });

  it('calls selectFile with first file when diff loads and no file is selected', () => {
    mockWorkspaceStoreState.selectedWorkspaceId = 'ws-1';
    mockDiffStoreState.currentDiff = {
      files: [mockFileDiff, mockFileDiff2],
      totalInsertions: 30,
      totalDeletions: 3,
    };
    // No selectedFile — should auto-select
    mockDiffStoreState.selectedFile = null;
    renderDiffPage();

    expect(mockSelectFile).toHaveBeenCalledWith('ws-1', mockFileDiff);
  });
});
