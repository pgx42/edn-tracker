import { usePreferences } from "@/stores/preferences";
import { CockpitLayout } from "@/components/dashboard/layouts/CockpitLayout";
import { BureauLayout } from "@/components/dashboard/layouts/BureauLayout";
import { NotionLayout } from "@/components/dashboard/layouts/NotionLayout";

export function Dashboard() {
  const layout = usePreferences((s) => s.layout);

  return (
    <div className="edn-root" style={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      {layout === "cockpit" && <CockpitLayout />}
      {layout === "bureau" && <BureauLayout />}
      {layout === "notion" && <NotionLayout />}
    </div>
  );
}
