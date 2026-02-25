import { Component, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ChatPage } from './pages/ChatPage';
import { DiffPage } from './pages/DiffPage';
import { TasksPage } from './pages/TasksPage';
import { ReposPage } from './pages/ReposPage';
import { SettingsPage } from './pages/SettingsPage';
import { ToastContainer } from './components/Toast';
import { useAuthStore } from './stores/auth';
import { useSettingsStore } from './stores/settings';
import { initWsAuthErrorHandling } from './services/websocket';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold mb-2">發生未預期的錯誤</h1>
            <p className="text-gray-400 mb-4 text-sm break-all">
              {this.state.error?.message}
            </p>
            <button
              className="px-4 py-2 bg-blue-600 rounded-lg text-sm"
              onClick={() => window.location.reload()}
            >
              重新載入
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    initWsAuthErrorHandling();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      useSettingsStore.getState().loadFromServer();
    }
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/diff" element={<DiffPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/repos" element={<ReposPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
