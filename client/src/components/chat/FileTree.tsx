// File Tree - Recursive file/directory tree with selection

import { useState } from 'react';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedPaths: Set<string>;
  onToggle: (path: string) => void;
  depth?: number;
}

export function FileTree({ nodes, selectedPaths, onToggle, depth = 0 }: FileTreeProps) {
  return (
    <div role="tree">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedPaths={selectedPaths}
          onToggle={onToggle}
          depth={depth}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  selectedPaths: Set<string>;
  onToggle: (path: string) => void;
  depth: number;
}

function FileTreeNode({ node, selectedPaths, onToggle, depth }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = node.type === 'directory';
  const isSelected = selectedPaths.has(node.path);

  const handleClick = () => {
    if (isDirectory) {
      setExpanded((prev) => !prev);
    } else {
      onToggle(node.path);
    }
  };

  return (
    <div role="treeitem" aria-expanded={isDirectory ? expanded : undefined}>
      <div
        className="flex items-center py-1.5 px-2 rounded-lg hover:bg-bg-tertiary cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {isDirectory ? (
          <>
            {/* Chevron */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 text-text-muted mr-1 transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                clipRule="evenodd"
              />
            </svg>

            {/* Folder icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-text-muted mr-2"
            >
              <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75Z" />
              <path d="M3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z" />
            </svg>

            <span className="text-sm text-text-secondary truncate">{node.name}</span>
          </>
        ) : (
          <>
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(node.path)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 mr-2 rounded border-border accent-accent"
              aria-label={`Select ${node.name}`}
            />

            {/* File icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-text-muted mr-2"
            >
              <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
            </svg>

            <span className="text-sm text-text-primary truncate">{node.name}</span>
          </>
        )}
      </div>

      {/* Children (expanded directories) */}
      {isDirectory && expanded && node.children && (
        <FileTree
          nodes={node.children}
          selectedPaths={selectedPaths}
          onToggle={onToggle}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
