import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  theme: "dark" | "light";
  activeRoute: string;
  searchQuery: string;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setActiveRoute: (route: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "dark",
      activeRoute: "/",
      searchQuery: "",

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setActiveRoute: (route) => set({ activeRoute: route }),
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: "edn-ui-storage",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);
