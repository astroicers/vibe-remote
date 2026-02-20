import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from './Toast';
import { useToastStore } from '../stores/toast';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.restoreAllMocks();
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toast message text', () => {
    useToastStore.setState({
      toasts: [
        { id: 'toast_1', message: 'Hello notification', type: 'info', duration: 5000 },
      ],
    });

    render(<ToastContainer />);
    expect(screen.getByText('Hello notification')).toBeInTheDocument();
  });

  it('applies correct style class for each type', () => {
    useToastStore.setState({
      toasts: [
        { id: 'toast_info', message: 'Info msg', type: 'info', duration: 5000 },
        { id: 'toast_success', message: 'Success msg', type: 'success', duration: 5000 },
        { id: 'toast_error', message: 'Error msg', type: 'error', duration: 8000 },
      ],
    });

    render(<ToastContainer />);

    expect(screen.getByTestId('toast-info')).toHaveClass('bg-accent/90');
    expect(screen.getByTestId('toast-success')).toHaveClass('bg-success/90');
    expect(screen.getByTestId('toast-error')).toHaveClass('bg-danger/90');
  });

  it('click triggers dismiss (removeToast called)', () => {
    useToastStore.setState({
      toasts: [
        { id: 'toast_1', message: 'Click me', type: 'info', duration: 5000 },
      ],
    });

    render(<ToastContainer />);
    fireEvent.click(screen.getByText('Click me'));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('max 3 toasts displayed even if more in store', () => {
    useToastStore.setState({
      toasts: [
        { id: 'toast_1', message: 'Toast 1', type: 'info', duration: 5000 },
        { id: 'toast_2', message: 'Toast 2', type: 'info', duration: 5000 },
        { id: 'toast_3', message: 'Toast 3', type: 'info', duration: 5000 },
        { id: 'toast_4', message: 'Toast 4', type: 'info', duration: 5000 },
      ],
    });

    render(<ToastContainer />);

    // Should only show the last 3 (Toast 2, Toast 3, Toast 4)
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
    expect(screen.getByText('Toast 4')).toBeInTheDocument();
  });
});
