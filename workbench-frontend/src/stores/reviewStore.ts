/**
 * Review Store
 * Zustand store for the chat moderation review system
 */

import { create } from 'zustand';
import type {
  QueueSession, ReviewConfiguration, ReviewNotification,
  BannerAlerts, ReviewerDashboardStats, TeamDashboardStats,
  DashboardPeriod,
  RiskFlag, DeanonymizationRequest, AnonymizedMessage,
  SessionReview, MessageRating
} from '@mentalhelpglobal/chat-types';
import * as reviewApi from '@/services/reviewApi';

// ── State Interface ──

interface ReviewState {
  // Queue
  queue: QueueSession[];
  queueTotal: number;
  queueCounts: { pending: number; flagged: number; inProgress: number; completed: number };
  queueLoading: boolean;
  queueTab: 'pending' | 'flagged' | 'in_progress' | 'completed' | 'excluded' | 'supervision' | 'awaiting';
  queuePage: number;
  queueFilters: {
    riskLevel?: string;
    language?: string;
    dateFrom?: string;
    dateTo?: string;
    assignedToMe?: boolean;
    sortBy?: string;
    tags?: string;
  };
  selectedTags: string[];
  showExcluded: boolean;
  queueScopeGroupId?: string;

  // Session
  selectedSession: any | null; // SessionDetail
  sessionMessages: AnonymizedMessage[];
  sessionLoading: boolean;

  // Review
  currentReview: SessionReview | null;
  ratings: Map<string, MessageRating>; // messageId -> rating

  // Flags
  sessionFlags: RiskFlag[];
  escalations: RiskFlag[];
  escalationsTotal: number;

  // Deanonymization
  deanonymizationRequests: DeanonymizationRequest[];

  // Notifications
  notifications: ReviewNotification[];
  unreadCount: number;
  bannerAlerts: BannerAlerts;

  // Dashboard
  myDashboard: ReviewerDashboardStats | null;
  teamDashboard: TeamDashboardStats | null;
  dashboardPeriod: DashboardPeriod;

  // Config
  config: ReviewConfiguration | null;

  // Error
  error: string | null;

  // ── Actions ──

  // Queue
  fetchQueue: () => Promise<void>;
  setQueueTab: (tab: ReviewState['queueTab']) => void;
  setQueuePage: (page: number) => void;
  setQueueFilters: (filters: Partial<ReviewState['queueFilters']>) => void;
  setSelectedTags: (tags: string[]) => void;
  setShowExcluded: (show: boolean) => void;
  setQueueScopeGroupId: (groupId?: string) => void;

  // Session
  selectSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;

  // Review
  startReview: (sessionId: string) => Promise<void>;
  saveRating: (sessionId: string, reviewId: string, input: Partial<MessageRating>) => Promise<void>;
  submitReview: (sessionId: string, reviewId: string, input?: { overallComment?: string }) => Promise<void>;

  // Flags
  createFlag: (sessionId: string, input: {
    severity: string;
    reasonCategory: string;
    details: string;
    requestDeanonymization?: boolean;
    deanonymizationJustification?: string;
  }) => Promise<RiskFlag | undefined>;
  fetchEscalations: (params?: reviewApi.EscalationParams) => Promise<void>;
  resolveFlag: (flagId: string, input: { resolution: string; notes: string }) => Promise<void>;

  // Deanonymization
  createDeanonymizationRequest: (input: {
    sessionId: string;
    flagId?: string;
    justificationCategory: string;
    justificationDetails: string;
  }) => Promise<void>;
  fetchDeanonymizationRequests: (params?: reviewApi.DeanonymizationListParams) => Promise<void>;
  approveDeanonymization: (requestId: string, input?: { notes?: string }) => Promise<void>;
  denyDeanonymization: (requestId: string, input: { denialNotes: string }) => Promise<void>;
  getRevealedIdentity: (requestId: string) => Promise<void>;

  // Notifications
  fetchNotifications: (params?: reviewApi.NotificationParams) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  fetchBannerAlerts: () => Promise<void>;

  // Dashboard
  fetchMyDashboard: (period?: DashboardPeriod) => Promise<void>;
  fetchTeamDashboard: (period?: DashboardPeriod) => Promise<void>;
  setDashboardPeriod: (period: DashboardPeriod) => void;

  // Config
  fetchConfig: () => Promise<void>;
  updateConfig: (input: Partial<ReviewConfiguration>) => Promise<void>;

  // Assignment
  assignSession: (sessionId: string, reviewerId: string) => Promise<void>;

  // Error
  clearError: () => void;
}

// ── Store ──

