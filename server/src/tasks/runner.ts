// Task Runner — executes tasks using ClaudeSdkRunner
// Replaces the stub runner with actual AI-powered task execution

import type { Task } from './manager.js';
import { ClaudeSdkRunner } from '../ai/claude-sdk.js';
import { getWorkspace } from '../workspace/manager.js';

export async function runTask(task: Task): Promise<{ result?: string; error?: string }> {
  // 1. Look up workspace
  const workspace = getWorkspace(task.workspace_id);
  if (!workspace) {
    return { error: `Workspace not found: ${task.workspace_id}` };
  }

  // 2. Build prompt from task description + context files
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

  // 3. Create runner and execute
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
