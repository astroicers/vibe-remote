import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PullToRefresh } from './PullToRefresh';

describe('PullToRefresh', () => {
  it('renders children', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div>Child content</div>
      </PullToRefresh>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders the spinner indicator element', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <div>Child content</div>
      </PullToRefresh>,
    );

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('border-accent', 'border-t-transparent', 'rounded-full');
  });

  it('renders with the correct container classes', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <div>Child content</div>
      </PullToRefresh>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('relative', 'overflow-auto', 'flex-1');
  });

  it('does not call onRefresh without interaction', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div>Child content</div>
      </PullToRefresh>,
    );
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
