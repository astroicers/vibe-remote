import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, relative, basename } from 'path';
import ignore, { type Ignore } from 'ignore';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

interface GetFileTreeOptions {
  maxDepth?: number;
  includeHidden?: boolean;
}

// Default patterns to always ignore
const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '*.pyc',
  '__pycache__',
  '.venv',
  'venv',
  '.env',
  '.env.local',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.nyc_output',
];

function loadGitignore(workspacePath: string): Ignore {
  const ig = ignore();

  // Add default ignores
  ig.add(DEFAULT_IGNORES);

  // Load .gitignore if exists
  const gitignorePath = join(workspacePath, '.gitignore');
  if (existsSync(gitignorePath)) {
    try {
      const content = readFileSync(gitignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // Ignore read errors
    }
  }

  return ig;
}

export function getFileTree(
  workspacePath: string,
  options: GetFileTreeOptions = {}
): FileTreeNode {
  const { maxDepth = 5, includeHidden = false } = options;
  const ig = loadGitignore(workspacePath);

  function buildTree(dirPath: string, depth: number): FileTreeNode {
    const name = basename(dirPath);
    const relativePath = relative(workspacePath, dirPath) || '.';

    const node: FileTreeNode = {
      name,
      path: relativePath,
      type: 'directory',
      children: [],
    };

    if (depth >= maxDepth) {
      return node;
    }

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files unless requested
        if (!includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        const entryPath = join(dirPath, entry.name);
        const relPath = relative(workspacePath, entryPath);

        // Check if ignored
        if (ig.ignores(relPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          node.children!.push(buildTree(entryPath, depth + 1));
        } else if (entry.isFile()) {
          node.children!.push({
            name: entry.name,
            path: relPath,
            type: 'file',
          });
        }
      }

      // Sort: directories first, then alphabetically
      node.children!.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch {
      // Permission denied or other errors
    }

    return node;
  }

  return buildTree(workspacePath, 0);
}

export function readFile(workspacePath: string, filePath: string): string {
  const absolutePath = join(workspacePath, filePath);

  // Security check: ensure path is within workspace
  const resolvedPath = join(workspacePath, filePath);
  if (!resolvedPath.startsWith(workspacePath)) {
    throw new Error('Path traversal attempt detected');
  }

  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  // Check file size (max 1MB)
  if (stats.size > 1024 * 1024) {
    throw new Error(`File too large: ${filePath} (max 1MB)`);
  }

  return readFileSync(absolutePath, 'utf-8');
}

export function getFileStats(workspacePath: string, filePath: string): {
  size: number;
  modified: string;
  isDirectory: boolean;
} {
  const absolutePath = join(workspacePath, filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Path not found: ${filePath}`);
  }

  const stats = statSync(absolutePath);

  return {
    size: stats.size,
    modified: stats.mtime.toISOString(),
    isDirectory: stats.isDirectory(),
  };
}
