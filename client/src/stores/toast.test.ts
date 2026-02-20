import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore } from './toast';

describe('useToastStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useToastStore.setState({ toasts: [] });
    vi.restoreAllMocks();
  });

  it('addToast adds a toast with correct defaults', () => {
    useToastStore.getState().addToast('Hello world');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello world');
    expect(toasts[0].type).toBe('info');
    expect(toasts[0].duration).toBe(5000); // info default
    expect(toasts[0].id).toMatch(/^toast_/);
  });

  it('removeToast removes a specific toast', () => {
    useToastStore.getState().addToast('Toast 1');
    useToastStore.getState().addToast('Toast 2');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);

    useToastStore.getState().removeToast(toasts[0].id);
    const updated = useToastStore.getState().toasts;
    expect(updated).toHaveLength(1);
    expect(updated[0].message).toBe('Toast 2');
  });

  it('clearAll removes all toasts', () => {
    useToastStore.getState().addToast('Toast 1');
    useToastStore.getState().addToast('Toast 2');
    useToastStore.getState().addToast('Toast 3');

    expect(useToastStore.getState().toasts).toHaveLength(3);

    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('success type gets 5000ms duration', () => {
    useToastStore.getState().addToast('Success!', 'success');

    const { toasts } = useToastStore.getState();
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].duration).toBe(5000);
  });

  it('error type gets 8000ms duration', () => {
    useToastStore.getState().addToast('Error!', 'error');

    const { toasts } = useToastStore.getState();
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].duration).toBe(8000);
  });

  it('custom duration overrides default', () => {
    useToastStore.getState().addToast('Custom', 'error', 2000);

    const { toasts } = useToastStore.getState();
    expect(toasts[0].duration).toBe(2000);
  });

  it('adding 4th toast removes the oldest (max 3)', () => {
    useToastStore.getState().addToast('Toast 1');
    useToastStore.getState().addToast('Toast 2');
    useToastStore.getState().addToast('Toast 3');

    expect(useToastStore.getState().toasts).toHaveLength(3);

    useToastStore.getState().addToast('Toast 4');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(3);
    // Oldest (Toast 1) should be gone
    expect(toasts.map((t) => t.message)).toEqual(['Toast 2', 'Toast 3', 'Toast 4']);
  });

  it('auto-dismiss calls removeToast after duration', () => {
    vi.useFakeTimers();

    useToastStore.getState().addToast('Will auto-dismiss', 'info', 3000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);

    vi.useRealTimers();
  });
});
