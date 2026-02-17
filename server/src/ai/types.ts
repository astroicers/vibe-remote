// AI Engine Types

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface AIStreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'tool_use';
  data?: unknown;
}

export interface ProjectContext {
  fileTree: string;
  keyFiles: Record<string, string>;
  gitInfo: {
    branch: string;
    status: string;
    recentCommits: string[];
  };
  workspaceSystemPrompt?: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  selectedFiles?: string[];
}

export interface ModifiedFile {
  path: string;
  operation: 'create' | 'update' | 'delete';
}
