// Diff Store - Per-workspace partitioned state

import { create } from 'zustand';
import {
  diff,
  type DiffReview,
  type FileDiff,
  type DiffSummary,
} from '../services/api';
import { useToastStore } from './toast';

interface WorkspaceDiffState {
  currentDiff: DiffSummary | null;
  reviews: DiffReview[];
  currentReview: DiffReview | null;
  selectedFile: FileDiff | null;
}

function createDefaultWorkspaceDiffState(): WorkspaceDiffState {
  return {
    currentDiff: null,
    reviews: [],
    currentReview: null,
    selectedFile: null,
  };
}

interface DiffState {
  diffByWorkspace: Record<string, WorkspaceDiffState>;
  isLoading: boolean;
  error: string | null;

  getDiffState: (workspaceId: string) => WorkspaceDiffState;
  loadCurrentDiff: (workspaceId: string) => Promise<void>;
  loadReviews: (workspaceId: string) => Promise<void>;
  loadReview: (workspaceId: string, id: string) => Promise<void>;
  createReview: (workspaceId: string, conversationId?: string) => Promise<DiffReview>;
  approveAll: (workspaceId: string) => Promise<void>;
  rejectAll: (workspaceId: string) => Promise<void>;
  approveFile: (workspaceId: string, path: string) => Promise<void>;
  rejectFile: (workspaceId: string, path: string) => Promise<void>;
  addComment: (workspaceId: string, filePath: string, content: string) => Promise<void>;
  selectFile: (workspaceId: string, file: FileDiff | null) => void;
  clearError: () => void;
}

function updateWorkspaceDiff(
  state: DiffState,
  workspaceId: string,
  updater: (diffState: WorkspaceDiffState) => Partial<WorkspaceDiffState>
): Partial<DiffState> {
  const current = state.diffByWorkspace[workspaceId] || createDefaultWorkspaceDiffState();
  return {
    diffByWorkspace: {
      ...state.diffByWorkspace,
      [workspaceId]: { ...current, ...updater(current) },
    },
  };
}

export const useDiffStore = create<DiffState>((set, get) => ({
  diffByWorkspace: {},
  isLoading: false,
  error: null,

  getDiffState: (workspaceId: string) => {
    return get().diffByWorkspace[workspaceId] || createDefaultWorkspaceDiffState();
  },

  loadCurrentDiff: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const summary = await diff.getCurrent(workspaceId);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({ currentDiff: summary })),
        isLoading: false,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load diff';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
    }
  },

  loadReviews: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const reviews = await diff.listReviews(workspaceId);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({ reviews })),
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load reviews',
      });
    }
  },

  loadReview: async (workspaceId: string, id: string) => {
    set({ isLoading: true, error: null });
    try {
      const review = await diff.getReview(id);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({
          currentReview: review,
          selectedFile: review.files[0] || null,
        })),
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load review',
      });
    }
  },

  createReview: async (workspaceId: string, conversationId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const review = await diff.createReview(workspaceId, conversationId);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({
          currentReview: review,
          selectedFile: review.files[0] || null,
        })),
        isLoading: false,
      }));
      return review;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create review';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  approveAll: async (workspaceId: string) => {
    const wsDiff = get().getDiffState(workspaceId);
    if (!wsDiff.currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const updated = await diff.approveAll(wsDiff.currentReview.id);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({ currentReview: updated })),
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to approve',
      });
    }
  },

  rejectAll: async (workspaceId: string) => {
    const wsDiff = get().getDiffState(workspaceId);
    if (!wsDiff.currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const updated = await diff.rejectAll(wsDiff.currentReview.id);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({ currentReview: updated })),
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to reject',
      });
    }
  },

  approveFile: async (workspaceId: string, path: string) => {
    const wsDiff = get().getDiffState(workspaceId);
    if (!wsDiff.currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const result = await diff.applyActions(wsDiff.currentReview.id, [
        { path, action: 'approve' },
      ]);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({ currentReview: result.review })),
        isLoading: false,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to approve file';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
    }
  },

  rejectFile: async (workspaceId: string, path: string) => {
    const wsDiff = get().getDiffState(workspaceId);
    if (!wsDiff.currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const result = await diff.applyActions(wsDiff.currentReview.id, [
        { path, action: 'reject' },
      ]);
      set((state) => ({
        ...updateWorkspaceDiff(state, workspaceId, () => ({ currentReview: result.review })),
        isLoading: false,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to reject file';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
    }
  },

  addComment: async (workspaceId: string, filePath: string, content: string) => {
    const wsDiff = get().getDiffState(workspaceId);
    if (!wsDiff.currentReview) return;

    try {
      const comment = await diff.addComment(wsDiff.currentReview.id, filePath, content);
      set((state) => {
        const current = state.diffByWorkspace[workspaceId];
        if (!current?.currentReview) return state;
        return {
          diffByWorkspace: {
            ...state.diffByWorkspace,
            [workspaceId]: {
              ...current,
              currentReview: {
                ...current.currentReview,
                comments: [...current.currentReview.comments, comment],
              },
            },
          },
        };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add comment',
      });
    }
  },

  selectFile: (workspaceId: string, file: FileDiff | null) => {
    set((state) => updateWorkspaceDiff(state, workspaceId, () => ({ selectedFile: file })));
  },

  clearError: () => set({ error: null }),
}));
