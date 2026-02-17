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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
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
      console.warn('WebSocket not connected, queueing message');
      this.pendingMessages.push(message);
      this.connect();
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

// Chat-specific helpers
export function sendChatMessage(
  message: string,
  conversationId?: string,
  selectedFiles?: string[]
): void {
  ws.send({
    type: 'chat_send',
    message,
    conversationId,
    selectedFiles,
  });
}
