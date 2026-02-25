import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, VOICE_LANGUAGES } from './settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useSettingsStore.setState({
      model: 'sonnet',
      voiceEnabled: true,
      voiceLanguage: 'en-US',
      autoCommitMsg: true,
      projectsPath: '',
    });
    // Clear localStorage to avoid persistence leaks between tests
    localStorage.clear();
  });

  it('has correct default values', () => {
    const state = useSettingsStore.getState();
    expect(state.model).toBe('sonnet');
    expect(state.voiceEnabled).toBe(true);
    expect(state.voiceLanguage).toBe('en-US');
    expect(state.autoCommitMsg).toBe(true);
    expect(state.projectsPath).toBe('');
  });

  it('setModel updates model', () => {
    useSettingsStore.getState().setModel('opus');
    expect(useSettingsStore.getState().model).toBe('opus');

    useSettingsStore.getState().setModel('sonnet');
    expect(useSettingsStore.getState().model).toBe('sonnet');
  });

  it('setModel supports haiku', () => {
    useSettingsStore.getState().setModel('haiku');
    expect(useSettingsStore.getState().model).toBe('haiku');
  });

  it('setModel accepts any string model key', () => {
    useSettingsStore.getState().setModel('custom-model');
    expect(useSettingsStore.getState().model).toBe('custom-model');
  });

  it('setVoiceEnabled updates voiceEnabled', () => {
    useSettingsStore.getState().setVoiceEnabled(false);
    expect(useSettingsStore.getState().voiceEnabled).toBe(false);

    useSettingsStore.getState().setVoiceEnabled(true);
    expect(useSettingsStore.getState().voiceEnabled).toBe(true);
  });

  it('setVoiceLanguage updates voiceLanguage', () => {
    useSettingsStore.getState().setVoiceLanguage('zh-TW');
    expect(useSettingsStore.getState().voiceLanguage).toBe('zh-TW');

    useSettingsStore.getState().setVoiceLanguage('ja-JP');
    expect(useSettingsStore.getState().voiceLanguage).toBe('ja-JP');
  });

  it('setAutoCommitMsg updates autoCommitMsg', () => {
    useSettingsStore.getState().setAutoCommitMsg(false);
    expect(useSettingsStore.getState().autoCommitMsg).toBe(false);
  });

  it('setProjectsPath updates projectsPath', () => {
    useSettingsStore.getState().setProjectsPath('/home/user/projects');
    expect(useSettingsStore.getState().projectsPath).toBe('/home/user/projects');
  });

  it('persists to localStorage', () => {
    useSettingsStore.getState().setModel('opus');
    useSettingsStore.getState().setVoiceLanguage('zh-TW');

    const stored = localStorage.getItem('vibe-remote-settings');
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.state.model).toBe('opus');
    expect(parsed.state.voiceLanguage).toBe('zh-TW');
  });

  it('VOICE_LANGUAGES has expected entries', () => {
    expect(VOICE_LANGUAGES.length).toBeGreaterThanOrEqual(9);

    const codes = VOICE_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('en-US');
    expect(codes).toContain('zh-TW');
    expect(codes).toContain('ja-JP');
    expect(codes).toContain('ko-KR');
  });
});
