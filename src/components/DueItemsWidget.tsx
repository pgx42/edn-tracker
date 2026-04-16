import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { CalendarClock, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DueItemSummary } from "@/stores/jmethod";

export function DueItemsWidget() {
  const [dueItems, setDueItems] = useState<DueItemSummary[]>([]);
  const [enabled, setEnabled] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const config = await invoke<{ enabled: boolean }>("get_j_method_config");
        setEnabled(config.enabled);
        if (config.enabled) {
          const items = await invoke<DueItemSummary[]>("get_due_items", { date: null });
          setDueItems(items);
        }
      } catch {
        // not available yet
      }
    }
    load();
  }, []);

  if (!enabled) return null;

  const overdueCount = dueItems.filter((i) => i.is_overdue).length;
  const todayCount = dueItems.filter((i) => !i.is_overdue).length;

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Méthode des J</h2>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-xs">
              {overdueCount} en retard
            </Badge>
          )}
          {todayCount > 0 && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border text-xs">
              {todayCount} aujourd'hui
            </Badge>
          )}
          {dueItems.length === 0 && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              À jour
            </Badge>
          )}
        </div>
      </div>

      {dueItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune révision prévue aujourd'hui. Commencez un item pour activer la méthode des J.
        </p>
      ) : (
        <div className="space-y-1.5">
          {dueItems.slice(0, 8).map((item) => (
            <div
              key={item.schedule_id}
              className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate("/items")}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {item.is_overdue ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                ) : (
                  <CalendarClock className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                )}
                <span className={cn(
                  "text-sm truncate",
                  item.is_overdue && "text-red-400"
                )}>
                  {item.title}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {item.j_label}
                </Badge>
                <Badge className={cn(
                  "border text-xs",
                  item.rank === "A" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                  item.rank === "B" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                  "bg-blue-500/20 text-blue-400 border-blue-500/30"
                )}>
                  {item.rank}
                </Badge>
              </div>
            </div>
          ))}
          {dueItems.length > 8 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => navigate("/items")}
            >
              +{dueItems.length - 8} autres items
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
