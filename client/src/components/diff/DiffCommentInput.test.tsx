import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiffCommentInput } from './DiffCommentInput';

describe('DiffCommentInput', () => {
  it('renders the input and send button', () => {
    render(<DiffCommentInput onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Comment input')).toBeInTheDocument();
    expect(screen.getByLabelText('Send comment')).toBeInTheDocument();
  });

  it('shows custom placeholder', () => {
    render(<DiffCommentInput onSubmit={vi.fn()} placeholder="Custom placeholder" />);
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('shows default placeholder', () => {
    render(<DiffCommentInput onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText('Add a comment on this file...')).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    render(<DiffCommentInput onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Send comment')).toBeDisabled();
  });

  it('send button is enabled when input has text', async () => {
    const user = userEvent.setup();
    render(<DiffCommentInput onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText('Comment input'), 'Hello');
    expect(screen.getByLabelText('Send comment')).not.toBeDisabled();
  });

  it('calls onSubmit with trimmed value on button click', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DiffCommentInput onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText('Comment input'), '  Hello world  ');
    await user.click(screen.getByLabelText('Send comment'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith('Hello world');
    });
  });

  it('calls onSubmit on Enter key', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DiffCommentInput onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText('Comment input'), 'Hello{enter}');

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith('Hello');
    });
  });

  it('clears input after successful submit', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DiffCommentInput onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText('Comment input'), 'Hello');
    await user.click(screen.getByLabelText('Send comment'));

    await waitFor(() => {
      expect(screen.getByLabelText('Comment input')).toHaveValue('');
    });
  });

  it('does not submit when disabled', () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DiffCommentInput onSubmit={handleSubmit} disabled />);

    // Input should be disabled
    expect(screen.getByLabelText('Comment input')).toBeDisabled();
  });

  it('does not submit whitespace-only input', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DiffCommentInput onSubmit={handleSubmit} />);

    const input = screen.getByLabelText('Comment input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText('Send comment'));

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
