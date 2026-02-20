import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachButton } from './AttachButton';

describe('AttachButton', () => {
  it('renders the button', () => {
    render(<AttachButton onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<AttachButton onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows badge when selectedCount > 0', () => {
    render(<AttachButton onClick={() => {}} selectedCount={3} />);
    const badge = screen.getByTestId('attach-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });

  it('does not show badge when selectedCount is 0', () => {
    render(<AttachButton onClick={() => {}} selectedCount={0} />);
    expect(screen.queryByTestId('attach-badge')).not.toBeInTheDocument();
  });

  it('does not show badge when selectedCount is not provided', () => {
    render(<AttachButton onClick={() => {}} />);
    expect(screen.queryByTestId('attach-badge')).not.toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<AttachButton onClick={() => {}} disabled />);
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<AttachButton onClick={handleClick} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
