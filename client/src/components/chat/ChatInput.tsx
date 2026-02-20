// Chat Input Component

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useSpeech } from '../../hooks/useSpeech';
import { useSettingsStore } from '../../stores/settings';
import { AttachButton } from './AttachButton';

interface ChatInputProps {
  onSend: (message: string) => void;
  onQuickActions?: () => void;
  onAttachFiles?: () => void;
  onTemplates?: () => void;
  selectedFileCount?: number;
  disabled?: boolean;
  placeholder?: string;
  prefillText?: string;
}

export function ChatInput({
  onSend,
  onQuickActions,
  onAttachFiles,
  onTemplates,
  selectedFileCount,
  disabled = false,
  placeholder = 'Type a message...',
  prefillText,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { voiceEnabled, voiceLanguage } = useSettingsStore();

  // Speech recognition
  const {
    isSupported: isSpeechSupported,
    isListening,
    isSpeaking,
    interimTranscript,
    error: speechError,
    toggleListening,
    clearTranscript,
  } = useSpeech({
    language: voiceLanguage,
    onFinalResult: (transcript) => {
      setValue((prev) => (prev + ' ' + transcript).trim());
      clearTranscript();
    },
  });

  const showVoiceButton = voiceEnabled && isSpeechSupported;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Prefill text from external source (e.g. prompt templates)
  useEffect(() => {
    if (prefillText) {
      setValue(prefillText);
      // Focus the textarea after prefilling
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [prefillText]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Display value includes interim transcript when listening
  const displayValue = isListening ? (value + ' ' + interimTranscript).trim() : value;

  return (
    <div className="flex flex-col bg-bg-primary border-t border-border">
      {/* Speech error message */}
      {speechError && (
        <div className="px-4 py-2 text-xs text-danger bg-danger/10">
          Speech error: {speechError}
        </div>
      )}

      {/* Listening indicator */}
      {isListening && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-accent bg-accent/10">
          <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-success animate-pulse' : 'bg-accent'}`} />
          {isSpeaking ? 'Listening...' : 'Speak now...'}
        </div>
      )}

      <div className="flex items-end gap-2 p-4">
        {/* Quick Actions button */}
        {onQuickActions && (
          <button
            onClick={onQuickActions}
            disabled={disabled}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-bg-tertiary text-text-secondary hover:bg-bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Quick actions"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Attach files button */}
        {onAttachFiles && (
          <AttachButton
            onClick={onAttachFiles}
            disabled={disabled}
            selectedCount={selectedFileCount}
          />
        )}

        {/* Template button */}
        {onTemplates && (
          <button
            onClick={onTemplates}
            disabled={disabled}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-bg-tertiary text-text-secondary hover:bg-bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Prompt templates"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
              <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
            </svg>
          </button>
        )}

        {/* Voice input button */}
        {showVoiceButton && (
          <button
            onClick={toggleListening}
            disabled={disabled}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${
              isListening
                ? 'bg-danger text-white hover:bg-danger/80'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-surface'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening ? (
              // Stop icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              // Microphone icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
            )}
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-[48px] max-h-[200px] px-4 py-3 bg-bg-surface text-text-primary placeholder-text-muted border border-border rounded-xl resize-none focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
        />

        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="w-12 h-12 flex items-center justify-center bg-accent text-white rounded-full hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
