import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/useToast";

interface JConfig {
  enabled: boolean;
  intervals: number[];
}

export function JMethodConfigPanel() {
  const [config, setConfig] = useState<JConfig>({
    enabled: true,
    intervals: [1, 3, 7, 14, 30, 60],
  });
  const [newDay, setNewDay] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    invoke<JConfig>("get_j_method_config")
      .then(setConfig)
      .catch(() => {});
  }, []);

  const handleToggle = (enabled: boolean) => {
    setConfig((c) => ({ ...c, enabled }));
    setDirty(true);
  };

  const handleAddDay = () => {
    const day = parseInt(newDay, 10);
    if (isNaN(day) || day < 1 || day > 365) return;
    if (config.intervals.includes(day)) return;
    const newIntervals = [...config.intervals, day].sort((a, b) => a - b);
    setConfig((c) => ({ ...c, intervals: newIntervals }));
    setNewDay("");
    setDirty(true);
  };

  const handleRemoveDay = (day: number) => {
    setConfig((c) => ({
      ...c,
      intervals: c.intervals.filter((d) => d !== day),
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await invoke("update_j_method_config", {
        enabled: config.enabled,
        intervals: config.intervals,
      });
      setDirty(false);
      toast({ title: "Configuration sauvegardée" });
    } catch (e) {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Activer la méthode des J</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Planifie automatiquement des révisions espacées pour chaque item
          </p>
        </div>
        <Switch checked={config.enabled} onCheckedChange={handleToggle} />
      </div>

      {config.enabled && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Intervalles de révision (en jours)</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {config.intervals.map((day) => (
                <Badge
                  key={day}
                  variant="secondary"
                  className="text-sm gap-1.5 pl-2.5 pr-1.5 py-1"
                >
                  J{day}
                  <button
                    onClick={() => handleRemoveDay(day)}
                    className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                placeholder="Ajouter un jour (ex: 45)"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddDay()}
                className="w-48"
              />
              <Button variant="outline" size="sm" onClick={handleAddDay}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Quand vous commencez un item, des rappels seront automatiquement planifiés aux jours indiqués.
            Par exemple avec [J1, J3, J7, J14, J30, J60], si vous commencez aujourd'hui, vous serez rappelé
            dans 1, 3, 7, 14, 30 et 60 jours.
          </p>
        </>
      )}

      {dirty && (
        <Button onClick={handleSave} size="sm" className="gap-1.5">
          <Save className="h-4 w-4" />
          Sauvegarder
        </Button>
      )}
    </div>
  );
}
