import { useState, useEffect } from "react";
import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="h-14 flex items-center gap-4 px-4 border-b border-border bg-background shrink-0">
      <div className="flex-1 max-w-md">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 h-9 w-full rounded-md border border-input bg-background text-muted-foreground text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Rechercher…</span>
          <kbd className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
