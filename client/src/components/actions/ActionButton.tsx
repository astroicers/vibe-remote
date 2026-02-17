// Action Button Component - Reusable button for quick actions

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  loading?: boolean;
}

export function ActionButton({
  icon,
  label,
  description,
  onClick,
  disabled,
  variant = 'default',
  loading,
}: ActionButtonProps) {
  const variantStyles = {
    default: 'bg-bg-tertiary hover:bg-bg-surface text-text-primary',
    success: 'bg-success/20 hover:bg-success/30 text-success',
    danger: 'bg-danger/20 hover:bg-danger/30 text-danger',
    warning: 'bg-warning/20 hover:bg-warning/30 text-warning',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]}`}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-bg-primary/50">
        {loading ? (
          <svg
            className="w-5 h-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          icon
        )}
      </div>

      <div className="flex-1 text-left">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-text-muted mt-0.5">{description}</div>
        )}
      </div>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4 text-text-muted"
      >
        <path
          fillRule="evenodd"
          d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
