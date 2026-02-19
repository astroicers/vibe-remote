// Toast notification component

import { useToastStore } from '../stores/toast';

const typeStyles = {
  info: 'bg-accent/90 text-white',
  success: 'bg-success/90 text-white',
  warning: 'bg-warning/90 text-black',
  error: 'bg-danger/90 text-white',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] left-0 right-0 z-[100] flex flex-col items-center gap-2 p-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${typeStyles[toast.type]} px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg pointer-events-auto max-w-[90vw] animate-slide-down`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
