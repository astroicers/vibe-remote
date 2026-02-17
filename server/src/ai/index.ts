// AI Engine Module

export { streamChat, simpleChat, generateCommitMessage, generatePRDescription } from './claude.js';
export type { StreamCallbacks, ChatOptions } from './claude.js';
export { buildFullSystemPrompt, buildProjectContext, buildSystemPrompt } from './context-builder.js';
export { toolDefinitions, executeTool, getModifiedFiles, clearModifiedFiles } from './tools.js';
export type {
  AIMessage,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ProjectContext,
  ChatRequest,
  ModifiedFile,
} from './types.js';
