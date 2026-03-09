import { create } from 'zustand';
import type {
  SupervisionQueueItem,
  AwaitingFeedbackItem,
  SupervisorReview,
  SupervisorDecisionInput,
} from '@mentalhelpglobal/chat-types';
import * as reviewApi from '@/services/reviewApi';

interface SupervisionState {
  queue: SupervisionQueueItem[];
  queueLoading: boolean;
  awaitingFeedback: AwaitingFeedbackItem[];
  awaitingLoading: boolean;
  supervisionContext: {
    review: any;
    ratings: any[];
    priorDecisions: SupervisorReview[];
  } | null;
  contextLoading: boolean;
  error: string | null;

  fetchQueue: () => Promise<void>;
  fetchAwaitingFeedback: (reviewerId: string) => Promise<void>;
  fetchContext: (sessionReviewId: string) => Promise<void>;
  submitDecision: (sessionReviewId: string, input: SupervisorDecisionInput) => Promise<SupervisorReview>;
  clearContext: () => void;
}

export const useSupervisionStore = create<SupervisionState>()((set) => ({
  queue: [],
  queueLoading: false,
  awaitingFeedback: [],
  awaitingLoading: false,
  supervisionContext: null,
  contextLoading: false,
  error: null,

  fetchQueue: async () => {
    set({ queueLoading: true, error: null });
    try {
      const queue = await reviewApi.getSupervisionQueue();
      set({ queue, queueLoading: false });
    } catch (err: any) {
      set({ queueLoading: false, error: err.message });
    }
  },

  fetchAwaitingFeedback: async (reviewerId: string) => {
    set({ awaitingLoading: true, error: null });
    try {
      const items = await reviewApi.getAwaitingFeedback(reviewerId);
      set({ awaitingFeedback: items, awaitingLoading: false });
    } catch (err: any) {
      set({ awaitingLoading: false, error: err.message });
    }
  },

  fetchContext: async (sessionReviewId: string) => {
    set({ contextLoading: true, error: null });
    try {
      const ctx = await reviewApi.getSupervisionContext(sessionReviewId);
      set({ supervisionContext: ctx, contextLoading: false });
    } catch (err: any) {
      set({ contextLoading: false, error: err.message });
    }
  },

  submitDecision: async (sessionReviewId: string, input: SupervisorDecisionInput) => {
    const result = await reviewApi.submitSupervisionDecision(sessionReviewId, input);
    set((state) => ({
      queue: state.queue.filter((q) => q.sessionReviewId !== sessionReviewId),
      supervisionContext: null,
    }));
    return result;
  },

  clearContext: () => set({ supervisionContext: null }),
}));
