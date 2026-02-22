// Settings Store - Persisted app settings with zustand persist middleware

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  model: string;
  voiceEnabled: boolean;
  voiceLanguage: string;
  autoCommitMsg: boolean;
  projectsPath: string;

  setModel: (model: string) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceLanguage: (language: string) => void;
  setAutoCommitMsg: (enabled: boolean) => void;
  setProjectsPath: (path: string) => void;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: 'sonnet',
      voiceEnabled: true,
      voiceLanguage: 'en-US',
      autoCommitMsg: true,
      projectsPath: '',

      setModel: (model) => set({ model }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setVoiceLanguage: (voiceLanguage) => set({ voiceLanguage }),
      setAutoCommitMsg: (autoCommitMsg) => set({ autoCommitMsg }),
      setProjectsPath: (projectsPath) => set({ projectsPath }),
    }),
    {
      name: 'vibe-remote-settings',
    }
  )
);
