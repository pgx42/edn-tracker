import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  change?: number; // percentage change, positive = up
  subtitle?: string;
}

export function StatsCard({ label, value, icon: Icon, iconColor, change, subtitle }: StatsCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn("h-4 w-4", iconColor ?? "text-muted-foreground")} />
      </div>
      <span className="text-3xl font-bold">{value}</span>
      {(change !== undefined || subtitle) && (
        <div className="flex items-center gap-1">
          {change !== undefined && (
            <>
              {change >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400" />
              )}
              <span className={cn("text-xs font-medium", change >= 0 ? "text-green-400" : "text-red-400")}>
                {change >= 0 ? "+" : ""}{change}%
              </span>
            </>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
