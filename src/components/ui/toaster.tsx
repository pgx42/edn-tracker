import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[360px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border px-4 py-3 shadow-lg transition-all animate-in slide-in-from-bottom-2",
            "bg-background text-foreground",
            t.variant === "destructive" &&
              "border-red-500/50 bg-red-950/90 text-red-50"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {t.title && (
                <p className="text-sm font-semibold">{t.title}</p>
              )}
              {t.description && (
                <p className="text-sm opacity-80 mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
