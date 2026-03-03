import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function createContainer(...tags: string[]) {
  const div = document.createElement('div');
  tags.forEach((tag) => {
    const el = document.createElement(tag);
    div.appendChild(el);
  });
  document.body.appendChild(div);
  return div;
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses first focusable element when active', () => {
    const container = createContainer('button', 'button');
    const ref = { current: container };
    const buttons = container.querySelectorAll('button');

    renderHook(() => useFocusTrap(ref, true));

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('does not focus when inactive', () => {
    const container = createContainer('button', 'button');
    const ref = { current: container };

    const prevFocus = document.activeElement;
    renderHook(() => useFocusTrap(ref, false));

    expect(document.activeElement).toBe(prevFocus);
  });

  it('traps Tab at last element (wraps to first)', () => {
    const container = createContainer('button', 'button');
    const ref = { current: container };
    const buttons = container.querySelectorAll('button');

    renderHook(() => useFocusTrap(ref, true));

    // Focus last button
    buttons[1].focus();
    expect(document.activeElement).toBe(buttons[1]);

    // Simulate Tab on last element
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const prevented = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(prevented).toHaveBeenCalled();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('traps Shift+Tab at first element (wraps to last)', () => {
    const container = createContainer('button', 'button');
    const ref = { current: container };
    const buttons = container.querySelectorAll('button');

    renderHook(() => useFocusTrap(ref, true));

    // First button is already focused
    expect(document.activeElement).toBe(buttons[0]);

    // Simulate Shift+Tab on first element
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    const prevented = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(prevented).toHaveBeenCalled();
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('restores focus on cleanup', () => {
    const outer = document.createElement('button');
    document.body.appendChild(outer);
    outer.focus();
    expect(document.activeElement).toBe(outer);

    const container = createContainer('button');
    const ref = { current: container };

    const { unmount } = renderHook(() => useFocusTrap(ref, true));

    // Focus moved to container's button
    expect(document.activeElement).toBe(container.querySelector('button'));

    // Unmount should restore focus
    unmount();
    expect(document.activeElement).toBe(outer);
  });

  it('handles empty container gracefully', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const ref = { current: container };

    // Should not throw
    expect(() => {
      renderHook(() => useFocusTrap(ref, true));
    }).not.toThrow();
  });
});
