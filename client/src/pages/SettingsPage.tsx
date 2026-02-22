// Settings Page - App configuration and preferences

import { useEffect, useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useSettingsStore, VOICE_LANGUAGES } from '../stores/settings';
import { useAuthStore } from '../stores/auth';
import { useWorkspaceStore } from '../stores/workspace';
import { auth, models as modelsApi, type ModelInfo } from '../services/api';
import { ws } from '../services/websocket';
import { AppLayout } from '../components/AppLayout';

// Hardcoded fallback models in case API is unavailable
const FALLBACK_MODELS: ModelInfo[] = [
  { key: 'haiku', name: 'Claude Haiku', description: 'Fastest, for simple tasks', modelId: 'claude-haiku-4-5-20251001' },
  { key: 'sonnet', name: 'Claude Sonnet', description: 'Fast, efficient for most tasks', modelId: 'claude-sonnet-4-20250514' },
  { key: 'opus', name: 'Claude Opus', description: 'Most capable, for complex tasks', modelId: 'claude-opus-4-20250514' },
];

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

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
      className={`w-14 h-8 rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-bg-tertiary'
      }`}
    >
      <div
        className={`w-6 h-6 rounded-full bg-white shadow transition-transform mx-1 ${
          enabled ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// SVG icons for each model key
function ModelIcon({ modelKey, isSelected }: { modelKey: string; isSelected: boolean }) {
  const colorClass = isSelected ? 'text-accent' : 'text-text-secondary';

  if (modelKey === 'haiku') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${colorClass}`}>
        <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
      </svg>
    );
  }

  if (modelKey === 'opus') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${colorClass}`}>
        <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
      </svg>
    );
  }

  // Default: sonnet (bolt/lightning icon)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${colorClass}`}>
      <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
    </svg>
  );
}

