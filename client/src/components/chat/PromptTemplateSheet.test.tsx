import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromptTemplateSheet } from './PromptTemplateSheet';

// Mock the API module
vi.mock('../../services/api', () => ({
  templates: {
    list: vi.fn(),
  },
}));

import { templates } from '../../services/api';

const mockTemplates = [
  {
    id: 'tpl-1',
    workspace_id: 'ws-1',
    name: 'Fix Bug',
    content: 'Please fix the following bug: ',
    sort_order: 1,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'tpl-2',
    workspace_id: null,
    name: 'Code Review',
    content: 'Please review this code and suggest improvements for readability and performance.',
    sort_order: 2,
    created_at: '2025-01-02T00:00:00Z',
  },
];

describe('PromptTemplateSheet', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    workspaceId: 'ws-1',
    onSelectTemplate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', async () => {
    (templates.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
    render(<PromptTemplateSheet {...defaultProps} />);
    expect(screen.getByText('Prompt Templates')).toBeInTheDocument();
    // Wait for the async templates.list to resolve and state to settle
    await waitFor(() => {
      expect(screen.getByText('Fix Bug')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    // Create a promise that never resolves to keep loading state
    (templates.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<PromptTemplateSheet {...defaultProps} />);
    // The spinner has animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows templates after loading', async () => {
    (templates.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
    render(<PromptTemplateSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Fix Bug')).toBeInTheDocument();
    });
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    // Check content previews are shown
    expect(screen.getByText('Please fix the following bug:')).toBeInTheDocument();
  });

  it('calls onSelectTemplate when template is tapped', async () => {
    (templates.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockTemplates);
    render(<PromptTemplateSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Fix Bug')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Fix Bug'));
    expect(defaultProps.onSelectTemplate).toHaveBeenCalledWith('Please fix the following bug: ');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows empty state when no templates', async () => {
    (templates.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<PromptTemplateSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No templates yet')).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    render(<PromptTemplateSheet {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Prompt Templates')).not.toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    (templates.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<PromptTemplateSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
