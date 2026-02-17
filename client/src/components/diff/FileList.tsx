// File List Component - Shows files in a diff

import type { FileDiff } from '../../services/api';

interface FileListProps {
  files: FileDiff[];
  selectedPath: string | null;
  onSelect: (file: FileDiff) => void;
}

export function FileList({ files, selectedPath, onSelect }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="p-4 text-center text-text-muted">
        No files changed
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {files.map((file) => (
        <button
          key={file.path}
          onClick={() => onSelect(file)}
          className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-border hover:bg-bg-tertiary transition-colors ${
            selectedPath === file.path ? 'bg-bg-tertiary' : ''
          }`}
        >
          {/* Status icon */}
          <span
            className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs font-medium ${
              file.status === 'added'
                ? 'bg-success/20 text-success'
                : file.status === 'deleted'
                ? 'bg-danger/20 text-danger'
                : file.status === 'renamed'
                ? 'bg-warning/20 text-warning'
                : 'bg-accent/20 text-accent'
            }`}
          >
            {file.status === 'added'
              ? 'A'
              : file.status === 'deleted'
              ? 'D'
              : file.status === 'renamed'
              ? 'R'
              : 'M'}
          </span>

          {/* File path */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-text-primary truncate">
              {file.path.split('/').pop()}
            </div>
            <div className="text-xs text-text-muted truncate">
              {file.path.split('/').slice(0, -1).join('/')}
            </div>
          </div>

          {/* Stats */}
          <div className="flex-shrink-0 flex items-center gap-2 text-xs">
            {file.insertions > 0 && (
              <span className="text-diff-add-text">+{file.insertions}</span>
            )}
            {file.deletions > 0 && (
              <span className="text-diff-del-text">-{file.deletions}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
