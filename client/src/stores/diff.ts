// Diff Store

import { create } from 'zustand';
import {
  diff,
  type DiffReview,
  type FileDiff,
  type DiffSummary,
} from '../services/api';

interface DiffState {
  // Current diff (not yet in review)
  currentDiff: DiffSummary | null;

  // Reviews
  reviews: DiffReview[];
  currentReview: DiffReview | null;

  // Selected file for viewing
  selectedFile: FileDiff | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCurrentDiff: () => Promise<void>;
  loadReviews: () => Promise<void>;
  loadReview: (id: string) => Promise<void>;
  createReview: (conversationId?: string) => Promise<DiffReview>;
  approveAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  approveFile: (path: string) => Promise<void>;
  rejectFile: (path: string) => Promise<void>;
  selectFile: (file: FileDiff | null) => void;
  clearError: () => void;
}

export const useDiffStore = create<DiffState>((set, get) => ({
  currentDiff: null,
  reviews: [],
  currentReview: null,
  selectedFile: null,
  isLoading: false,
  error: null,

  loadCurrentDiff: async () => {
    set({ isLoading: true, error: null });
    try {
      const summary = await diff.getCurrent();
      set({ currentDiff: summary, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load diff',
      });
    }
  },

  loadReviews: async () => {
    set({ isLoading: true, error: null });
    try {
      const reviews = await diff.listReviews();
      set({ reviews, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load reviews',
      });
    }
  },

  loadReview: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const review = await diff.getReview(id);
      set({
        currentReview: review,
        selectedFile: review.files[0] || null,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load review',
      });
    }
  },

  createReview: async (conversationId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const review = await diff.createReview(conversationId);
      set({
        currentReview: review,
        selectedFile: review.files[0] || null,
        isLoading: false,
      });
      return review;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create review',
      });
      throw error;
    }
  },

  approveAll: async () => {
    const { currentReview } = get();
    if (!currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const updated = await diff.approveAll(currentReview.id);
      set({ currentReview: updated, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to approve',
      });
    }
  },

  rejectAll: async () => {
    const { currentReview } = get();
    if (!currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const updated = await diff.rejectAll(currentReview.id);
      set({ currentReview: updated, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to reject',
      });
    }
  },

  approveFile: async (path: string) => {
    const { currentReview } = get();
    if (!currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const result = await diff.applyActions(currentReview.id, [
        { path, action: 'approve' },
      ]);
      set({ currentReview: result.review, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to approve file',
      });
    }
  },

  rejectFile: async (path: string) => {
    const { currentReview } = get();
    if (!currentReview) return;

    set({ isLoading: true, error: null });
    try {
      const result = await diff.applyActions(currentReview.id, [
        { path, action: 'reject' },
      ]);
      set({ currentReview: result.review, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to reject file',
      });
    }
  },

  selectFile: (file: FileDiff | null) => {
    set({ selectedFile: file });
  },

  clearError: () => set({ error: null }),
}));