export function SettingsPage() {
  const {
    model,
    voiceEnabled,
    voiceLanguage,
    autoCommitMsg,
    projectsPath,
    setModel,
    setVoiceEnabled,
    setVoiceLanguage,
    setAutoCommitMsg,
    setProjectsPath,
  } = useSettingsStore();

  // Workspace store
  const { selectedWorkspaceId, workspaceList, updateWorkspace } = useWorkspaceStore();
  const selectedWorkspace = workspaceList.find((w) => w.id === selectedWorkspaceId);

  // System prompt editor state
  const [systemPrompt, setSystemPrompt] = useState(selectedWorkspace?.systemPrompt || '');
  const [promptDirty, setPromptDirty] = useState(false);

  useEffect(() => {
    setSystemPrompt(selectedWorkspace?.systemPrompt || '');
    setPromptDirty(false);
  }, [selectedWorkspace?.id, selectedWorkspace?.systemPrompt]);

  // Models from API
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(FALLBACK_MODELS);

  useEffect(() => {
    modelsApi.list()
      .then((res) => {
        if (res.models && res.models.length > 0) {
          setAvailableModels(res.models);
        }
      })
      .catch(() => {
        // Use fallback models on error
      });
  }, []);

  // Auth store
  const authStore = useAuthStore();

  // Connection status polling
  const [wsConnected, setWsConnected] = useState(ws.connected);

  useEffect(() => {
    const interval = setInterval(() => {
      setWsConnected(ws.connected);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Device management
  const [devices, setDevices] = useState<Array<{ id: string; name: string; last_seen_at: string; created_at: string }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const list = await auth.getDevices();
      setDevices(list);
    } catch {
      // Silently fail — devices section will just be empty
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevokeDevice = async (id: string) => {
    try {
      await auth.revokeDevice(id);
      setRevokeConfirmId(null);
      await loadDevices();
    } catch {
      // Silently fail
    }
  };

  // Logout
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    window.location.reload();
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
        {/* Connection Section */}
        <section>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Connection</h2>
          <div className="space-y-2">
            <div className="p-4 bg-bg-secondary rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Device Name</span>
                <span className="text-sm font-medium text-text-primary">{authStore.deviceName || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Device ID</span>
                <span className="text-sm font-mono text-text-muted">{authStore.deviceId ? authStore.deviceId.substring(0, 8) : '---'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">WebSocket</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-success' : 'bg-danger'}`} />
                  <span className={wsConnected ? 'text-success' : 'text-danger'}>
                    {wsConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Devices Section */}
        <section>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Devices</h2>
          <div className="space-y-2">
            {devicesLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
              </div>
            ) : devices.length === 0 ? (
              <div className="p-4 bg-bg-secondary rounded-xl">
                <p className="text-sm text-text-muted text-center">No devices found</p>
              </div>
            ) : (
              devices.map((device) => {
                const isCurrentDevice = device.id === authStore.deviceId;
                return (
                  <div key={device.id} className="flex items-center gap-3 p-4 bg-bg-secondary rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center text-text-secondary">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M10.5 18.75a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" />
                        <path fillRule="evenodd" d="M8.625.75A3.375 3.375 0 0 0 5.25 4.125v15.75a3.375 3.375 0 0 0 3.375 3.375h6.75a3.375 3.375 0 0 0 3.375-3.375V4.125A3.375 3.375 0 0 0 15.375.75h-6.75ZM7.5 4.125C7.5 3.504 8.004 3 8.625 3h6.75C16.496 3 17 3.504 17 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-6.75A1.125 1.125 0 0 1 7.5 19.875V4.125Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary truncate">{device.name}</span>
                        {isCurrentDevice && (
                          <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded-md flex-shrink-0">(this device)</span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{formatRelativeTime(device.last_seen_at)}</p>
                    </div>
                    {!isCurrentDevice && (
                      <button
                        onClick={() => setRevokeConfirmId(device.id)}
                        className="px-3 py-1.5 text-xs font-medium text-danger bg-danger/10 rounded-lg hover:bg-danger/20 transition-colors flex-shrink-0"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Workspace Section */}
        <section>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Workspace</h2>
          <div className="p-4 bg-bg-secondary rounded-xl space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Projects Path</label>
              <p className="text-xs text-text-muted mb-2">Root directory containing your git repos. Used for auto-discovery when adding workspaces.</p>
              <input
                type="text"
                value={projectsPath}
                onChange={(e) => setProjectsPath(e.target.value)}
                placeholder="/home/ubuntu"
                className="w-full px-3 py-2 min-h-[44px] bg-bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            {selectedWorkspace && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  System Prompt
                  <span className="text-xs text-text-muted ml-1">({selectedWorkspace.name})</span>
                </label>
                <p className="text-xs text-text-muted mb-2">Custom instructions for AI when working in this workspace.</p>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => { setSystemPrompt(e.target.value); setPromptDirty(true); }}
                  placeholder="e.g., Always use TypeScript strict mode..."
                  rows={4}
                  className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                />
                {promptDirty && (
                  <button
                    onClick={async () => {
                      if (!selectedWorkspaceId) return;
                      await updateWorkspace(selectedWorkspaceId, { systemPrompt });
                      setPromptDirty(false);
                    }}
                    className="mt-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* AI Section */}
        <section>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">AI Model</h2>
          <div className="space-y-2">
            {availableModels.map((m) => (
              <button
                key={m.key}
                onClick={() => setModel(m.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  model === m.key ? 'bg-accent/10 border-accent' : 'bg-bg-secondary border-border'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${model === m.key ? 'bg-accent/20' : 'bg-bg-tertiary'}`}>
                  <ModelIcon modelKey={m.key} isSelected={model === m.key} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`font-medium ${model === m.key ? 'text-accent' : 'text-text-primary'}`}>{m.name}</span>
                  <p className="text-sm text-text-muted">{m.description}</p>
                </div>
                {model === m.key && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-accent">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Input Section */}
        <section>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Input</h2>
          <div className="space-y-2">
            <SettingItem
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>}
              label="Voice Input"
              description="Use microphone for speech-to-text"
            >
              <Toggle enabled={voiceEnabled} onChange={setVoiceEnabled} />
            </SettingItem>

            {voiceEnabled && (
              <SettingItem
                icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM6.262 6.072a8.25 8.25 0 1 0 10.562-.766 4.5 4.5 0 0 1-1.318 1.357L14.25 7.5l.165.33a.809.809 0 0 1-1.086 1.085l-.604-.302a1.125 1.125 0 0 0-1.298.21l-.132.131c-.439.44-.439 1.152 0 1.591l.296.296c.256.257.622.374.98.314l1.17-.195c.323-.054.654.036.905.245l1.33 1.108c.32.267.46.694.358 1.1a8.7 8.7 0 0 1-2.288 4.04l-.723.724a1.125 1.125 0 0 1-1.298.21l-.153-.076a1.125 1.125 0 0 1-.622-1.006v-1.089c0-.298-.119-.585-.33-.796l-1.347-1.347a1.125 1.125 0 0 1-.21-1.298L9.75 12l-1.64-1.64a6 6 0 0 1-1.676-3.257l-.172-1.03Z" clipRule="evenodd" /></svg>}
                label="Voice Language"
                description="Language for speech recognition"
              >
                <select
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value)}
                  className="bg-bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {VOICE_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </SettingItem>
            )}
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Notifications</h2>
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
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Git</h2>
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
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">About</h2>
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

        {/* Account Section */}
        <section>
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider px-1 mb-3">Account</h2>
          <div className="space-y-2">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-4 p-4 bg-bg-secondary rounded-xl hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-danger">
                  <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9a.75.75 0 0 1-1.5 0V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium text-danger">Logout</span>
            </button>
          </div>
        </section>

        {/* Spacer for bottom nav */}
        <div className="h-4" />
      </main>

      {/* Logout Confirm Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-bg-elevated rounded-2xl p-6 mx-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Logout</h3>
            <p className="text-sm text-text-secondary mb-6">Are you sure you want to logout? You will need to re-authenticate to use Vibe Remote.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-bg-tertiary text-text-secondary rounded-xl text-sm font-medium hover:bg-bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-danger text-white rounded-xl text-sm font-medium hover:bg-danger/90 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Device Confirm Dialog */}
      {revokeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRevokeConfirmId(null)} />
          <div className="relative bg-bg-elevated rounded-2xl p-6 mx-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Revoke Device</h3>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to revoke access for &quot;{devices.find((d) => d.id === revokeConfirmId)?.name || 'this device'}&quot;? It will need to re-authenticate.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeConfirmId(null)}
                className="flex-1 py-2.5 bg-bg-tertiary text-text-secondary rounded-xl text-sm font-medium hover:bg-bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevokeDevice(revokeConfirmId)}
                className="flex-1 py-2.5 bg-danger text-white rounded-xl text-sm font-medium hover:bg-danger/90 transition-colors"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
