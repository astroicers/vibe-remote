// Diff Viewer Component - Shows diff hunks for a file

import type { FileDiff, DiffHunk } from '../../services/api';

interface DiffViewerProps {
  file: FileDiff;
}

export function DiffViewer({ file }: DiffViewerProps) {
  if (file.isBinary) {
    return (
      <div className="p-8 text-center text-text-muted">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bg-tertiary flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-text-secondary">
            <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
          </svg>
        </div>
        <p>Binary file</p>
        <p className="text-sm">Content cannot be displayed</p>
      </div>
    );
  }

  if (file.hunks.length === 0) {
    return (
      <div className="p-8 text-center text-text-muted">
        <p>No changes to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
      {file.hunks.map((hunk, index) => (
        <HunkView key={index} hunk={hunk} />
      ))}
    </div>
  );
}

function HunkView({ hunk }: { hunk: DiffHunk }) {
  const lines = hunk.content.split('\n');

  return (
    <div className="border-b border-border">
      {lines.map((line, index) => {
        const lineType = getLineType(line);

        return (
          <div
            key={index}
            className={`flex font-mono text-[12px] ${
              lineType === 'header'
                ? 'bg-accent/10 text-accent'
                : lineType === 'add'
                ? 'bg-diff-add-bg'
                : lineType === 'delete'
                ? 'bg-diff-del-bg'
                : ''
            }`}
          >
            {/* Line number gutter */}
            <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-text-muted border-r border-border select-none">
              {lineType !== 'header' && index}
            </div>

            {/* Line content */}
            <pre
              className={`flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto ${
                lineType === 'add'
                  ? 'text-diff-add-text'
                  : lineType === 'delete'
                  ? 'text-diff-del-text'
                  : lineType === 'header'
                  ? 'text-accent'
                  : 'text-text-primary'
              }`}
            >
              {line}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function getLineType(line: string): 'header' | 'add' | 'delete' | 'context' {
  if (line.startsWith('@@')) return 'header';
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'delete';
  return 'context';
}
