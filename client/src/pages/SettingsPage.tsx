// Settings Page - App configuration and preferences

import { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { AppLayout } from '../components/AppLayout';

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

function SettingItem({ icon, label, description, children, onClick }: SettingItemProps) {
  const content = (
    <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
      <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary">
        {icon}
      </div>
      <div className="flex-1">
        <span className="font-medium text-text-primary">{label}</span>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left hover:opacity-80 transition-opacity">
        {content}
      </button>
    );
  }

  return content;
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-12 h-7 rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-bg-tertiary'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform mx-1 ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const [model, setModel] = useState<'sonnet' | 'opus'>('sonnet');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoCommitMsg, setAutoCommitMsg] = useState(true);
  const [projectsPath, setProjectsPath] = useState(() => localStorage.getItem('settings_projects_path') || '');
  const [projectsPathSaved, setProjectsPathSaved] = useState(false);

  const handleSaveProjectsPath = () => {
    const trimmed = projectsPath.trim();
    if (trimmed) {
      localStorage.setItem('settings_projects_path', trimmed);
    } else {
      localStorage.removeItem('settings_projects_path');
    }
    setProjectsPathSaved(true);
    setTimeout(() => setProjectsPathSaved(false), 2000);
  };

  // Push notifications
  const {
    isSupported: pushSupported,
    isSubscribed: pushEnabled,
    isLoading: pushLoading,
    error: pushError,
    permission: pushPermission,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribePush();
    } else {
      await unsubscribePush();
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-secondary flex-shrink-0">
        <h1 className="text-base font-medium text-text-primary">Settings</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Workspace Section */}
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Workspace</h2>
          <div className="p-4 bg-bg-secondary rounded-xl space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Projects Path</label>
              <p className="text-xs text-text-muted mb-2">Root directory containing your git repos. Used for auto-discovery when adding workspaces.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={projectsPath}
                  onChange={(e) => { setProjectsPath(e.target.value); setProjectsPathSaved(false); }}
                  placeholder="/home/ubuntu"
                  className="flex-1 px-3 py-2 bg-bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSaveProjectsPath}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    projectsPathSaved
                      ? 'bg-success/20 text-success'
                      : 'bg-accent text-white hover:bg-accent/90'
                  }`}
                >
                  {projectsPathSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* AI Section */}
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-3">AI Model</h2>
          <div className="space-y-2">
            <button
              onClick={() => setModel('sonnet')}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                model === 'sonnet' ? 'bg-accent/10 border-accent' : 'bg-bg-secondary border-border'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${model === 'sonnet' ? 'bg-accent/20' : 'bg-bg-tertiary'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${model === 'sonnet' ? 'text-accent' : 'text-text-secondary'}`}>
                  <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <span className={`font-medium ${model === 'sonnet' ? 'text-accent' : 'text-text-primary'}`}>Claude Sonnet</span>
                <p className="text-sm text-text-muted">Fast, efficient for most tasks</p>
              </div>
              {model === 'sonnet' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-accent">
                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setModel('opus')}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                model === 'opus' ? 'bg-accent/10 border-accent' : 'bg-bg-secondary border-border'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${model === 'opus' ? 'bg-accent/20' : 'bg-bg-tertiary'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${model === 'opus' ? 'text-accent' : 'text-text-secondary'}`}>
                  <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <span className={`font-medium ${model === 'opus' ? 'text-accent' : 'text-text-primary'}`}>Claude Opus</span>
                <p className="text-sm text-text-muted">Most capable, for complex tasks</p>
              </div>
              {model === 'opus' && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-accent">
                  <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </section>

        {/* Input Section */}
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Input</h2>
          <div className="space-y-2">
            <SettingItem
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>}
              label="Voice Input"
              description="Use microphone for speech-to-text"
            >
              <Toggle enabled={voiceEnabled} onChange={setVoiceEnabled} />
            </SettingItem>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Notifications</h2>
          <div className="space-y-2">
            <SettingItem
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" /></svg>}
              label="Push Notifications"
              description={
                !pushSupported
                  ? 'Not available on this device'
                  : pushPermission === 'denied'
                    ? 'Permission denied in browser settings'
                    : pushError
                      ? pushError
                      : 'Get notified when tasks complete'
              }
            >
              {pushLoading ? (
                <div className="w-12 h-7 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
                </div>
              ) : (
                <Toggle enabled={pushEnabled} onChange={handlePushToggle} />
              )}
            </SettingItem>
          </div>
        </section>

        {/* Git Section */}
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Git</h2>
          <div className="space-y-2">
            <SettingItem
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" /></svg>}
              label="Auto Commit Message"
              description="AI generates commit messages"
            >
              <Toggle enabled={autoCommitMsg} onChange={setAutoCommitMsg} />
            </SettingItem>
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-3">About</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-4 p-4 bg-bg-secondary rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-accent">
                  <path d="M12 .75a8.25 8.25 0 0 0-4.135 15.39c.686.398 1.115 1.008 1.134 1.623a.75.75 0 0 0 .577.706c.352.083.71.148 1.074.195.323.041.6-.218.6-.544v-4.661a6.714 6.714 0 0 1-.937-.171.75.75 0 1 1 .374-1.453 5.261 5.261 0 0 0 2.626 0 .75.75 0 1 1 .374 1.452 6.712 6.712 0 0 1-.937.172v4.66c0 .327.277.586.6.545.364-.047.722-.112 1.074-.195a.75.75 0 0 0 .577-.706c.02-.615.448-1.225 1.134-1.623A8.25 8.25 0 0 0 12 .75Z" />
                  <path fillRule="evenodd" d="M9.013 19.9a.75.75 0 0 1 .877-.597 11.319 11.319 0 0 0 4.22 0 .75.75 0 1 1 .28 1.473 12.819 12.819 0 0 1-4.78 0 .75.75 0 0 1-.597-.876ZM9.754 22.344a.75.75 0 0 1 .824-.668 13.682 13.682 0 0 0 2.844 0 .75.75 0 1 1 .156 1.492 15.156 15.156 0 0 1-3.156 0 .75.75 0 0 1-.668-.824Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="font-medium text-text-primary">Vibe Remote</span>
                <p className="text-sm text-text-muted">Version 0.2.0</p>
              </div>
            </div>
          </div>
        </section>

        {/* Spacer for bottom nav */}
        <div className="h-4" />
      </main>
    </AppLayout>
  );
}
