// Text and File Truncation Utilities
// Prevents excessive token usage by limiting content sizes

import { statSync } from 'fs';
import { extname } from 'path';

/** Content size limits */
export const LIMITS = {
  /** Maximum characters for a single message */
  messageContent: 2000,
  /** Maximum messages to include in history (fallback when no session resume) */
  historyCount: 5,
  /** Maximum size for text files (1MB) */
  textFileSize: 1 * 1024 * 1024,
  /** Maximum size for non-text attachments (20MB) */
  attachmentSize: 20 * 1024 * 1024,
  /** Maximum characters for code blocks (leave room for markdown) */
  codeBlockSize: 1900,
};

/** Text file extensions */
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.yaml', '.yml',
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.swift',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.xml', '.svg', '.sql', '.sh', '.bash', '.zsh',
  '.env', '.gitignore', '.dockerignore', '.editorconfig',
  '.toml', '.ini', '.cfg', '.conf', '.properties',
  '.vue', '.svelte', '.astro',
]);

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number = LIMITS.messageContent): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate message content for storage/history
 */
export function truncateForHistory(message: string): string {
  return truncateText(message, LIMITS.messageContent);
}

/**
 * Truncate code block content
 */
export function truncateCodeBlock(code: string): string {
  return truncateText(code, LIMITS.codeBlockSize);
}

/**
 * Check if a file extension indicates a text file
 */
export function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

/**
 * Check file size and determine if it's within limits
 */
export function checkFileSize(filePath: string): {
  ok: boolean;
  size: number;
  limit: number;
  isText: boolean;
} {
  try {
    const stats = statSync(filePath);
    const isText = isTextFile(filePath);
    const limit = isText ? LIMITS.textFileSize : LIMITS.attachmentSize;

    return {
      ok: stats.size <= limit,
      size: stats.size,
      limit,
      isText,
    };
  } catch {
    // File doesn't exist or can't be read
    return {
      ok: false,
      size: 0,
      limit: 0,
      isText: false,
    };
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Truncate an array of messages to the most recent N items
 */
export function truncateHistory<T>(messages: T[], maxCount: number = LIMITS.historyCount): T[] {
  if (messages.length <= maxCount) return messages;
  return messages.slice(-maxCount);
}
