// Task Runner — executes tasks using ClaudeSdkRunner
// Supports auto-branch creation: stash → checkout -b → run AI → leave on branch

import type { Task } from './manager.js';
import { ClaudeSdkRunner } from '../ai/claude-sdk.js';
import { getWorkspace } from '../workspace/manager.js';
import {
  getCurrentBranch,
  branchExists,
  createAndCheckoutBranch,
  stashChanges,
  popStash,
} from '../workspace/git-ops.js';

export async function runTask(task: Task): Promise<{ result?: string; error?: string }> {
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
  try {
    const response = await runner.run(prompt, {
      workspacePath: workspace.path,
      systemPrompt: workspace.systemPrompt || undefined,
      permissionMode: 'bypassPermissions',
      maxTurns: 30,
    });

    return { result: response.fullText || 'Task completed successfully' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error during task execution' };
  }
}
