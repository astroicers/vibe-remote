import { useEffect } from 'react';
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
  );
}
