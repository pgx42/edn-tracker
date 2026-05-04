import * as React from "react";
import { Moon, Sun, Database, Download, Upload, Brain, Info, Shield, LayoutDashboard, Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  usePreferences,
  type DashboardLayout,
  type AccentColor,
  type Density,
  type Theme,
} from "@/stores/preferences";

function SettingsSection({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <Separator />
      {children}
    </div>
  );
}

function SettingsRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const LAYOUT_OPTIONS: Array<{ id: DashboardLayout; label: string; sub: string }> = [
  { id: "cockpit", label: "Cockpit", sub: "focus aujourd'hui" },
  { id: "bureau", label: "Bureau", sub: "cahier + post-its" },
  { id: "notion", label: "Modulaire", sub: "blocs réordonnables" },
];

const ACCENT_OPTIONS: Array<{ id: AccentColor; swatch: string }> = [
  { id: "blue", swatch: "#2563eb" },
  { id: "teal", swatch: "#0d9488" },
  { id: "indigo", swatch: "#4f46e5" },
  { id: "rose", swatch: "#e11d48" },
];

const DENSITY_OPTIONS: Density[] = ["compact", "regular", "comfy"];

function PillGroup<T extends string>({
  value,
  options,
  onChange,
  render,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <div className="flex gap-1 p-0.5 rounded-md bg-muted">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "h-7 px-3 rounded text-xs font-medium capitalize transition-colors",
            value === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function Settings() {
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const layout = usePreferences((s) => s.layout);
  const setLayout = usePreferences((s) => s.setLayout);
  const accent = usePreferences((s) => s.accent);
  const setAccent = usePreferences((s) => s.setAccent);
  const density = usePreferences((s) => s.density);
  const setDensity = usePreferences((s) => s.setDensity);
  const resetOnboarding = usePreferences((s) => s.resetOnboarding);

  const isDark = theme === "dark";
  const handleThemeToggle = () => setTheme(isDark ? "light" : ("dark" as Theme));

  return (
    <div className="p-6 space-y-6 max-w-2xl overflow-auto h-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configuration de EDN Tracker
        </p>
      </div>

      {/* Appearance */}
      <SettingsSection title="Apparence" icon={isDark ? Moon : Sun}>
        <SettingsRow label="Thème sombre" description="Basculer entre le mode sombre et clair">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch id="theme-switch" checked={isDark} onCheckedChange={handleThemeToggle} />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
        </SettingsRow>
        <SettingsRow label="Couleur d'accent" description="Identité chromatique des actions principales">
          <div className="flex items-center gap-2">
            {ACCENT_OPTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                aria-label={a.id}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition",
                  accent === a.id ? "border-foreground" : "border-transparent"
                )}
                style={{ background: a.swatch }}
              />
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Densité" description="Taille de base des éléments d'interface">
          <PillGroup value={density} options={DENSITY_OPTIONS} onChange={setDensity} render={(o) => o} />
        </SettingsRow>
      </SettingsSection>

      {/* Dashboard layout */}
      <SettingsSection title="Tableau de bord" icon={LayoutDashboard}>
        <p className="text-xs text-muted-foreground -mt-2">
          Choisis la disposition de ton dashboard. Tu peux en changer à tout moment.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUT_OPTIONS.map((opt) => {
            const sel = layout === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setLayout(opt.id)}
                className={cn(
                  "rounded-md border p-3 text-left transition",
                  sel
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-foreground/30"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Palette className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold">{opt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{opt.sub}</p>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Onboarding replay */}
      <SettingsSection title="Onboarding" icon={Sparkles}>
        <SettingsRow
          label="Revoir l'onboarding"
          description="Relance les 4 étapes de bienvenue (année, Anki, dashboard)"
        >
          <Button variant="outline" size="sm" onClick={resetOnboarding}>
            Rejouer
          </Button>
        </SettingsRow>
      </SettingsSection>

      {/* Database */}
      <SettingsSection title="Base de données" icon={Database}>
        <SettingsRow
          label="Emplacement de la base"
          description="Fichier SQLite local"
        >
          <Badge variant="outline" className="font-mono text-xs">
            ~/Library/AppData/EDNtracker/data.db
          </Badge>
        </SettingsRow>

        <SettingsRow
          label="Taille de la base"
          description="Espace disque utilisé"
        >
          <Badge variant="secondary">2.4 MB</Badge>
        </SettingsRow>

        <SettingsRow
          label="Dernière sauvegarde"
          description="Sauvegarde automatique quotidienne"
        >
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-xs">
            Aujourd'hui 08:30
          </Badge>
        </SettingsRow>

        <Separator />

        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            Exporter sauvegarde
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" />
            Restaurer
          </Button>
        </div>
      </SettingsSection>

      {/* AI Module */}
      <SettingsSection title="Module IA" icon={Brain}>
        <div className={cn(
          "rounded-md p-3 border text-sm",
          "bg-muted/40 text-muted-foreground border-border"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4" />
            <span className="font-medium">Fonctionnalités IA</span>
            <Badge variant="secondary" className="text-xs ml-auto">Bientôt disponible</Badge>
          </div>
          <p className="text-xs leading-relaxed">
            Les fonctionnalités d'intelligence artificielle (génération automatique de fiches Anki,
            suggestions de révision, analyse des lacunes) seront disponibles dans une prochaine version.
          </p>
        </div>

        <SettingsRow
          label="Génération de cartes Anki"
          description="Créer automatiquement des flashcards à partir des items"
        >
          <Switch disabled checked={false} />
        </SettingsRow>

        <SettingsRow
          label="Suggestions de révision"
          description="Recommandations personnalisées basées sur vos erreurs"
        >
          <Switch disabled checked={false} />
        </SettingsRow>

        <SettingsRow
          label="Analyse des patterns d'erreurs"
          description="Identifier les thèmes récurrents dans vos erreurs"
        >
          <Switch disabled checked={false} />
        </SettingsRow>
      </SettingsSection>

      {/* Data & Privacy */}
      <SettingsSection title="Données et confidentialité" icon={Shield}>
        <SettingsRow
          label="Stockage local uniquement"
          description="Toutes vos données restent sur votre appareil"
        >
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-xs">
            Actif
          </Badge>
        </SettingsRow>

        <SettingsRow
          label="Télémétrie anonyme"
          description="Partager des statistiques d'utilisation anonymes"
        >
          <Switch id="telemetry" />
        </SettingsRow>

        <Separator />

        <Button variant="destructive" size="sm" className="gap-1.5">
          Réinitialiser toutes les données
        </Button>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="À propos" icon={Info}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Application</span>
            <span className="font-medium">EDN Tracker</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Version</span>
            <Badge variant="secondary">0.1.0-alpha</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Framework</span>
            <span className="text-muted-foreground">Tauri + React + TypeScript</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Base de données</span>
            <span className="text-muted-foreground">SQLite via rusqlite</span>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
