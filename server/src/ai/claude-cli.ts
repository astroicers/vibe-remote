// Claude Code CLI Integration
// Spawns Claude Code CLI (`claude -p`) to handle AI tasks

import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { config } from '../config.js';

const execPromise = promisify(exec);

export interface ClaudeCliOptions {
  workspacePath: string;
  permissionMode?: 'default' | 'plan' | 'bypassPermissions';
  maxTurns?: number;
  systemPrompt?: string;
}

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'token_usage' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export interface ChatResponse {
  fullText: string;
  modifiedFiles: string[];
  tokenUsage?: TokenUsage;
}

export class ClaudeCliRunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private fullText = '';
  private modifiedFiles: string[] = [];
  private tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
  };

  async run(prompt: string, options: ClaudeCliOptions): Promise<ChatResponse> {
    const cliPath = config.CLAUDE_CLI_PATH || 'claude';

    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',  // Required for stream-json output
      '--max-turns', String(options.maxTurns || 10),
    ];

    // Handle permission mode
    const permissionMode = options.permissionMode || config.CLAUDE_PERMISSION_MODE || 'default';
    if (permissionMode === 'bypassPermissions') {
      args.push('--dangerously-skip-permissions');
    }

    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt);
    }

    this.process = spawn(cliPath, args, {
      cwd: options.workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],  // stdin: ignore (not interactive), stdout/stderr: pipe
      env: { ...process.env, NO_COLOR: '1' },
    });

    // Parse NDJSON stream from stdout
    let buffer = '';
    this.process.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.handleEvent(event);
          } catch {
            // Skip non-JSON lines (e.g., startup messages)
          }
        }
      }
    });

    // Handle stderr (warnings, errors)
    this.process.stderr?.on('data', (chunk: Buffer) => {
      const content = chunk.toString();
      // Filter out common non-error messages
      if (!content.includes('Compiling') && !content.includes('Watching')) {
        this.emit('event', { type: 'error', content } as StreamEvent);
      }
    });

    return new Promise((resolve, reject) => {
      this.process?.on('close', (code) => {
        this.emit('event', { type: 'done' } as StreamEvent);

        if (code === 0) {
          resolve({
            fullText: this.fullText,
            modifiedFiles: this.modifiedFiles,
            tokenUsage: this.tokenUsage.inputTokens > 0 ? this.tokenUsage : undefined,
          });
        } else {
          reject(new Error(`Claude CLI exited with code ${code}`));
        }
      });

      this.process?.on('error', (error) => {
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });
    });
  }

  private handleEvent(event: Record<string, unknown>): void {
    // Handle different event types from Claude CLI stream-json output
    // Reference: https://docs.anthropic.com/en/docs/claude-code/cli-usage

    if (event.type === 'assistant' || event.type === 'content_block_delta') {
      this.handleAssistantEvent(event);
    } else if (event.type === 'result') {
      this.handleResultEvent(event);
    } else if (event.type === 'system') {
      // System messages (e.g., tool execution status)
      const message = event.message as string | undefined;
      if (message) {
        // Track file modifications
        if (message.includes('Wrote') || message.includes('Created')) {
          const match = message.match(/(?:Wrote|Created)\s+(.+)/);
          if (match) {
            this.modifiedFiles.push(match[1].trim());
          }
        }
      }
    }
  }

  private handleAssistantEvent(event: Record<string, unknown>): void {
    // Handle streaming text and tool use from assistant
    const message = event.message as { content?: Array<Record<string, unknown>> } | undefined;

    if (message?.content) {
      for (const block of message.content) {
        if (block.type === 'text') {
          const text = block.text as string;
          this.fullText += text;
          this.emit('event', { type: 'text', content: text } as StreamEvent);
        } else if (block.type === 'tool_use') {
          this.emit('event', {
            type: 'tool_use',
            toolName: block.name as string,
            toolInput: block.input,
          } as StreamEvent);
        }
      }
    }

    // Handle delta updates (streaming)
    const delta = event.delta as { type?: string; text?: string } | undefined;
    if (delta?.type === 'text_delta' && delta.text) {
      this.fullText += delta.text;
      this.emit('event', { type: 'text', content: delta.text } as StreamEvent);
    }
  }

  private handleResultEvent(event: Record<string, unknown>): void {
    // Parse token usage from result event
    // CLI outputs: { usage: {...}, total_cost_usd: 0.xxx }
    const usage = event.usage as Record<string, number> | undefined;
    const totalCost = event.total_cost_usd as number | undefined;

    if (usage) {
      this.tokenUsage.inputTokens = usage.input_tokens || 0;
      this.tokenUsage.outputTokens = usage.output_tokens || 0;
      this.tokenUsage.cacheReadTokens = usage.cache_read_input_tokens || 0;
      this.tokenUsage.cacheCreationTokens = usage.cache_creation_input_tokens || 0;
      this.tokenUsage.costUsd = totalCost || 0;

      this.emit('event', {
        type: 'token_usage',
        tokenUsage: this.tokenUsage,
      } as StreamEvent);
    }

    // Check for result content (for non-streaming results)
    const resultText = event.result as string | undefined;
    if (resultText && typeof resultText === 'string' && !this.fullText) {
      this.fullText = resultText;
    }
  }

  abort(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }
  }
}

// Simple prompt execution (non-streaming) for utility functions
async function runSimplePrompt(
  prompt: string,
  workspacePath: string
): Promise<string> {
  const cliPath = config.CLAUDE_CLI_PATH || 'claude';
  const permissionMode = config.CLAUDE_PERMISSION_MODE || 'bypassPermissions';

  const args = ['-p', prompt, '--output-format', 'text'];
  if (permissionMode === 'bypassPermissions') {
    args.push('--dangerously-skip-permissions');
  }

  try {
    const { stdout } = await execPromise(
      `${cliPath} ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`,
      {
        cwd: workspacePath,
        env: { ...process.env, NO_COLOR: '1' },
        maxBuffer: 10 * 1024 * 1024, // 10MB
      }
    );
    return stdout.trim();
  } catch (error) {
    throw new Error(
      `Claude CLI prompt failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Generate commit message from diff
export async function generateCommitMessage(
  diff: string,
  workspacePath: string
): Promise<string> {
  const prompt = `Based on the following git diff, generate a concise commit message following Conventional Commits format (feat/fix/chore/docs/refactor/test).

Rules:
- First line: type(scope): description (max 72 chars)
- Use imperative mood ("add" not "added")
- Be specific about what changed
- Only output the commit message, nothing else

Diff:
${diff}`;

  return runSimplePrompt(prompt, workspacePath);
}

// Generate PR description
export async function generatePRDescription(
  branchName: string,
  baseBranch: string,
  commits: string[],
  diff: string,
  workspacePath: string
): Promise<string> {
  const prompt = `Generate a pull request description for the following changes.

Branch: ${branchName}
Base: ${baseBranch}
Commits:
${commits.join('\n')}

Full diff:
${diff}

Format:
## Summary
(1-2 sentences)

## Changes
(bullet list of key changes)

## Testing
(what was tested)

Only output the PR description in markdown format, nothing else.`;

  return runSimplePrompt(prompt, workspacePath);
}
