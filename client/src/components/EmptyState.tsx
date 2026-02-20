import { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-12">
      <div className="text-text-muted w-12 h-12">{icon}</div>
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted mt-1">{description}</p>
      )}
      {action && (
        <button
          className="mt-4 bg-accent text-white rounded-xl text-sm font-medium px-4 py-2"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
