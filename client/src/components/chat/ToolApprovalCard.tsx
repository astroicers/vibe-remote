// Tool Approval Card Component
// Shows pending tool approval requests

import { memo } from 'react';

export interface ToolApprovalInfo {
  toolId: string;
  name: string;
  input: Record<string, unknown>;
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

interface ToolApprovalCardProps {
  approval: ToolApprovalInfo;
  onApprove: (toolId: string) => void;
  onReject: (toolId: string, reason?: string) => void;
  isProcessing?: boolean;
}

function ToolApprovalCardComponent({
  approval,
  onApprove,
  onReject,
  isProcessing,
}: ToolApprovalCardProps) {
  const riskColors = {
    low: 'bg-success/20 text-success border-success/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    high: 'bg-danger/20 text-danger border-danger/30',
  };

  const riskLabels = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  };

  return (
    <div className="mx-4 mb-3 p-4 bg-bg-secondary rounded-xl border border-border shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-accent"
            >
              <path
                fillRule="evenodd"
                d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-text-primary">
              {approval.title}
            </h4>
            <span
              className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${riskColors[approval.risk]}`}
            >
              {riskLabels[approval.risk]}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary mb-3">{approval.description}</p>

      {/* Tool Input Preview (collapsed by default for complex inputs) */}
      {approval.input && Object.keys(approval.input).length > 0 && (
        <details className="mb-3">
          <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
            View details
          </summary>
          <pre className="mt-2 p-2 bg-bg-primary rounded-lg text-xs font-mono overflow-x-auto max-h-32">
            {JSON.stringify(approval.input, null, 2)}
          </pre>
        </details>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onReject(approval.toolId, 'User rejected')}
          disabled={isProcessing}
          className="flex-1 px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm font-medium hover:bg-bg-primary transition-colors disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={() => onApprove(approval.toolId)}
          disabled={isProcessing}
          className="flex-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

export const ToolApprovalCard = memo(ToolApprovalCardComponent);
