// Toast Store - Simple toast notification state

import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

const MAX_TOASTS = 3;

const DEFAULT_DURATIONS: Record<Toast['type'], number> = {
  success: 5000,
  info: 5000,
  warning: 5000,
  error: 8000,
};

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message: string, type: Toast['type'] = 'info', duration?: number) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const effectiveDuration = duration ?? DEFAULT_DURATIONS[type];
    const toast: Toast = { id, message, type, duration: effectiveDuration };

    set((state) => {
      const updated = [...state.toasts, toast];
      // If exceeding MAX_TOASTS, remove the oldest ones
      const trimmed = updated.length > MAX_TOASTS ? updated.slice(updated.length - MAX_TOASTS) : updated;
      return { toasts: trimmed };
    });

    if (effectiveDuration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, effectiveDuration);
    }
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));
