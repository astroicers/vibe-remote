import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock all dependencies

const mockModelsListFn = vi.fn();
const mockGetDevicesFn = vi.fn();

vi.mock('../services/api', () => ({
  auth: {
    getDevices: (...args: unknown[]) => mockGetDevicesFn(...args),
    revokeDevice: vi.fn().mockResolvedValue(undefined),
  },
  models: {
    list: (...args: unknown[]) => mockModelsListFn(...args),
  },
}));

vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    isSupported: false,
    isSubscribed: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

vi.mock('../services/websocket', () => ({
  ws: { connected: true, authenticated: true },
}));

vi.mock('../components/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock('../stores/settings', () => ({
  useSettingsStore: () => ({
    model: 'sonnet',
    voiceEnabled: false,
    voiceLanguage: 'zh-TW',
    autoCommitMsg: true,
    projectsPath: '/workspace',
    setModel: vi.fn(),
    setVoiceEnabled: vi.fn(),
    setVoiceLanguage: vi.fn(),
    setAutoCommitMsg: vi.fn(),
    setProjectsPath: vi.fn(),
  }),
  VOICE_LANGUAGES: [
    { code: 'zh-TW', label: '中文 (台灣)' },
    { code: 'en-US', label: 'English (US)' },
  ],
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    deviceId: 'dev_test',
    deviceName: 'Test Device',
    logout: vi.fn(),
  }),
}));

vi.mock('../stores/workspace', () => ({
  useWorkspaceStore: () => ({
    selectedWorkspaceId: 'ws_test',
    workspaceList: [{ id: 'ws_test', name: 'Test', path: '/test', systemPrompt: null }],
    updateWorkspace: vi.fn(),
  }),
}));

import { SettingsPage } from './SettingsPage';

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModelsListFn.mockResolvedValue({
      models: [
        { key: 'sonnet', name: 'Sonnet', description: 'Fast', modelId: 'claude-sonnet-4' },
      ],
    });
    mockGetDevicesFn.mockResolvedValue([
      { id: 'dev_test', name: 'Test Device', last_seen_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]);
  });

  it('should render without crash', () => {
    renderSettings();
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('should call modelsApi.list on mount', async () => {
    renderSettings();
    await waitFor(() => {
      expect(mockModelsListFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should call auth.getDevices on mount', async () => {
    renderSettings();
    await waitFor(() => {
      expect(mockGetDevicesFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle modelsApi.list failure gracefully', async () => {
    mockModelsListFn.mockReset().mockRejectedValue(new Error('Network error'));

    renderSettings();

    // Should still render (catch handler prevents crash)
    await waitFor(() => {
      expect(mockModelsListFn).toHaveBeenCalled();
    });
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('should handle auth.getDevices failure gracefully', async () => {
    mockGetDevicesFn.mockReset().mockRejectedValue(new Error('Auth error'));

    renderSettings();

    // Should still render (catch handler prevents crash)
    await waitFor(() => {
      expect(mockGetDevicesFn).toHaveBeenCalled();
    });
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('should display model section', () => {
    renderSettings();
    expect(screen.getByText('AI Model')).toBeInTheDocument();
  });

  it('should display connection status', () => {
    renderSettings();
    expect(screen.getByText('Connection')).toBeInTheDocument();
  });
});