export const useReviewStore = create<ReviewState>()((set, get) => ({
  // ── Initial State ──

  // Queue
  queue: [],
  queueTotal: 0,
  queueCounts: { pending: 0, flagged: 0, inProgress: 0, completed: 0 },
  queueLoading: false,
  queueTab: 'pending',
  queuePage: 1,
  queueFilters: {},
  selectedTags: [],
  showExcluded: false,
  queueScopeGroupId: undefined,

  // Session
  selectedSession: null,
  sessionMessages: [],
  sessionLoading: false,

  // Review
  currentReview: null,
  ratings: new Map(),

  // Flags
  sessionFlags: [],
  escalations: [],
  escalationsTotal: 0,

  // Deanonymization
  deanonymizationRequests: [],

  // Notifications
  notifications: [],
  unreadCount: 0,
  bannerAlerts: { highRiskEscalations: 0, pendingDeanonymizations: 0, overdueSlaCounts: 0 },

  // Dashboard
  myDashboard: null,
  teamDashboard: null,
  dashboardPeriod: 'week' as DashboardPeriod,

  // Config
  config: null,

  // Error
  error: null,

  // ── Actions ──

  // Queue
  fetchQueue: async () => {
    const { queueTab, queuePage, queueFilters, selectedTags, showExcluded, queueScopeGroupId } = get();
    set({ queueLoading: true, error: null });
    try {
      const result = await reviewApi.getReviewQueue({
        status: showExcluded ? 'pending' : queueTab,
        page: queuePage,
        ...queueFilters,
        ...(selectedTags.length > 0 ? { tags: selectedTags.join(',') } : {}),
        ...(showExcluded ? { excluded: true } : {}),
        ...(queueScopeGroupId ? { groupId: queueScopeGroupId } : {}),
      });
      set({
        queue: result.items,
        queueTotal: result.total,
        queueCounts: result.counts,
        queueLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch queue';
      set({ error: message, queueLoading: false });
    }
  },

  setQueueTab: (tab) => {
    if (tab === 'excluded') {
      set({ showExcluded: true, queuePage: 1 });
    } else {
      set({ queueTab: tab, showExcluded: false, queuePage: 1 });
    }
    get().fetchQueue();
  },

  setQueuePage: (page) => {
    set({ queuePage: page });
    get().fetchQueue();
  },

  setQueueFilters: (filters) => {
    set((state) => ({
      queueFilters: { ...state.queueFilters, ...filters },
      queuePage: 1,
    }));
    get().fetchQueue();
  },

  setSelectedTags: (tags) => {
    set({ selectedTags: tags, queuePage: 1 });
    get().fetchQueue();
  },

  setShowExcluded: (show) => {
    set({ showExcluded: show, queuePage: 1 });
    get().fetchQueue();
  },

  setQueueScopeGroupId: (groupId) => {
    set({ queueScopeGroupId: groupId, queuePage: 1 });
    get().fetchQueue();
  },

  // Session
  selectSession: async (sessionId) => {
    const { queueScopeGroupId } = get();
    set({
      sessionLoading: true,
      error: null,
      selectedSession: null,
      sessionMessages: [],
      sessionFlags: [],
      currentReview: null,
      ratings: new Map(),
    });
    try {
      const result = await reviewApi.getReviewSession(sessionId, queueScopeGroupId);
      set({
        selectedSession: result.session,
        sessionMessages: (result.messages ?? []) as AnonymizedMessage[],
        sessionFlags: result.flags ?? [],
        currentReview: result.reviews?.[0] ?? null,
        sessionLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load session';
      set({ error: message, sessionLoading: false });
    }
  },

  clearSession: () => {
    set({
      selectedSession: null,
      sessionMessages: [],
      sessionFlags: [],
      currentReview: null,
      ratings: new Map(),
    });
  },

  // Review
  startReview: async (sessionId) => {
    set({ error: null });
    try {
      const review = await reviewApi.startReview(sessionId);
      set({ currentReview: review });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start review';
      set({ error: message });
    }
  },

  saveRating: async (sessionId, reviewId, input) => {
    set({ error: null });
    try {
      const rating = await reviewApi.saveRating(sessionId, reviewId, input);
      set((state) => {
        const newRatings = new Map(state.ratings);
        const payloadMessageId =
          typeof rating.messageId === 'string' ? rating.messageId.trim() : '';
        const fallbackMessageId =
          input.messageId != null ? String(input.messageId).trim() : '';
        const messageId = payloadMessageId || fallbackMessageId;
        if (messageId) {
          newRatings.set(messageId, { ...rating, messageId });
        }
        return { ratings: newRatings };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save rating';
      set({ error: message });
      throw err instanceof Error ? err : new Error(message);
    }
  },

  submitReview: async (sessionId, reviewId, input) => {
    set({ error: null });
    try {
      const review = await reviewApi.submitReview(sessionId, reviewId, input);
      set({ currentReview: review });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit review';
      set({ error: message });
    }
  },

  // Flags
  createFlag: async (sessionId, input) => {
    set({ error: null });
    try {
      const flag = await reviewApi.createFlag(sessionId, input);
      set((state) => ({
        sessionFlags: [...state.sessionFlags, flag],
      }));
      return flag;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create flag';
      set({ error: message });
      return undefined;
    }
  },

  fetchEscalations: async (params) => {
    set({ error: null });
    try {
      const result = await reviewApi.getEscalationQueue(params);
      set({
        escalations: result.items,
        escalationsTotal: result.total,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch escalations';
      set({ error: message });
    }
  },

  resolveFlag: async (flagId, input) => {
    set({ error: null });
    try {
      const state = get();
      const sessionId =
        state.sessionFlags.find((f) => f.id === flagId)?.sessionId ??
        state.escalations.find((f) => f.id === flagId)?.sessionId;
      if (!sessionId) {
        throw new Error('Unable to resolve flag: session context is missing');
      }
      const resolved = await reviewApi.resolveFlag(sessionId, flagId, input);
      set((state) => ({
        sessionFlags: state.sessionFlags.map((f) =>
          f.id === flagId ? resolved : f
        ),
        escalations: state.escalations.map((f) =>
          f.id === flagId ? resolved : f
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve flag';
      set({ error: message });
    }
  },

  // Deanonymization
  createDeanonymizationRequest: async (input) => {
    set({ error: null });
    try {
      const request = await reviewApi.createDeanonymizationRequest(input);
      set((state) => ({
        deanonymizationRequests: [...state.deanonymizationRequests, request],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create deanonymization request';
      set({ error: message });
    }
  },

  fetchDeanonymizationRequests: async (params) => {
    set({ error: null });
    try {
      const result = await reviewApi.getDeanonymizationRequests(params);
      set({ deanonymizationRequests: result.items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch deanonymization requests';
      set({ error: message });
    }
  },

  approveDeanonymization: async (requestId, input) => {
    set({ error: null });
    try {
      const updated = await reviewApi.approveDeanonymization(requestId, input);
      set((state) => ({
        deanonymizationRequests: state.deanonymizationRequests.map((r) =>
          r.id === requestId ? updated : r
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve deanonymization';
      set({ error: message });
    }
  },

  denyDeanonymization: async (requestId, input) => {
    set({ error: null });
    try {
      const updated = await reviewApi.denyDeanonymization(requestId, input);
      set((state) => ({
        deanonymizationRequests: state.deanonymizationRequests.map((r) =>
          r.id === requestId ? updated : r
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deny deanonymization';
      set({ error: message });
    }
  },

  getRevealedIdentity: async (requestId) => {
    set({ error: null });
    try {
      await reviewApi.getRevealedIdentity(requestId);
      // Identity data will be consumed by the component directly;
      // the store call is kept for error handling consistency.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve identity';
      set({ error: message });
    }
  },

  // Notifications
  fetchNotifications: async (params) => {
    set({ error: null });
    try {
      const result = await reviewApi.getNotifications(params);
      set({
        notifications: result.items,
        unreadCount: result.unreadCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      set({ error: message });
    }
  },

  markNotificationRead: async (id) => {
    try {
      await reviewApi.markNotificationRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, readAt: new Date() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark notification as read';
      set({ error: message });
    }
  },

  markAllRead: async () => {
    try {
      await reviewApi.markAllNotificationsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, readAt: new Date() })),
        unreadCount: 0,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark all as read';
      set({ error: message });
    }
  },

  fetchBannerAlerts: async () => {
    try {
      const alerts = await reviewApi.getBannerAlerts();
      set({ bannerAlerts: alerts });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch banner alerts';
      set({ error: message });
    }
  },

  // Dashboard
  fetchMyDashboard: async (period) => {
    const effectivePeriod = period ?? get().dashboardPeriod;
    set({ error: null });
    try {
      const stats = await reviewApi.getMyDashboard(effectivePeriod);
      set({ myDashboard: stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
      set({ error: message });
    }
  },

  fetchTeamDashboard: async (period) => {
    const effectivePeriod = period ?? get().dashboardPeriod;
    set({ error: null });
    try {
      const stats = await reviewApi.getTeamDashboard(effectivePeriod);
      set({ teamDashboard: stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch team dashboard';
      set({ error: message });
    }
  },

  setDashboardPeriod: (period) => {
    set({ dashboardPeriod: period });
  },

  // Config
  fetchConfig: async () => {
    set({ error: null });
    try {
      const config = await reviewApi.getReviewConfig();
      set({ config });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch configuration';
      set({ error: message });
    }
  },

  updateConfig: async (input) => {
    set({ error: null });
    try {
      const config = await reviewApi.updateReviewConfig(input);
      set({ config });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update configuration';
      set({ error: message });
    }
  },

  // Assignment
  assignSession: async (sessionId, reviewerId) => {
    set({ error: null });
    try {
      await reviewApi.assignSession(sessionId, reviewerId);
      // Refresh the queue to reflect assignment changes
      get().fetchQueue();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign session';
      set({ error: message });
    }
  },

  // Error
  clearError: () => set({ error: null }),
}));
