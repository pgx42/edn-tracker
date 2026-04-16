import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface JMethodConfig {
  enabled: boolean;
  intervals: number[];
}

export interface DueItemSummary {
  schedule_id: string;
  item_id: number;
  code: string;
  title: string;
  specialty_id: string;
  rank: string;
  scheduled_date: string;
  j_step: number;
  j_label: string;
  is_overdue: boolean;
}

export interface ItemReviewSchedule {
  id: string;
  item_id: number;
  scheduled_date: string;
  j_step: number;
  j_label: string;
  completed: number;
  completed_at: string | null;
}

interface JMethodState {
  config: JMethodConfig;
  dueItems: DueItemSummary[];
  isLoading: boolean;

  loadConfig: () => Promise<void>;
  updateConfig: (enabled: boolean, intervals: number[]) => Promise<void>;
  loadDueItems: (date?: string) => Promise<void>;
  startReview: (itemId: number) => Promise<ItemReviewSchedule[]>;
  completeReview: (scheduleId: string, quality: number, notes?: string) => Promise<void>;
  resetReview: (itemId: number) => Promise<void>;
}

export const useJMethodStore = create<JMethodState>()((set, get) => ({
  config: { enabled: true, intervals: [1, 3, 7, 14, 30, 60] },
  dueItems: [],
  isLoading: false,

  loadConfig: async () => {
    try {
      const config = await invoke<JMethodConfig>("get_j_method_config");
      set({ config });
    } catch {
      // keep defaults
    }
  },

  updateConfig: async (enabled, intervals) => {
    const config = await invoke<JMethodConfig>("update_j_method_config", {
      enabled,
      intervals,
    });
    set({ config });
  },

  loadDueItems: async (date?: string) => {
    set({ isLoading: true });
    try {
      const dueItems = await invoke<DueItemSummary[]>("get_due_items", {
        date: date ?? null,
      });
      set({ dueItems });
    } catch {
      set({ dueItems: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  startReview: async (itemId: number) => {
    const schedules = await invoke<ItemReviewSchedule[]>("start_item_review", {
      itemId,
    });
    // Refresh due items
    await get().loadDueItems();
    return schedules;
  },

  completeReview: async (scheduleId: string, quality: number, notes?: string) => {
    await invoke("complete_review", {
      scheduleId,
      quality,
      notes: notes ?? null,
    });
    // Refresh due items
    await get().loadDueItems();
  },

  resetReview: async (itemId: number) => {
    await invoke("reset_item_review", { itemId });
    await get().loadDueItems();
  },
}));
