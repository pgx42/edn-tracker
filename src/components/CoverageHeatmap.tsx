import { cn } from "@/lib/utils";

interface DayData {
  date: string;
  count: number;
}

function generateMockHeatmapData(): DayData[] {
  const data: DayData[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    // Random study activity with some days empty
    const rand = Math.random();
    const count = rand < 0.45 ? 0 : rand < 0.65 ? 1 : rand < 0.80 ? 2 : rand < 0.92 ? 4 : 6;
    data.push({ date: dateStr, count });
  }
  return data;
}

const DAYS = generateMockHeatmapData();

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-muted";
  if (count <= 1) return "bg-primary/20";
  if (count <= 2) return "bg-primary/40";
  if (count <= 4) return "bg-primary/70";
  return "bg-primary";
}

export function CoverageHeatmap() {
  // Group days into weeks (53 columns of 7)
  const weeks: DayData[][] = [];
  for (let i = 0; i < DAYS.length; i += 7) {
    weeks.push(DAYS.slice(i, i + 7));
  }

  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1">
          <div className="h-3" /> {/* month label spacer */}
          {["", "L", "", "M", "", "V", ""].map((d, i) => (
            <div key={i} className="h-3 text-[10px] text-muted-foreground flex items-center w-3">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => {
          // Determine if first week of month for label
          const firstDay = week[0];
          const date = firstDay ? new Date(firstDay.date) : null;
          const showMonth = date && date.getDate() <= 7;
          const monthLabel = showMonth ? months[date.getMonth()] : "";

          return (
            <div key={wi} className="flex flex-col gap-1">
              <div className="h-3 text-[10px] text-muted-foreground">{monthLabel}</div>
              {week.map((day, di) => (
                <div
                  key={di}
                  title={`${day.date}: ${day.count} item${day.count !== 1 ? "s" : ""}`}
                  className={cn(
                    "h-3 w-3 rounded-sm cursor-default transition-colors",
                    getIntensityClass(day.count)
                  )}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-xs text-muted-foreground">Moins</span>
        {[0, 1, 2, 4, 6].map((v) => (
          <div key={v} className={cn("h-3 w-3 rounded-sm", getIntensityClass(v))} />
        ))}
        <span className="text-xs text-muted-foreground">Plus</span>
      </div>
    </div>
  );
}
