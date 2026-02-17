import { Routes, Route, Navigate } from 'react-router-dom';
import { ChatPage } from './pages/ChatPage';
import { DiffPage } from './pages/DiffPage';
import { TasksPage } from './pages/TasksPage';
import { ReposPage } from './pages/ReposPage';

export default function App() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/diff" element={<DiffPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/repos" element={<ReposPage />} />
      </Routes>
    </div>
  );
}
