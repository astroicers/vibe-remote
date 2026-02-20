import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState icon={<span>icon</span>} title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="No items found"
        description="Try adding some items to get started."
      />
    );
    expect(screen.getByText('Try adding some items to get started.')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(
      <EmptyState icon={<span>icon</span>} title="No items found" />
    );
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders action button when provided', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="No items found"
        action={{ label: 'Add Item', onClick: handleClick }}
      />
    );
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('calls onClick when action button is clicked', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="No items found"
        action={{ label: 'Add Item', onClick: handleClick }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders icon', () => {
    render(
      <EmptyState
        icon={<span data-testid="test-icon">icon</span>}
        title="No items found"
      />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
