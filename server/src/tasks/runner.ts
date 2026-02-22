// Task Runner — executes tasks using ClaudeSdkRunner
// Supports auto-branch creation: stash → checkout -b → run AI → leave on branch
// Streams real-time progress events (text, tool_use, tool_result, complete) via callback

import type { Task } from './manager.js';
import { ClaudeSdkRunner, type StreamEvent } from '../ai/claude-sdk.js';
import { resolveModelId } from '../ai/models.js';
import { getWorkspace } from '../workspace/manager.js';
import {
  getCurrentBranch,
  branchExists,
  createAndCheckoutBranch,
  stashChanges,
  popStash,
} from '../workspace/git-ops.js';
import { truncateText } from '../utils/truncate.js';

const TOOL_INPUT_TRUNCATE_LIMIT = 500;
const TOOL_RESULT_TRUNCATE_LIMIT = 1000;

export type TaskEventCallback = (event: {
  type: string;
  taskId: string;
  workspaceId: string;
  [key: string]: unknown;
}) => void;

export async function runTask(
  task: Task,
  onEvent?: TaskEventCallback
): Promise<{ result?: string; error?: string }> {
  // 1. Look up workspace
  const workspace = getWorkspace(task.workspace_id);
  if (!workspace) {
    return { error: `Workspace not found: ${task.workspace_id}` };
  }

  // 2. Branch handling
  let originalBranch: string | null = null;
  let didStash = false;

  if (task.branch) {
    try {
      // Check if branch already exists
      const exists = await branchExists(workspace.path, task.branch);
      if (exists) {
        return { error: `Branch already exists: ${task.branch}` };
      }

      // Save current branch for cleanup on failure
      originalBranch = await getCurrentBranch(workspace.path);

      // Stash any uncommitted changes
      didStash = await stashChanges(workspace.path);

      // Create and checkout the task branch
      await createAndCheckoutBranch(workspace.path, task.branch);
    } catch (error) {
      // Cleanup: try to restore original state
      if (didStash && originalBranch) {
        try { await popStash(workspace.path); } catch { /* best effort */ }
      }
      return {
        error: `Failed to setup branch ${task.branch}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // 3. Build prompt from task description + context files
  let prompt = task.description;
  if (task.context_files) {
    try {
      const files = JSON.parse(task.context_files) as string[];
      if (files.length > 0) {
        prompt += `\n\nContext files to focus on:\n${files.map(f => `- ${f}`).join('\n')}`;
      }
    } catch {
      // Invalid JSON in context_files, ignore
    }
  }

  // 4. Create runner and execute
  const runner = new ClaudeSdkRunner();

  // 5. Set up event streaming with 100ms text throttling
  let textBuffer = '';
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const THROTTLE_MS = 100;

  function flushTextBuffer(): void {
    if (textBuffer && onEvent) {
      onEvent({
        type: 'task_progress',
        taskId: task.id,
        workspaceId: task.workspace_id,
        text: textBuffer,
      });
      textBuffer = '';
    }
    flushTimer = null;
  }

  if (onEvent) {
    runner.on('event', (event: StreamEvent) => {
      switch (event.type) {
        case 'text':
          textBuffer += event.content || '';
          if (!flushTimer) {
            flushTimer = setTimeout(flushTextBuffer, THROTTLE_MS);
          }
          break;

        case 'tool_use': {
          flushTextBuffer();
          // Truncate large string values in tool input to avoid oversized WS messages
          let truncatedInput = event.toolInput;
          if (event.toolInput && typeof event.toolInput === 'object') {
            const inputObj = event.toolInput as Record<string, unknown>;
            truncatedInput = { ...inputObj };
            for (const [key, value] of Object.entries(inputObj)) {
              if (typeof value === 'string' && value.length > TOOL_INPUT_TRUNCATE_LIMIT) {
                (truncatedInput as Record<string, unknown>)[key] = truncateText(value, TOOL_INPUT_TRUNCATE_LIMIT);
              }
            }
          }
          onEvent({
            type: 'task_tool_use',
            taskId: task.id,
            workspaceId: task.workspace_id,
            tool: event.toolName || 'unknown',
            input: truncatedInput,
          });
          break;
        }

        case 'tool_result': {
          // Truncate large tool results to avoid oversized WS messages
          let truncatedResult = event.toolResult;
          if (typeof event.toolResult === 'string' && event.toolResult.length > TOOL_RESULT_TRUNCATE_LIMIT) {
            truncatedResult = truncateText(event.toolResult, TOOL_RESULT_TRUNCATE_LIMIT);
          }
          onEvent({
            type: 'task_tool_result',
            taskId: task.id,
            workspaceId: task.workspace_id,
            tool: event.toolName || 'unknown',
            result: truncatedResult,
          });
          break;
        }

        case 'error':
          flushTextBuffer();
          break;

        case 'done':
          flushTextBuffer();
          break;
      }
    });
  }

  try {
    const response = await runner.run(prompt, {
      workspacePath: workspace.path,
      systemPrompt: workspace.systemPrompt || undefined,
      permissionMode: 'bypassPermissions',
      maxTurns: 30,
      model: resolveModelId(),  // uses server default
    });

    // Flush any remaining buffered text
    flushTextBuffer();
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

    // Emit task_complete event
    onEvent?.({
      type: 'task_complete',
      taskId: task.id,
      workspaceId: task.workspace_id,
      status: 'completed',
      result: response.fullText || 'Task completed successfully',
      modifiedFiles: response.modifiedFiles,
      tokenUsage: response.tokenUsage,
    });

    return { result: response.fullText || 'Task completed successfully' };
  } catch (error) {
    // Flush any remaining buffered text
    flushTextBuffer();
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error during task execution';

    // Emit task_complete with failed status
    onEvent?.({
      type: 'task_complete',
      taskId: task.id,
      workspaceId: task.workspace_id,
      status: 'failed',
      error: errorMessage,
      modifiedFiles: [],
    });

    return { error: errorMessage };
  }
}
