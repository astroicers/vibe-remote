// Review Actions Component - Approve/Reject buttons

interface ReviewActionsProps {
  status: 'pending' | 'approved' | 'rejected' | 'partial';
  onApproveAll: () => void;
  onRejectAll: () => void;
  isLoading?: boolean;
}

export function ReviewActions({
  status,
  onApproveAll,
  onRejectAll,
  isLoading,
}: ReviewActionsProps) {
  const isResolved = status === 'approved' || status === 'rejected';

  return (
    <div className="flex items-center gap-3">
      {/* Status badge */}
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          status === 'approved'
            ? 'bg-success/20 text-success'
            : status === 'rejected'
            ? 'bg-danger/20 text-danger'
            : status === 'partial'
            ? 'bg-warning/20 text-warning'
            : 'bg-accent/20 text-accent'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>

      {/* Action buttons */}
      {!isResolved && (
        <>
          <button
            onClick={onRejectAll}
            disabled={isLoading}
            className="px-4 py-3 min-h-[44px] bg-danger/20 text-danger rounded-lg text-sm font-medium hover:bg-danger/30 disabled:opacity-50 transition-colors"
          >
            Reject All
          </button>

          <button
            onClick={onApproveAll}
            disabled={isLoading}
            className="px-4 py-3 min-h-[44px] bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"
          >
            Approve All
          </button>
        </>
      )}
    </div>
  );
}
