import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BranchSelector } from './BranchSelector';

// Mock the API module
vi.mock('../../services/api', () => ({
  workspaces: {
    getBranches: vi.fn(),
    checkout: vi.fn(),
  },
}));

// Mock the workspace store
vi.mock('../../stores/workspace', () => ({
  useWorkspaceStore: () => ({
    loadGitStatus: vi.fn(),
    loadBranches: vi.fn(),
  }),
}));

import { workspaces } from '../../services/api';

const mockBranches = {
  current: 'main',
  all: ['main', 'feat/login', 'fix/bug-123'],
};

describe('BranchSelector', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    workspaceId: 'ws-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', async () => {
    (workspaces.getBranches as ReturnType<typeof vi.fn>).mockResolvedValue(mockBranches);
    render(<BranchSelector {...defaultProps} />);
    expect(screen.getByText('Branches')).toBeInTheDocument();
    // Wait for the async getBranches to resolve and state to settle
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', () => {
    (workspaces.getBranches as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<BranchSelector {...defaultProps} />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows branch list after loading', async () => {
    (workspaces.getBranches as ReturnType<typeof vi.fn>).mockResolvedValue(mockBranches);
    render(<BranchSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });
    expect(screen.getByText('feat/login')).toBeInTheDocument();
    expect(screen.getByText('fix/bug-123')).toBeInTheDocument();
  });

  it('highlights the current branch', async () => {
    (workspaces.getBranches as ReturnType<typeof vi.fn>).mockResolvedValue(mockBranches);
    render(<BranchSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    // The current branch button should be disabled
    const mainButton = screen.getByText('main').closest('button');
    expect(mainButton).toBeDisabled();
  });

  it('has a new branch input', async () => {
    (workspaces.getBranches as ReturnType<typeof vi.fn>).mockResolvedValue(mockBranches);
    render(<BranchSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New branch name...')).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    render(<BranchSelector {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Branches')).not.toBeInTheDocument();
  });

  it('shows error on fetch failure', async () => {
    (workspaces.getBranches as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<BranchSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('calls checkout when a non-current branch is clicked', async () => {
    (workspaces.getBranches as ReturnType<typeof vi.fn>).mockResolvedValue(mockBranches);
    (workspaces.checkout as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    render(<BranchSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('feat/login')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('feat/login'));

    await waitFor(() => {
      expect(workspaces.checkout).toHaveBeenCalledWith('ws-1', 'feat/login', false);
    });
  });
});
