// Context Builder - Assembles system prompt with project context

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getFileTree } from '../workspace/file-tree.js';
import { getGitStatus, getRecentCommits } from '../workspace/git-ops.js';
import type { ProjectContext } from './types.js';

const BASE_SYSTEM_PROMPT = `You are a coding assistant working within the Vibe Remote environment. You help engineers write, modify, and debug code through natural language conversation.

## Environment
- You have access to the project's file system through tools
- The user is on a mobile device and communicates via text or voice
- Keep responses concise and focused — the user is reading on a small screen
- When making changes, explain WHAT you changed and WHY, briefly

## Workflow
1. Understand the user's request
2. Read relevant files using file_read tool if needed
3. Make changes using file_write or file_edit tools
4. Summarize what you did
5. The user will review your changes as a diff

## Guidelines
- Always read existing code before modifying it
- Follow the project's existing code style and patterns
- Add error handling for edge cases
- Write clear commit messages when asked
- If the task is ambiguous, ask for clarification rather than guessing
- Keep your explanations brief and mobile-friendly
- Use code blocks with language tags for any code you show`;

// Key files to include in context
const KEY_FILE_PATTERNS = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  'Dockerfile',
  'docker-compose.yml',
  'README.md',
];

// Max tokens per file (rough estimate: 1 token ≈ 4 chars)
const MAX_FILE_CHARS = 20000; // ~5000 tokens

export async function buildProjectContext(
  workspacePath: string,
  workspaceSystemPrompt?: string
): Promise<ProjectContext> {
  // Get file tree
  const tree = getFileTree(workspacePath, { maxDepth: 3 });
  const fileTree = formatFileTree(tree);

  // Read key files
  const keyFiles: Record<string, string> = {};
  for (const pattern of KEY_FILE_PATTERNS) {
    const filePath = join(workspacePath, pattern);
    if (existsSync(filePath)) {
      try {
        let content = readFileSync(filePath, 'utf-8');

        // Truncate if too long
        if (content.length > MAX_FILE_CHARS) {
          content = content.slice(0, MAX_FILE_CHARS) + '\n... (truncated)';
        }

        // For package.json, only include relevant sections
        if (pattern === 'package.json') {
          content = summarizePackageJson(content);
        }

        keyFiles[pattern] = content;
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Get git info
  let gitInfo = {
    branch: 'unknown',
    status: 'Not a git repository',
    recentCommits: [] as string[],
  };

  try {
    const status = await getGitStatus(workspacePath);
    const commits = await getRecentCommits(workspacePath, 5);

    gitInfo = {
      branch: status.branch,
      status: formatGitStatus(status),
      recentCommits: commits.map((c) => `${c.hash.slice(0, 7)}: ${c.message}`),
    };
  } catch {
    // Not a git repo or git not available
  }

  return {
    fileTree,
    keyFiles,
    gitInfo,
    workspaceSystemPrompt,
  };
}

export function buildSystemPrompt(context: ProjectContext): string {
  const sections: string[] = [BASE_SYSTEM_PROMPT];

  // Workspace-specific system prompt
  if (context.workspaceSystemPrompt) {
    sections.push(`\n## Workspace Instructions\n${context.workspaceSystemPrompt}`);
  }

  // Project structure
  sections.push(`\n## Project Structure\n\`\`\`\n${context.fileTree}\n\`\`\``);

  // Key files
  for (const [filename, content] of Object.entries(context.keyFiles)) {
    sections.push(`\n## ${filename}\n\`\`\`\n${content}\n\`\`\``);
  }

  // Git info
  sections.push(`\n## Git Status
Current branch: ${context.gitInfo.branch}
${context.gitInfo.status}

Recent commits:
${context.gitInfo.recentCommits.map((c) => `  - ${c}`).join('\n') || '  (no commits)'}`);

  return sections.join('\n');
}

export async function buildFullSystemPrompt(
  workspacePath: string,
  workspaceSystemPrompt?: string,
  selectedFiles?: string[]
): Promise<string> {
  const context = await buildProjectContext(workspacePath, workspaceSystemPrompt);
  let systemPrompt = buildSystemPrompt(context);

  // Add selected file contents
  if (selectedFiles && selectedFiles.length > 0) {
    systemPrompt += '\n\n## User-Selected Files\n';

    for (const filePath of selectedFiles) {
      const absolutePath = join(workspacePath, filePath);
      if (existsSync(absolutePath)) {
        try {
          let content = readFileSync(absolutePath, 'utf-8');

          // Truncate large files
          if (content.length > MAX_FILE_CHARS) {
            content = content.slice(0, MAX_FILE_CHARS) + '\n... (truncated)';
          }

          systemPrompt += `\n### ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`;
        } catch {
          systemPrompt += `\n### ${filePath}\n(Could not read file)\n`;
        }
      }
    }
  }

  return systemPrompt;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

function formatFileTree(node: FileNode, prefix = '', isLast = true): string {
  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';

  let result = prefix + connector + node.name;
  if (node.type === 'directory') {
    result += '/';
  }
  result += '\n';

  if (node.children && node.children.length > 0) {
    // Limit display if too many children
    const maxChildren = 50;
    const displayChildren = node.children.slice(0, maxChildren);
    const remaining = node.children.length - maxChildren;

    displayChildren.forEach((child, index) => {
      const isChildLast = index === displayChildren.length - 1 && remaining === 0;
      result += formatFileTree(child, prefix + extension, isChildLast);
    });

    if (remaining > 0) {
      result += prefix + extension + `└── ... and ${remaining} more\n`;
    }
  }

  return result;
}

interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  isClean: boolean;
}

function formatGitStatus(status: GitStatusResult): string {
  const parts: string[] = [];

  if (status.ahead > 0) {
    parts.push(`${status.ahead} commit(s) ahead of remote`);
  }
  if (status.behind > 0) {
    parts.push(`${status.behind} commit(s) behind remote`);
  }
  if (status.staged > 0) {
    parts.push(`${status.staged} file(s) staged`);
  }
  if (status.unstaged > 0) {
    parts.push(`${status.unstaged} file(s) modified`);
  }
  if (status.untracked > 0) {
    parts.push(`${status.untracked} untracked file(s)`);
  }

  if (status.isClean) {
    return 'Working tree clean';
  }

  return parts.join('\n');
}

function summarizePackageJson(content: string): string {
  try {
    const pkg = JSON.parse(content);
    const summary: Record<string, unknown> = {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      scripts: pkg.scripts,
    };

    // Summarize dependencies (just names, not versions)
    if (pkg.dependencies) {
      summary.dependencies = Object.keys(pkg.dependencies);
    }
    if (pkg.devDependencies) {
      summary.devDependencies = Object.keys(pkg.devDependencies);
    }

    return JSON.stringify(summary, null, 2);
  } catch {
    return content;
  }
}
