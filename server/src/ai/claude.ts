// Claude API Integration with Streaming

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { config } from '../config.js';
import { toolDefinitions, executeTool, getModifiedFiles, clearModifiedFiles } from './tools.js';
import { buildFullSystemPrompt } from './context-builder.js';
import type { AIMessage, ToolUseBlock, TextBlock } from './types.js';

const anthropic = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

export interface StreamCallbacks {
  onText: (text: string) => void;
  onToolUse: (tool: { name: string; input: Record<string, unknown> }) => void;
  onToolResult: (result: { name: string; output: string; isError: boolean }) => void;
  onComplete: (response: { fullText: string; modifiedFiles: string[] }) => void;
  onError: (error: Error) => void;
}

export interface ChatOptions {
  workspacePath: string;
  workspaceSystemPrompt?: string;
  selectedFiles?: string[];
  conversationHistory: AIMessage[];
  userMessage: string;
}

export async function streamChat(
  options: ChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { workspacePath, workspaceSystemPrompt, selectedFiles, conversationHistory, userMessage } =
    options;

  // Clear modified files tracker
  clearModifiedFiles();

  // Build system prompt with context
  const systemPrompt = await buildFullSystemPrompt(
    workspacePath,
    workspaceSystemPrompt,
    selectedFiles
  );

  // Prepare messages
  const messages: AIMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let fullText = '';
  const toolUseBlocks: ToolUseBlock[] = [];

  try {
    // Main conversation loop (handles tool use)
    await runConversationLoop(
      systemPrompt,
      messages,
      workspacePath,
      (text) => {
        fullText += text;
        callbacks.onText(text);
      },
      (toolUse) => {
        toolUseBlocks.push(toolUse);
        callbacks.onToolUse({ name: toolUse.name, input: toolUse.input });
      },
      (result) => {
        callbacks.onToolResult(result);
      }
    );

    // Get all modified files
    const modifiedFiles = getModifiedFiles().map((f) => f.path);

    callbacks.onComplete({
      fullText,
      modifiedFiles,
    });
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

async function runConversationLoop(
  systemPrompt: string,
  messages: AIMessage[],
  workspacePath: string,
  onText: (text: string) => void,
  onToolUse: (toolUse: ToolUseBlock) => void,
  onToolResult: (result: { name: string; output: string; isError: boolean }) => void
): Promise<void> {
  const MAX_ITERATIONS = 10; // Prevent infinite loops
  let iterations = 0;

  // Convert messages to Anthropic format
  const anthropicMessages: MessageParam[] = messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content as MessageParam['content'],
  }));

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Create streaming message
    const stream = await anthropic.messages.stream({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: toolDefinitions as Anthropic.Tool[],
    });

    // Collect response
    let currentTextBlock: TextBlock | null = null;
    let currentToolUseBlock: ToolUseBlock | null = null;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'text') {
          currentTextBlock = { type: 'text', text: '' };
        } else if (block.type === 'tool_use') {
          currentToolUseBlock = {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: {},
          };
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta' && currentTextBlock) {
          currentTextBlock.text += delta.text;
          onText(delta.text);
        } else if (delta.type === 'input_json_delta' && currentToolUseBlock) {
          // Accumulate JSON input - will be parsed at block_stop
        }
      } else if (event.type === 'content_block_stop') {
        if (currentTextBlock) {
          currentTextBlock = null;
        } else if (currentToolUseBlock) {
          currentToolUseBlock = null;
        }
      }
    }

    // Get final message for tool inputs
    const finalMessage = await stream.finalMessage();

    // Extract tool uses with their inputs from final message
    const toolUses: ToolUseBlock[] = [];
    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        const toolUse: ToolUseBlock = {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
        toolUses.push(toolUse);
        onToolUse(toolUse);
      }
    }

    // If no tool use, we're done
    if (finalMessage.stop_reason === 'end_turn' || toolUses.length === 0) {
      break;
    }

    // Execute tools and prepare results
    const toolResults: ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const result = executeTool(toolUse.name, toolUse.input, workspacePath);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.content,
        is_error: result.is_error,
      });

      onToolResult({
        name: toolUse.name,
        output: result.content,
        isError: result.is_error || false,
      });
    }

    // Add assistant response and tool results to messages
    anthropicMessages.push({
      role: 'assistant',
      content: finalMessage.content as MessageParam['content'],
    });

    anthropicMessages.push({
      role: 'user',
      content: toolResults as MessageParam['content'],
    });
  }
}

// Non-streaming version for simple requests
export async function simpleChat(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  return textContent ? textContent.text : '';
}

// Generate commit message from diff
export async function generateCommitMessage(diff: string): Promise<string> {
  const systemPrompt = `Based on the following git diff, generate a concise commit message following Conventional Commits format (feat/fix/chore/docs/refactor/test).
Include a brief body if the change is non-trivial.

Rules:
- First line: type(scope): description (max 72 chars)
- Body: explain WHY, not WHAT (the diff shows WHAT)
- Use imperative mood
- Be specific about what changed
- Only output the commit message, nothing else`;

  return simpleChat(systemPrompt, `Diff:\n${diff}`);
}

// Generate PR description
export async function generatePRDescription(
  branchName: string,
  baseBranch: string,
  commits: string[],
  diff: string
): Promise<string> {
  const systemPrompt = `Generate a pull request description for the following changes.

Format:
## Summary
(1-2 sentences)

## Changes
(bullet list of key changes)

## Testing
(what was tested)

Only output the PR description in markdown format, nothing else.`;

  const userMessage = `Branch: ${branchName}
Base: ${baseBranch}
Commits:
${commits.join('\n')}

Full diff:
${diff}`;

  return simpleChat(systemPrompt, userMessage);
}
