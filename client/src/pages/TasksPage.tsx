// Tasks Page - Kanban-style task management

import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';

export function TasksPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      {/* Header */}
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-secondary flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-tertiary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-text-secondary">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex-1 ml-3">
          <h1 className="text-base font-medium text-text-primary">Tasks</h1>
        </div>

        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-tertiary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-text-secondary">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      {/* Kanban Board */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Queued */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
            </svg>
            Queued
          </h2>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <p className="text-sm text-text-muted text-center py-4">No queued tasks</p>
          </div>
        </section>

        {/* Running */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-warning">
              <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" />
            </svg>
            Running
          </h2>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <p className="text-sm text-text-muted text-center py-4">No running tasks</p>
          </div>
        </section>

        {/* Completed */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-success">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
            Completed
          </h2>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <p className="text-sm text-text-muted text-center py-4">No completed tasks</p>
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
