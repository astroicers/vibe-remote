// AI Engine Module - Claude Agent SDK Integration

export {
  ClaudeSdkRunner,
  generateCommitMessage,
  generatePRDescription,
} from './claude-sdk.js';

export type {
  ClaudeSdkOptions,
  StreamEvent,
  ChatResponse,
  TokenUsage,
} from './claude-sdk.js';

export {
  buildFullSystemPrompt,
  buildProjectContext,
  buildSystemPrompt,
} from './context-builder.js';

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
