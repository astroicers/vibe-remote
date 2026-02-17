// AI Tool Definitions and Execution

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import type { ToolDefinition, ToolResultBlock, ModifiedFile } from './types.js';

// Track modified files during a chat session
let modifiedFiles: ModifiedFile[] = [];

export function getModifiedFiles(): ModifiedFile[] {
  return [...modifiedFiles];
}

export function clearModifiedFiles(): void {
  modifiedFiles = [];
}

// Tool definitions for Claude
export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'file_read',
    description: 'Read the contents of a file in the workspace',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: "Relative path from workspace root, e.g. 'src/index.ts'",
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_write',
    description: 'Create a new file or overwrite an existing file',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path from workspace root',
        },
        content: {
          type: 'string',
          description: 'Complete file content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'file_edit',
    description: 'Make targeted edits to a file using search and replace',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path from workspace root',
        },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Exact text to find (must match uniquely)',
              },
              replace: {
                type: 'string',
                description: 'Text to replace with',
              },
            },
            required: ['search', 'replace'],
          },
          description: 'List of search-and-replace operations',
        },
      },
      required: ['path', 'edits'],
    },
  },
  {
    name: 'terminal_run',
    description: 'Run a terminal command in the workspace directory',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_codebase',
    description: 'Search for text patterns across the codebase',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search pattern (literal string or regex)',
        },
        file_pattern: {
          type: 'string',
          description: "Optional file glob pattern, e.g. '*.ts'",
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of results (default: 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'git_diff',
    description: 'View the current uncommitted changes in the workspace',
    input_schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Optional: specific file to diff. If omitted, shows all changes.',
        },
      },
    },
  },
];

// Path validation - prevent path traversal
function validatePath(workspacePath: string, filePath: string): string {
  const absolutePath = resolve(workspacePath, filePath);
  const workspaceAbsolute = resolve(workspacePath);

  if (!absolutePath.startsWith(workspaceAbsolute)) {
    throw new Error('Path traversal not allowed');
  }

  return absolutePath;
}

// Check if file is binary
function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
    '.woff', '.woff2', '.ttf', '.eot',
    '.db', '.sqlite', '.sqlite3',
  ];

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  return binaryExtensions.includes(ext);
}

// Command whitelist for terminal
const ALLOWED_COMMAND_PREFIXES = [
  'npm', 'npx', 'node', 'yarn', 'pnpm',
  'cat', 'head', 'tail', 'grep', 'find', 'ls', 'wc',
  'git status', 'git diff', 'git log', 'git branch', 'git show',
  'tsc', 'eslint', 'prettier',
  'echo', 'pwd', 'which', 'env',
];

