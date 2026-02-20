import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StatusBar } from './StatusBar';

// Mock the websocket module
vi.mock('../services/websocket', () => {
  const handlers = new Map<string, Set<(data: Record<string, unknown>) => void>>();

  return {
    ws: {
      connected: false,
      on: vi.fn((type: string, handler: (data: Record<string, unknown>) => void) => {
        if (!handlers.has(type)) {
          handlers.set(type, new Set());
        }
        handlers.get(type)!.add(handler);
        return () => {
          handlers.get(type)?.delete(handler);
        };
      }),
      __handlers: handlers,
    },
  };
});

// Import mock after vi.mock so we can manipulate it
import { ws } from '../services/websocket';

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ws as unknown as Record<string, unknown>).connected = false;
  });

  it('returns null when connected', () => {
    (ws as unknown as Record<string, unknown>).connected = true;
    const { container } = render(<StatusBar />);
    expect(container.innerHTML).toBe('');
  });

  it('shows connecting state', () => {
    (ws as unknown as Record<string, unknown>).connected = false;
    render(<StatusBar />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-warning/20', 'text-warning');
  });

  it('shows disconnected state', () => {
    (ws as unknown as Record<string, unknown>).connected = false;

    // Capture the connection_failed handler when it registers
    let connectionFailedHandler: ((data: Record<string, unknown>) => void) | undefined;
    vi.mocked(ws.on).mockImplementation((type: string, handler: (data: Record<string, unknown>) => void) => {
      if (type === 'connection_failed') {
        connectionFailedHandler = handler;
      }
      return () => {};
    });

    render(<StatusBar />);

    // Simulate connection_failed event
    expect(connectionFailedHandler).toBeDefined();
    act(() => {
      connectionFailedHandler!({});
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-danger/20', 'text-danger');
  });
});
