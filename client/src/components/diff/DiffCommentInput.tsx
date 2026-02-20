// Diff Comment Input Component - Simple input for adding comments on diff files

import { useState, useRef, type KeyboardEvent } from 'react';

interface DiffCommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function DiffCommentInput({
  onSubmit,
  disabled = false,
  placeholder = 'Add a comment on this file...',
}: DiffCommentInputProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = value.trim().length > 0 && !isSubmitting && !disabled;

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-bg-primary">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        className="flex-1 h-10 px-3 bg-bg-surface text-text-primary placeholder-text-muted border border-border rounded-lg text-sm focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
        aria-label="Comment input"
      />
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-10 h-10 flex items-center justify-center bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Send comment"
      >
        {isSubmitting ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
