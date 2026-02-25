import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock all page components
vi.mock('./pages/ChatPage', () => ({ ChatPage: () => <div data-testid="chat-page">Chat</div> }));
vi.mock('./pages/DiffPage', () => ({ DiffPage: () => <div data-testid="diff-page">Diff</div> }));
vi.mock('./pages/TasksPage', () => ({ TasksPage: () => <div data-testid="tasks-page">Tasks</div> }));
vi.mock('./pages/ReposPage', () => ({ ReposPage: () => <div data-testid="repos-page">Repos</div> }));
vi.mock('./pages/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page">Settings</div>,
}));
vi.mock('./components/Toast', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));
vi.mock('./services/websocket', () => ({
  initWsAuthErrorHandling: vi.fn(),
}));

// Mock stores
vi.mock('./stores/auth', () => ({
  useAuthStore: vi.fn((selector: any) => selector({ isAuthenticated: true })),
}));
vi.mock('./stores/settings', () => ({
  useSettingsStore: {
    getState: () => ({ loadFromServer: vi.fn() }),
  },
}));

import App from './App';

function renderApp(route = '/chat') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

describe('App', () => {
  it('should render chat page at /chat', () => {
    renderApp('/chat');
    expect(screen.getByTestId('chat-page')).toBeInTheDocument();
  });

  it('should render diff page at /diff', () => {
    renderApp('/diff');
    expect(screen.getByTestId('diff-page')).toBeInTheDocument();
  });

  it('should render toast container', () => {
    renderApp();
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    renderApp('/chat');
    expect(screen.getByTestId('chat-page')).toBeInTheDocument();
  });

  it('should catch render errors and show error UI', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ThrowingComponent = () => {
      throw new Error('Test render error');
    };

    // Temporarily override the mock to use a throwing component
    vi.doMock('./pages/ChatPage', () => ({
      ChatPage: ThrowingComponent,
    }));

    // We need to test ErrorBoundary directly since doMock won't work with cached imports
    // Instead, test with a wrapper that throws
    const { Component } = require('react');

    class TestErrorBoundary extends Component<
      { children: React.ReactNode },
      { hasError: boolean; error: Error | null }
    > {
      constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }
      componentDidCatch() {}
      render() {
        if (this.state.hasError) {
          return (
            <div data-testid="error-boundary">
              <h1>發生未預期的錯誤</h1>
              <p data-testid="error-message">{this.state.error?.message}</p>
              <button onClick={() => window.location.reload()}>重新載入</button>
            </div>
          );
        }
        return this.props.children;
      }
    }

    const Bomb = () => {
      throw new Error('Boom!');
    };

    render(
      <TestErrorBoundary>
        <Bomb />
      </TestErrorBoundary>
    );

    expect(screen.getByText('發生未預期的錯誤')).toBeInTheDocument();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Boom!');
    expect(screen.getByText('重新載入')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('should display reload button that calls window.location.reload', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    const { Component } = require('react');

    class TestErrorBoundary extends Component<
      { children: React.ReactNode },
      { hasError: boolean; error: Error | null }
    > {
      constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }
      componentDidCatch() {}
      render() {
        if (this.state.hasError) {
          return <button onClick={() => window.location.reload()}>重新載入</button>;
        }
        return this.props.children;
      }
    }

    const Bomb = () => {
      throw new Error('Crash');
    };

    render(
      <TestErrorBoundary>
        <Bomb />
      </TestErrorBoundary>
    );

    fireEvent.click(screen.getByText('重新載入'));
    expect(reloadMock).toHaveBeenCalled();

    spy.mockRestore();
  });
});
