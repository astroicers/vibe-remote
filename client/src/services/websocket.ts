// WebSocket Service with auto-reconnect

type MessageHandler = (data: Record<string, unknown>) => void;

interface WSMessage {
  type: string;
  [key: string]: unknown;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isAuthenticated = false;
  private pendingMessages: WSMessage[] = [];

  constructor() {
    // Always use same host — Vite proxy handles /ws → server in dev
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Clean up old connection
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      this.reconnectAttempts = 0;

      // Authenticate if we have a token
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.send({ type: 'auth', token });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      this.isAuthenticated = false;
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('connection_failed', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage(data: WSMessage): void {
    // Handle auth response
    if (data.type === 'auth_success') {
      this.isAuthenticated = true;
      // Send any pending messages
      this.pendingMessages.forEach((msg) => this.send(msg));
      this.pendingMessages = [];
    }

    // Emit to handlers
    this.emit(data.type, data);
    this.emit('*', data); // Wildcard handler
  }

  private emit(type: string, data: Record<string, unknown>): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  send(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.pendingMessages.length < 50) {
        this.pendingMessages.push(message);
      }
      return;
    }

    // If not authenticated yet (except for auth message), queue it
    if (!this.isAuthenticated && message.type !== 'auth') {
      this.pendingMessages.push(message);
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get authenticated(): boolean {
    return this.isAuthenticated;
  }
}

// Singleton instance
export const ws = new WebSocketService();

// Auth error handling — listens for auth_error/auth_expired and triggers logout + toast
let _wsAuthInitialized = false;

const WS_AUTH_ERROR_MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED: '登入已過期，請重新配對',
  DEVICE_REVOKED: '裝置已被撤銷，請重新配對',
  INVALID_TOKEN: '認證無效，請重新配對',
};

export function initWsAuthErrorHandling(): void {
  if (_wsAuthInitialized) return;
  _wsAuthInitialized = true;

  const handleAuthError = (data: Record<string, unknown>) => {
    const code = (data.code as string) || 'INVALID_TOKEN';
    const message = WS_AUTH_ERROR_MESSAGES[code] || WS_AUTH_ERROR_MESSAGES.INVALID_TOKEN;

    // Dynamic imports to avoid circular dependency with auth.ts
    import('../stores/toast').then(({ useToastStore }) => {
      useToastStore.getState().addToast(message, 'error');
    });
    import('../stores/auth').then(({ useAuthStore }) => {
      useAuthStore.getState().logout();
    });
  };

  ws.on('auth_error', handleAuthError);
  ws.on('auth_expired', handleAuthError);
}

// Chat-specific helpers
export function sendChatMessage(
  message: string,
  workspaceId: string,
  conversationId?: string,
  selectedFiles?: string[],
  model?: string
): void {
  ws.send({
    type: 'chat_send',
    workspaceId,
    message,
    conversationId,
    selectedFiles,
    model,
  });
}

// File change event types
export interface FileChangeInfo {
  type: 'add' | 'change' | 'unlink';
  path: string;
}

export interface FilesChangedEvent {
  type: 'files_changed';
  workspaceId: string;
  files: FileChangeInfo[];
  timestamp: string;
}

// Task status event types
export interface TaskStatusEvent {
  type: 'task_status';
  task: Record<string, unknown>;
  timestamp: string;
}

// Task execution streaming event types
export interface TaskProgressEvent {
  type: 'task_progress';
  taskId: string;
  workspaceId: string;
  text: string;
  timestamp: string;
}

export interface TaskToolUseEvent {
  type: 'task_tool_use';
  taskId: string;
  workspaceId: string;
  tool: string;
  input: Record<string, unknown>;
  timestamp: string;
}

export interface TaskToolResultEvent {
  type: 'task_tool_result';
  taskId: string;
  workspaceId: string;
  tool: string;
  result: unknown;
  timestamp: string;
}

export interface TaskCompleteEvent {
  type: 'task_complete';
  taskId: string;
  workspaceId: string;
  status: 'completed' | 'failed';
  result?: string;
  error?: string;
  modifiedFiles: string[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
  };
  timestamp: string;
}
