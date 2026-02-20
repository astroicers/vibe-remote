// Attach Button - Context file picker trigger

interface AttachButtonProps {
  onClick: () => void;
  disabled?: boolean;
  selectedCount?: number;
}

export function AttachButton({ onClick, disabled, selectedCount = 0 }: AttachButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Attach files"
    >
      {/* Paperclip icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
      >
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>

      {/* Badge */}
      {selectedCount > 0 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center leading-none"
          data-testid="attach-badge"
        >
          {selectedCount}
        </span>
      )}
    </button>
  );
}
