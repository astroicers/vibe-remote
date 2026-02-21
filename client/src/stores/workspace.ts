// Workspace Store - Client-side selection + per-workspace git state

import { create } from 'zustand';
import {
  workspaces,
  type Workspace,
  type GitStatus,
  type GitCommit,
  type GitBranches,
} from '../services/api';
import { useToastStore } from './toast';

interface GitState {
  gitStatus: GitStatus | null;
  branches: GitBranches | null;
  recentCommits: GitCommit[];
}

interface WorkspaceState {
  // All registered workspaces
  workspaceList: Workspace[];

  // Client-side selection (NOT persisted to server)
  selectedWorkspaceId: string | null;

  // Per-workspace git state
  gitStateByWorkspace: Record<string, GitState>;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Computed
  selectedWorkspace: () => Workspace | null;

  // Actions
  loadWorkspaces: () => Promise<void>;
  selectWorkspace: (id: string) => void;
  registerWorkspace: (path: string, name?: string) => Promise<void>;
  updateWorkspace: (id: string, data: { name?: string; systemPrompt?: string }) => Promise<void>;

  // Git actions — all take workspaceId explicitly
  loadGitStatus: (workspaceId: string) => Promise<void>;
  loadBranches: (workspaceId: string) => Promise<void>;
  loadRecentCommits: (workspaceId: string) => Promise<void>;
  stageFiles: (workspaceId: string, files: string[]) => Promise<void>;
  commit: (workspaceId: string, message: string) => Promise<string>;
  push: (workspaceId: string) => Promise<void>;
  pull: (workspaceId: string) => Promise<void>;
  checkout: (workspaceId: string, branch: string, create?: boolean) => Promise<void>;
  discardChanges: (workspaceId: string, files: string[]) => Promise<void>;

  clearError: () => void;
}

function createDefaultGitState(): GitState {
  return {
    gitStatus: null,
    branches: null,
    recentCommits: [],
  };
}

function updateGitState(
  state: WorkspaceState,
  workspaceId: string,
  updater: (git: GitState) => Partial<GitState>
): Partial<WorkspaceState> {
  const current = state.gitStateByWorkspace[workspaceId] || createDefaultGitState();
  return {
    gitStateByWorkspace: {
      ...state.gitStateByWorkspace,
      [workspaceId]: { ...current, ...updater(current) },
    },
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaceList: [],
  selectedWorkspaceId: localStorage.getItem('selectedWorkspaceId'),
  gitStateByWorkspace: {},
  isLoading: false,
  error: null,

  selectedWorkspace: () => {
    const { workspaceList, selectedWorkspaceId } = get();
    return workspaceList.find((w) => w.id === selectedWorkspaceId) ?? null;
  },

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await workspaces.list();
      const { selectedWorkspaceId } = get();

      // Auto-select the first workspace if nothing is selected
      const newSelectedId =
        selectedWorkspaceId && list.some((w) => w.id === selectedWorkspaceId)
          ? selectedWorkspaceId
          : list.length > 0
            ? list[0].id
            : null;

      if (newSelectedId && newSelectedId !== selectedWorkspaceId) {
        localStorage.setItem('selectedWorkspaceId', newSelectedId);
      }

      set({ workspaceList: list, selectedWorkspaceId: newSelectedId, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load workspaces',
      });
    }
  },

  selectWorkspace: (id: string) => {
    localStorage.setItem('selectedWorkspaceId', id);
    set({ selectedWorkspaceId: id });
  },

  registerWorkspace: async (path: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await workspaces.register({ path, name });
      set({ isLoading: false });
      get().loadWorkspaces();
      get().selectWorkspace(workspace.id);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to register workspace',
      });
    }
  },

  updateWorkspace: async (id: string, data: { name?: string; systemPrompt?: string }) => {
    set({ isLoading: true, error: null });
    try {
      await workspaces.update(id, data);
      set({ isLoading: false });
      get().loadWorkspaces();
      useToastStore.getState().addToast('Workspace updated', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update workspace';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
    }
  },

  loadGitStatus: async (workspaceId: string) => {
    try {
      const gitStatus = await workspaces.getGitStatus(workspaceId);
      set((state) => updateGitState(state, workspaceId, () => ({ gitStatus })));
    } catch {
      set((state) => updateGitState(state, workspaceId, () => ({ gitStatus: null })));
    }
  },

  loadBranches: async (workspaceId: string) => {
    try {
      const branches = await workspaces.getBranches(workspaceId);
      set((state) => updateGitState(state, workspaceId, () => ({ branches })));
    } catch {
      set((state) => updateGitState(state, workspaceId, () => ({ branches: null })));
    }
  },

  loadRecentCommits: async (workspaceId: string) => {
    try {
      const recentCommits = await workspaces.getGitLog(workspaceId, 10);
      set((state) => updateGitState(state, workspaceId, () => ({ recentCommits })));
    } catch {
      set((state) => updateGitState(state, workspaceId, () => ({ recentCommits: [] })));
    }
  },

  stageFiles: async (workspaceId: string, files: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await workspaces.stageFiles(workspaceId, files);
      set({ isLoading: false });
      get().loadGitStatus(workspaceId);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to stage files',
      });
      throw error;
    }
  },

  commit: async (workspaceId: string, message: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await workspaces.commit(workspaceId, message);
      set({ isLoading: false });
      get().loadGitStatus(workspaceId);
      get().loadRecentCommits(workspaceId);
      useToastStore.getState().addToast(`Committed: ${result.hash.slice(0, 7)}`, 'success');
      return result.hash;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to commit';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  push: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      await workspaces.push(workspaceId);
      set({ isLoading: false });
      get().loadGitStatus(workspaceId);
      useToastStore.getState().addToast('Pushed successfully', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to push';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  pull: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      await workspaces.pull(workspaceId);
      set({ isLoading: false });
      get().loadGitStatus(workspaceId);
      get().loadRecentCommits(workspaceId);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to pull',
      });
      throw error;
    }
  },

  checkout: async (workspaceId: string, branch: string, create = false) => {
    set({ isLoading: true, error: null });
    try {
      await workspaces.checkout(workspaceId, branch, create);
      set({ isLoading: false });
      get().loadGitStatus(workspaceId);
      get().loadBranches(workspaceId);
      useToastStore.getState().addToast(`Switched to ${branch}`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to checkout';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  discardChanges: async (workspaceId: string, files: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await workspaces.discardChanges(workspaceId, files);
      set({ isLoading: false });
      get().loadGitStatus(workspaceId);
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
