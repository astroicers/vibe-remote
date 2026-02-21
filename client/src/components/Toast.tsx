// Toast notification component

import { useRef, useCallback } from 'react';
import { useToastStore, type Toast } from '../stores/toast';

const MAX_VISIBLE = 3;

const typeStyles: Record<Toast['type'], string> = {
  info: 'bg-accent/90 text-white',
  success: 'bg-success/90 text-white',
  warning: 'bg-warning/90 text-black',
  error: 'bg-danger/90 text-white',
};

const typeIcons: Record<Toast['type'], string> = {
  info: '\u2139',      // ℹ
  success: '\u2713',   // ✓
  warning: '\u26A0',   // ⚠
  error: '\u2715',     // ✕
};

interface SwipeState {
  startX: number;
  currentX: number;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const swipeRef = useRef<SwipeState | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeRef.current = {
      startX: e.touches[0].clientX,
      currentX: e.touches[0].clientX,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current || !elementRef.current) return;
    swipeRef.current.currentX = e.touches[0].clientX;
    const deltaX = swipeRef.current.currentX - swipeRef.current.startX;
    elementRef.current.style.transform = `translateX(${deltaX}px)`;
    elementRef.current.style.opacity = `${Math.max(0, 1 - Math.abs(deltaX) / 200)}`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!swipeRef.current || !elementRef.current) return;
    const deltaX = Math.abs(swipeRef.current.currentX - swipeRef.current.startX);
    if (deltaX > 100) {
      onDismiss(toast.id);
    } else {
      elementRef.current.style.transform = 'translateX(0)';
      elementRef.current.style.opacity = '1';
    }
    swipeRef.current = null;
  }, [toast.id, onDismiss]);

  return (
    <div
      ref={elementRef}
      data-testid={`toast-${toast.type}`}
      className={`${typeStyles[toast.type]} px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-auto max-w-[90vw] animate-slide-up flex items-center gap-2 transition-[transform,opacity] duration-150`}
      style={{ willChange: 'transform, opacity' }}
      onClick={() => onDismiss(toast.id)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <span className="text-base flex-shrink-0" aria-hidden="true">{typeIcons[toast.type]}</span>
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  // Only show up to MAX_VISIBLE toasts
  const visibleToasts = toasts.slice(-MAX_VISIBLE);

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[100] flex flex-col-reverse items-center gap-2 p-4 pointer-events-none">
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}