const FORBIDDEN_PATTERNS = [
  /rm\s+-rf?\s/i,
  /sudo/i,
  /\bsu\b/i,
  /chmod\s+777/i,
  /curl/i,
  /wget/i,
  /docker/i,
  /kubectl/i,
  /ssh/i,
  /scp/i,
  /eval/i,
  /\$\(/,  // Command substitution
  /`/,     // Backtick command substitution
];

function isCommandAllowed(command: string): boolean {
  // Check forbidden patterns first
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(command)) {
      return false;
    }
  }

  // Check if command starts with allowed prefix
  const trimmedCommand = command.trim().toLowerCase();
  return ALLOWED_COMMAND_PREFIXES.some((prefix) =>
    trimmedCommand.startsWith(prefix.toLowerCase())
  );
}

// Tool execution functions
export function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  workspacePath: string
): ToolResultBlock {
  const toolUseId = `tool_${Date.now()}`;

  try {
    let result: string;

    switch (toolName) {
      case 'file_read':
        result = executeFileRead(workspacePath, toolInput.path as string);
        break;

      case 'file_write':
        result = executeFileWrite(
          workspacePath,
          toolInput.path as string,
          toolInput.content as string
        );
        break;

      case 'file_edit':
        result = executeFileEdit(
          workspacePath,
          toolInput.path as string,
          toolInput.edits as Array<{ search: string; replace: string }>
        );
        break;

      case 'terminal_run':
        result = executeTerminalRun(workspacePath, toolInput.command as string);
        break;

      case 'search_codebase':
        result = executeSearchCodebase(
          workspacePath,
          toolInput.query as string,
          toolInput.file_pattern as string | undefined,
          toolInput.max_results as number | undefined
        );
        break;

      case 'git_diff':
        result = executeGitDiff(workspacePath, toolInput.file as string | undefined);
        break;

      default:
        return {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: `Unknown tool: ${toolName}`,
          is_error: true,
        };
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: result,
    };
  } catch (error) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: error instanceof Error ? error.message : 'Tool execution failed',
      is_error: true,
    };
  }
}

function executeFileRead(workspacePath: string, filePath: string): string {
  const absolutePath = validatePath(workspacePath, filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (isBinaryFile(absolutePath)) {
    return '(binary file, content not shown)';
  }

  const content = readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length > 10000) {
    return (
      lines.slice(0, 5000).join('\n') +
      `\n\n... (truncated, file has ${lines.length} lines) ...\n\n` +
      lines.slice(-100).join('\n')
    );
  }

  return content;
}

function executeFileWrite(
  workspacePath: string,
  filePath: string,
  content: string
): string {
  const absolutePath = validatePath(workspacePath, filePath);
  const isNew = !existsSync(absolutePath);

  // Create directories if needed
  const dir = dirname(absolutePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(absolutePath, content, 'utf-8');

  // Track modified file
  modifiedFiles.push({
    path: filePath,
    operation: isNew ? 'create' : 'update',
  });

  return isNew ? `Created: ${filePath}` : `Updated: ${filePath}`;
}

function executeFileEdit(
  workspacePath: string,
  filePath: string,
  edits: Array<{ search: string; replace: string }>
): string {
  const absolutePath = validatePath(workspacePath, filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let content = readFileSync(absolutePath, 'utf-8');
  const results: string[] = [];

  for (const edit of edits) {
    const occurrences = content.split(edit.search).length - 1;

    if (occurrences === 0) {
      throw new Error(`Search text not found: "${edit.search.slice(0, 50)}..."`);
    }

    if (occurrences > 1) {
      throw new Error(
        `Search text matches ${occurrences} locations. Be more specific: "${edit.search.slice(0, 50)}..."`
      );
    }

    content = content.replace(edit.search, edit.replace);
    results.push(`Replaced 1 occurrence`);
  }

  writeFileSync(absolutePath, content, 'utf-8');

  // Track modified file
  modifiedFiles.push({
    path: filePath,
    operation: 'update',
  });

  return `Edited ${filePath}: ${edits.length} change(s) applied`;
}

function executeTerminalRun(workspacePath: string, command: string): string {
  if (!isCommandAllowed(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  try {
    const output = execSync(command, {
      cwd: workspacePath,
      timeout: 60000, // 60 seconds
      maxBuffer: 1024 * 1024, // 1MB
      encoding: 'utf-8',
    });

    // Truncate if too long
    if (output.length > 5000) {
      return (
        output.slice(0, 2000) +
        `\n\n... (output truncated, ${output.length} chars total) ...\n\n` +
        output.slice(-1000)
      );
    }

    return output || '(command completed with no output)';
  } catch (error) {
    if (error instanceof Error) {
      const execError = error as Error & { stdout?: string; stderr?: string };
      const stderr = execError.stderr || '';
      const stdout = execError.stdout || '';
      return `Command failed:\nstdout: ${stdout}\nstderr: ${stderr}`;
    }
    throw error;
  }
}

function executeSearchCodebase(
  workspacePath: string,
  query: string,
  filePattern?: string,
  maxResults = 20
): string {
  // Use grep since ripgrep might not be installed
  let command = `grep -rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.json' --include='*.md'`;

  if (filePattern) {
    command = `grep -rn --include='${filePattern}'`;
  }

  command += ` '${query.replace(/'/g, "\\'")}' . 2>/dev/null | head -${maxResults}`;

  try {
    const output = execSync(command, {
      cwd: workspacePath,
      timeout: 30000,
      maxBuffer: 512 * 1024,
      encoding: 'utf-8',
    });

    if (!output.trim()) {
      return 'No matches found';
    }

    return output;
  } catch {
    return 'No matches found';
  }
}

function executeGitDiff(workspacePath: string, file?: string): string {
  try {
    let command = 'git diff';
    if (file) {
      command += ` -- '${file}'`;
    }

    const output = execSync(command, {
      cwd: workspacePath,
      timeout: 10000,
      maxBuffer: 512 * 1024,
      encoding: 'utf-8',
    });

    if (!output.trim()) {
      return 'No uncommitted changes';
    }

    // Truncate if too long
    if (output.length > 8000) {
      return (
        output.slice(0, 4000) +
        `\n\n... (diff truncated, ${output.length} chars total) ...\n\n` +
        output.slice(-2000)
      );
    }

    return output;
  } catch {
    return 'Failed to get git diff (not a git repository?)';
  }
}
