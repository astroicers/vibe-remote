interface SkeletonLineProps {
  className?: string;
}

export function SkeletonLine({ className = '' }: SkeletonLineProps) {
  return <div className={`h-4 bg-bg-tertiary rounded animate-pulse ${className}`} />;
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`p-4 bg-bg-secondary rounded-xl border border-border space-y-3 ${className}`}>
      <SkeletonLine className="w-3/4 h-4" />
      <SkeletonLine className="w-full h-3" />
      <SkeletonLine className="w-1/2 h-3" />
    </div>
  );
}

interface SkeletonListProps {
  count?: number;
  variant?: 'card' | 'line';
  className?: string;
}

export function SkeletonList({ count = 3, variant = 'card', className = '' }: SkeletonListProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }, (_, i) =>
        variant === 'card' ? <SkeletonCard key={i} /> : <SkeletonLine key={i} className="h-10" />
      )}
    </div>
  );
}
