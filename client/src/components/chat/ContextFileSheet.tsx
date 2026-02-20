// Context File Sheet - BottomSheet wrapper for file selection

import { useState, useEffect, useCallback } from 'react';
import { BottomSheet } from '../BottomSheet';
import { FileTree } from './FileTree';
import { workspaces, type FileNode } from '../../services/api';

interface ContextFileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  selectedFiles: string[];
  onSelectionChange: (files: string[]) => void;
}

export function ContextFileSheet({
  isOpen,
  onClose,
  workspaceId,
  selectedFiles,
  onSelectionChange,
}: ContextFileSheetProps) {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set(selectedFiles));

  // Sync external selectedFiles into internal state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPaths(new Set(selectedFiles));
    }
  }, [isOpen, selectedFiles]);

  // Fetch file tree when sheet opens
  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    workspaces
      .getFiles(workspaceId)
      .then((data) => {
        if (!cancelled) {
          setFileTree(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load files');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, workspaceId]);

  const handleToggle = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleDone = () => {
    onSelectionChange(Array.from(selectedPaths));
    onClose();
  };

  const nodes = fileTree?.children ?? [];

  return (
    <BottomSheet isOpen={isOpen} onClose={handleDone} title="Select Context Files">
      <div className="flex flex-col" style={{ minHeight: '200px' }}>
        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* File tree */}
        {!isLoading && !error && (
          <div className="px-2 py-2 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 160px)' }}>
            {nodes.length > 0 ? (
              <FileTree
                nodes={nodes}
                selectedPaths={selectedPaths}
                onToggle={handleToggle}
              />
            ) : (
              <div className="py-8 text-center text-sm text-text-muted">
                No files found
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        <div className="px-4 py-3 border-t border-border">
          <div className="text-xs text-text-muted text-center mb-2">
            {selectedPaths.size} file{selectedPaths.size !== 1 ? 's' : ''} selected
          </div>
          <button
            onClick={handleDone}
            className="bg-accent text-white w-full py-2.5 rounded-xl font-medium text-sm hover:bg-accent-hover transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
