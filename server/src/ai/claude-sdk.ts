// Claude Agent SDK Integration
// Uses @anthropic-ai/claude-agent-sdk for programmatic AI access
//
// Authentication (one of these is required):
// 1. CLAUDE_CODE_OAUTH_TOKEN - OAuth token from `claude setup-token` (uses Max subscription)
// 2. ANTHROPIC_API_KEY - API key from console.anthropic.com (pay-per-use)
// 3. Claude Code CLI logged in via `claude login`

import { query, type Options, type SDKMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'events';
import { config } from '../config.js';

// Check authentication on module load
function checkAuthConfiguration(): void {
  const hasOAuthToken = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  if (!hasOAuthToken && !hasApiKey) {
    console.warn('⚠️  No Claude authentication configured.');
    console.warn('   Set one of the following environment variables:');
    console.warn('   - CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`, uses Max subscription)');
    console.warn('   - ANTHROPIC_API_KEY (from console.anthropic.com, pay-per-use)');
    console.warn('   Or ensure Claude Code CLI is logged in via `claude login`');
  } else if (hasOAuthToken) {
    console.log('✅ Claude authentication: OAuth token configured');
  } else if (hasApiKey) {
    console.log('✅ Claude authentication: API key configured');
  }
}

// Run auth check on module load
checkAuthConfiguration();

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

export interface ClaudeSdkOptions {
  workspacePath: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  maxTurns?: number;
  systemPrompt?: string;
  /** Session ID to resume an existing conversation */
  resumeSessionId?: string;
  /** Claude model ID override (e.g. 'claude-sonnet-4-20250514', 'claude-opus-4-20250514') */
  model?: string;
}

export interface ChatResponse {
  fullText: string;
  modifiedFiles: string[];
  tokenUsage?: TokenUsage;
  /** Session ID returned by SDK for future resume */
  sessionId?: string;
}

export class ClaudeSdkRunner extends EventEmitter {
  private abortController: AbortController | null = null;
  private queryInstance: ReturnType<typeof query> | null = null;

  async run(prompt: string, options: ClaudeSdkOptions): Promise<ChatResponse> {
    this.abortController = new AbortController();

    let fullText = '';
    const modifiedFiles: string[] = [];
    let tokenUsage: TokenUsage | undefined;
    let sessionId: string | undefined;

    const sdkOptions: Options = {
      model: options.model || config.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      cwd: options.workspacePath,
      maxTurns: options.maxTurns || 20,
      abortController: this.abortController,
      includePartialMessages: true, // Enable streaming
      // NOTE: Session resume disabled — SDK's persistSession/resume doesn't work
      // reliably in Docker (session files not found across spawned processes).
      // History is sent inline instead. Re-enable when SDK supports stable resume.
    };

    // Handle permission mode
    if (options.permissionMode === 'bypassPermissions') {
      sdkOptions.permissionMode = 'bypassPermissions';
      sdkOptions.allowDangerouslySkipPermissions = true;
    } else if (options.permissionMode === 'acceptEdits') {
      sdkOptions.permissionMode = 'acceptEdits';
    }

    // System prompt via extraArgs (SDK uses --system-prompt flag)
    if (options.systemPrompt) {
      sdkOptions.extraArgs = {
        'system-prompt': options.systemPrompt,
      };
    }

    this.queryInstance = query({ prompt, options: sdkOptions });

    try {
      for await (const message of this.queryInstance) {
        this.handleMessage(message, fullText, modifiedFiles, (text) => {
          fullText += text;
        }, (usage) => {
          tokenUsage = usage;
        }, (sid) => {
          sessionId = sid;
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Query was aborted, not an error
      } else {
        let errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Provide helpful guidance for common errors
        if (errorMessage.includes('exit') || errorMessage.includes('code 1')) {
          const hasOAuthToken = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
          const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

          if (!hasOAuthToken && !hasApiKey) {
            errorMessage =
              'Claude authentication failed. Please set CLAUDE_CODE_OAUTH_TOKEN (run `claude setup-token`) or ANTHROPIC_API_KEY environment variable.';
          }
        }

        this.emit('event', {
          type: 'error',
          content: errorMessage,
        } as StreamEvent);
        throw new Error(errorMessage);
      }
    }

    this.emit('event', { type: 'done' } as StreamEvent);

    return {
      fullText,
      modifiedFiles: [...new Set(modifiedFiles)], // Deduplicate
      tokenUsage,
      sessionId,
    };
  }

  private handleMessage(
    message: SDKMessage,
    _fullText: string,
    modifiedFiles: string[],
    appendText: (text: string) => void,
    setTokenUsage: (usage: TokenUsage) => void,
    setSessionId: (sessionId: string) => void
  ): void {
    // Extract session_id from any message that contains it
    if ('session_id' in message && typeof message.session_id === 'string') {
      setSessionId(message.session_id);
    }
    switch (message.type) {
      case 'assistant':
        // Handle complete assistant message
        for (const block of message.message.content) {
          if (block.type === 'text') {
            appendText(block.text);
            this.emit('event', { type: 'text', content: block.text } as StreamEvent);
          } else if (block.type === 'tool_use') {
            this.emit('event', {
              type: 'tool_use',
              toolName: block.name,
              toolInput: block.input,
            } as StreamEvent);

            // Track file modifications
            if (block.name === 'Write' || block.name === 'Edit') {
              const input = block.input as { file_path?: string };
              if (input.file_path) {
                modifiedFiles.push(input.file_path);
              }
            }
          }
        }
        break;

      case 'stream_event':
        // Handle streaming delta (partial messages)
        if (message.event.type === 'content_block_delta') {
          const delta = message.event.delta as { type?: string; text?: string };
          if (delta.type === 'text_delta' && delta.text) {
            appendText(delta.text);
            this.emit('event', { type: 'text', content: delta.text } as StreamEvent);
          }
        }
        break;

      case 'result':
        // Final result with token usage
        this.handleResultMessage(message, setTokenUsage);
        break;

      case 'system':
        // System messages (session info, etc.)
        // Usually contains session_id, tools list, etc.
        break;

      default:
        // Other message types (status, hook progress, etc.)
        break;
    }
  }

  private handleResultMessage(
    message: SDKResultMessage,
    setTokenUsage: (usage: TokenUsage) => void
  ): void {
    const usage: TokenUsage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens || 0,
      cacheCreationTokens: message.usage.cache_creation_input_tokens || 0,
      costUsd: message.total_cost_usd,
    };

    setTokenUsage(usage);
    this.emit('event', { type: 'token_usage', tokenUsage: usage } as StreamEvent);

    if (message.subtype !== 'success') {
      // Handle error cases
      const errorResult = message as { errors?: string[] };
      const errorMessage = errorResult.errors?.join(', ') || `Query ended with: ${message.subtype}`;
      this.emit('event', { type: 'error', content: errorMessage } as StreamEvent);
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.queryInstance) {
      this.queryInstance.close();
    }
  }
}

// Simple prompt execution (non-streaming) for utility functions
async function runSimplePrompt(prompt: string, workspacePath: string): Promise<string> {
  const sdkOptions: Options = {
    model: config.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    cwd: workspacePath,
    maxTurns: 1,
    tools: [], // No tools for simple prompts
    persistSession: false,
  };

  const permissionMode = config.CLAUDE_PERMISSION_MODE || 'bypassPermissions';
  if (permissionMode === 'bypassPermissions') {
    sdkOptions.permissionMode = 'bypassPermissions';
    sdkOptions.allowDangerouslySkipPermissions = true;
  }

  let result = '';

  for await (const message of query({ prompt, options: sdkOptions })) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          result += block.text;
        }
      }
    } else if (message.type === 'result' && message.subtype === 'success') {
      // Use result field if available and no text was accumulated
      if (!result && 'result' in message && typeof message.result === 'string') {
        result = message.result;
      }
    }
  }

  return result.trim();
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
