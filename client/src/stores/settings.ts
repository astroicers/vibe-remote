// Settings Store - Persisted app settings with zustand persist middleware
// localStorage is the fast cache; server is the source of truth.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settings as settingsApi } from '../services/api';

interface SettingsState {
  model: string;
  voiceEnabled: boolean;
  voiceLanguage: string;
  autoCommitMsg: boolean;
  projectsPath: string;
  _serverSynced: boolean;
  _syncError: string | null;

  setModel: (model: string) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceLanguage: (language: string) => void;
  setAutoCommitMsg: (enabled: boolean) => void;
  setProjectsPath: (path: string) => void;
  loadFromServer: () => Promise<void>;
  _pushToServer: () => void;
}

export const VOICE_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'zh-TW', label: '中文（繁體）' },
  { code: 'zh-CN', label: '中文（简体）' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
] as const;

// Setting keys that should be synced to server
const SYNC_KEYS = ['model', 'voiceEnabled', 'voiceLanguage', 'autoCommitMsg', 'projectsPath'] as const;

// Serialize settings state to string record for server
function serializeSettings(state: Pick<SettingsState, typeof SYNC_KEYS[number]>): Record<string, string> {
  return {
    model: state.model,
    voiceEnabled: String(state.voiceEnabled),
    voiceLanguage: state.voiceLanguage,
    autoCommitMsg: String(state.autoCommitMsg),
    projectsPath: state.projectsPath,
  };
}

// Deserialize server settings to typed values
function deserializeSettings(raw: Record<string, string>): Partial<Pick<SettingsState, typeof SYNC_KEYS[number]>> {
  const result: Partial<Pick<SettingsState, typeof SYNC_KEYS[number]>> = {};
  if (raw.model !== undefined) result.model = raw.model;
  if (raw.voiceEnabled !== undefined) result.voiceEnabled = raw.voiceEnabled === 'true';
  if (raw.voiceLanguage !== undefined) result.voiceLanguage = raw.voiceLanguage;
  if (raw.autoCommitMsg !== undefined) result.autoCommitMsg = raw.autoCommitMsg === 'true';
  if (raw.projectsPath !== undefined) result.projectsPath = raw.projectsPath;
  return result;
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      model: 'sonnet',
      voiceEnabled: true,
      voiceLanguage: 'en-US',
      autoCommitMsg: true,
      projectsPath: '',
      _serverSynced: false,
      _syncError: null,

      setModel: (model) => {
        set({ model });
        get()._pushToServer();
      },
      setVoiceEnabled: (voiceEnabled) => {
        set({ voiceEnabled });
        get()._pushToServer();
      },
      setVoiceLanguage: (voiceLanguage) => {
        set({ voiceLanguage });
        get()._pushToServer();
      },
      setAutoCommitMsg: (autoCommitMsg) => {
        set({ autoCommitMsg });
        get()._pushToServer();
      },
      setProjectsPath: (projectsPath) => {
        set({ projectsPath });
        get()._pushToServer();
      },

      loadFromServer: async () => {
        try {
          const { settings: serverSettings } = await settingsApi.get();
          const hasServerData = Object.keys(serverSettings).length > 0;

          if (hasServerData) {
            // Server wins — apply server settings over local
            const deserialized = deserializeSettings(serverSettings);
            set({ ...deserialized, _serverSynced: true, _syncError: null });
          } else {
            // No server data — push current local settings to server
            const state = get();
            const serialized = serializeSettings(state);
            await settingsApi.update(serialized);
            set({ _serverSynced: true, _syncError: null });
          }
        } catch (error) {
          set({
            _syncError: error instanceof Error ? error.message : 'Settings sync failed',
            _serverSynced: false,
          });
        }
      },

      _pushToServer: () => {
        if (_debounceTimer) {
          clearTimeout(_debounceTimer);
        }
        _debounceTimer = setTimeout(async () => {
          try {
            const state = get();
            const serialized = serializeSettings(state);
            await settingsApi.update(serialized);
            set({ _syncError: null });
          } catch (error) {
            set({
              _syncError: error instanceof Error ? error.message : 'Settings sync failed',
            });
          }
        }, 500);
      },
    }),
    {
      name: 'vibe-remote-settings',
      partialize: (state) => ({
        model: state.model,
        voiceEnabled: state.voiceEnabled,
        voiceLanguage: state.voiceLanguage,
        autoCommitMsg: state.autoCommitMsg,
        projectsPath: state.projectsPath,
      }),
    }
  )
);
