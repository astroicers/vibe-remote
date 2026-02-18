// Token Usage Card Component
// Shows token usage and cost after AI response completes

import { memo } from 'react';
import type { TokenUsage } from '../../stores/chat';

interface TokenUsageCardProps {
  tokenUsage: TokenUsage;
  onDismiss: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1) + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'K';
  }
  return n.toString();
}

function TokenUsageCardComponent({ tokenUsage, onDismiss }: TokenUsageCardProps) {
  const totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
  const cacheTokens = tokenUsage.cacheReadTokens + tokenUsage.cacheCreationTokens;

  return (
    <div className="mx-4 mb-3 p-3 bg-bg-secondary rounded-lg border border-border animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-accent"
          >
            <path
              fillRule="evenodd"
              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-medium text-text-secondary">Token Usage</span>
        </div>
        <button
          onClick={onDismiss}
          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-muted"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-xs text-text-muted">Input</div>
          <div className="text-sm font-medium text-text-primary">
            {formatNumber(tokenUsage.inputTokens)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Output</div>
          <div className="text-sm font-medium text-text-primary">
            {formatNumber(tokenUsage.outputTokens)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Cache</div>
          <div className="text-sm font-medium text-success">
            {formatNumber(cacheTokens)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Cost</div>
          <div className="text-sm font-medium text-warning">
            ${tokenUsage.costUsd.toFixed(3)}
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Total: {formatNumber(totalTokens)} tokens</span>
          {cacheTokens > 0 && (
            <span className="text-success">
              Cache hit: {((cacheTokens / (totalTokens + cacheTokens)) * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const TokenUsageCard = memo(TokenUsageCardComponent);
