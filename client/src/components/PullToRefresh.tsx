import { ReactNode, useCallback, useRef, useState } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

type PullState = 'idle' | 'pulling' | 'refreshing';

const PULL_THRESHOLD = 60;
const MAX_PULL = 80;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [state, setState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (state === 'refreshing') return;
      const container = containerRef.current;
      if (!container || container.scrollTop !== 0) return;

      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
    },
    [state],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (state === 'refreshing') return;
      const container = containerRef.current;
      if (!container || container.scrollTop !== 0) return;

      currentYRef.current = e.touches[0].clientY;
      const delta = currentYRef.current - startYRef.current;

      if (delta > 0) {
        const distance = Math.min(delta, MAX_PULL);
        setPullDistance(distance);
        setState('pulling');
      }
    },
    [state],
  );

  const handleTouchEnd = useCallback(async () => {
    if (state === 'refreshing') return;

    if (pullDistance >= PULL_THRESHOLD) {
      setState('refreshing');
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setState('idle');
        setPullDistance(0);
      }
    } else {
      setState('idle');
      setPullDistance(0);
    }
  }, [state, pullDistance, onRefresh]);

  const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto flex-1"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Spinner indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none"
        style={{
          transform: `translateY(${pullDistance}px)`,
          opacity,
          transition: state === 'idle' ? 'transform 0.2s ease, opacity 0.2s ease' : undefined,
        }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>

      {/* Children with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: state === 'idle' ? 'transform 0.2s ease' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
