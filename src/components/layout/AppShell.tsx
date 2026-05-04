import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { usePreferences } from "@/stores/preferences";

export function AppShell() {
  const theme = usePreferences((s) => s.theme);
  const accent = usePreferences((s) => s.accent);
  const density = usePreferences((s) => s.density);
  const hasSeenOnboarding = usePreferences((s) => s.hasSeenOnboarding);
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.dataset.density = density;
    // Keep Tailwind's `class="dark"` toggle in sync with our data-theme so
    // legacy components (shadcn) continue to render the right palette.
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, accent, density]);

  return (
    <TooltipProvider>
      {!hasSeenOnboarding ? (
        <div className="edn-root" style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
          <Onboarding onDone={completeOnboarding} />
        </div>
      ) : (
        <div
          className="edn-root"
          style={{
            display: "flex",
            height: "100vh",
            width: "100vw",
            overflow: "hidden",
            background: "var(--bg-canvas)",
            color: "var(--fg-1)",
          }}
        >
          <Sidebar />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden" }}>
            <TopBar />
            <main style={{ flex: 1, overflow: "hidden", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <Outlet />
            </main>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
