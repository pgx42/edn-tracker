import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DashboardLayout = "cockpit" | "bureau" | "notion";
export type AccentColor = "blue" | "teal" | "indigo" | "rose";
export type Density = "compact" | "regular" | "comfy";
export type Theme = "light" | "dark";
export type StudentYear = "DFGSM2" | "DFGSM3" | "DFASM1" | "DFASM2" | "DFASM3";

interface PreferencesState {
  layout: DashboardLayout;
  accent: AccentColor;
  density: Density;
  theme: Theme;
  hasSeenOnboarding: boolean;
  studentYear: StudentYear;

  setLayout: (l: DashboardLayout) => void;
  setAccent: (a: AccentColor) => void;
  setDensity: (d: Density) => void;
  setTheme: (t: Theme) => void;
  setStudentYear: (y: StudentYear) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      layout: "cockpit",
      accent: "blue",
      density: "regular",
      theme: "dark",
      hasSeenOnboarding: false,
      studentYear: "DFASM3",

      setLayout: (layout) => set({ layout }),
      setAccent: (accent) => set({ accent }),
      setDensity: (density) => set({ density }),
      setTheme: (theme) => set({ theme }),
      setStudentYear: (studentYear) => set({ studentYear }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      resetOnboarding: () => set({ hasSeenOnboarding: false }),
    }),
    { name: "edn-preferences" }
  )
);
