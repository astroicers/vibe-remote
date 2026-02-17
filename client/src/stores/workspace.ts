// Workspace Store - Git operations and workspace management

import { create } from 'zustand';
import {
  workspaces,
  type Workspace,
  type GitStatus,
  type GitCommit,
  type GitBranches,
} from '../services/api';

interface WorkspaceState {
  // Active workspace
  activeWorkspace: Workspace | null;
  workspaceList: Workspace[];

  // Git state
  gitStatus: GitStatus | null;
  branches: GitBranches | null;
  recentCommits: GitCommit[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkspaces: () => Promise<void>;
  loadActiveWorkspace: () => Promise<void>;
  setActiveWorkspace: (id: string) => Promise<void>;
  registerWorkspace: (path: string, name?: string) => Promise<void>;

  // Git actions
  loadGitStatus: () => Promise<void>;
  loadBranches: () => Promise<void>;
  loadRecentCommits: () => Promise<void>;
  stageFiles: (files: string[]) => Promise<void>;
  commit: (message: string) => Promise<string>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  checkout: (branch: string, create?: boolean) => Promise<void>;
  discardChanges: (files: string[]) => Promise<void>;

  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeWorkspace: null,
  workspaceList: [],
  gitStatus: null,
  branches: null,
  recentCommits: [],
  isLoading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await workspaces.list();
      set({ workspaceList: list, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load workspaces',
      });
    }
  },

  loadActiveWorkspace: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await workspaces.getActive();
      set({ activeWorkspace: workspace, isLoading: false });

      // Also load git status
      get().loadGitStatus();
    } catch (error) {
      set({
        activeWorkspace: null,
        isLoading: false,
        // Don't show error for "no active workspace"
      });
    }
  },

  setActiveWorkspace: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await workspaces.setActive(id);
      set({ activeWorkspace: workspace, isLoading: false });
      get().loadGitStatus();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to set workspace',
      });
    }
  },

  registerWorkspace: async (path: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await workspaces.register({ path, name, setActive: true });
      set({ activeWorkspace: workspace, isLoading: false });
      get().loadWorkspaces();
      get().loadGitStatus();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to register workspace',
      });
    }
  },

  loadGitStatus: async () => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) return;

    try {
      const status = await workspaces.getGitStatus(activeWorkspace.id);
      set({ gitStatus: status });
    } catch {
      set({ gitStatus: null });
    }
  },

  loadBranches: async () => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) return;

    try {
      const branches = await workspaces.getBranches(activeWorkspace.id);
      set({ branches });
    } catch {
      set({ branches: null });
    }
  },

  loadRecentCommits: async () => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) return;

    try {
      const commits = await workspaces.getGitLog(activeWorkspace.id, 10);
      set({ recentCommits: commits });
    } catch {
      set({ recentCommits: [] });
    }
  },

  stageFiles: async (files: string[]) => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');

    set({ isLoading: true, error: null });
    try {
      await workspaces.stageFiles(activeWorkspace.id, files);
      set({ isLoading: false });
      get().loadGitStatus();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to stage files',
      });
      throw error;
    }
  },

  commit: async (message: string) => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');

    set({ isLoading: true, error: null });
    try {
      const result = await workspaces.commit(activeWorkspace.id, message);
      set({ isLoading: false });
      get().loadGitStatus();
      get().loadRecentCommits();
      return result.hash;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to commit',
      });
      throw error;
    }
  },

  push: async () => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');

    set({ isLoading: true, error: null });
    try {
      await workspaces.push(activeWorkspace.id);
      set({ isLoading: false });
      get().loadGitStatus();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to push',
      });
      throw error;
    }
  },

  pull: async () => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');

    set({ isLoading: true, error: null });
    try {
      await workspaces.pull(activeWorkspace.id);
      set({ isLoading: false });
      get().loadGitStatus();
      get().loadRecentCommits();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to pull',
      });
      throw error;
    }
  },

  checkout: async (branch: string, create = false) => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');

    set({ isLoading: true, error: null });
    try {
      await workspaces.checkout(activeWorkspace.id, branch, create);
      set({ isLoading: false });
      get().loadGitStatus();
      get().loadBranches();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to checkout',
      });
      throw error;
    }
  },

  discardChanges: async (files: string[]) => {
    const { activeWorkspace } = get();
    if (!activeWorkspace) throw new Error('No active workspace');

    set({ isLoading: true, error: null });
    try {
      await workspaces.discardChanges(activeWorkspace.id, files);
      set({ isLoading: false });
      get().loadGitStatus();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to discard changes',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
