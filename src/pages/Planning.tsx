import * as React from "react";
import { Plus, Calendar, Target, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { GoalCreationModal } from "@/components/GoalCreationModal";
import { mockGoals, mockSessions } from "@/lib/mockData";
import type { StudyGoal, StudySession } from "@/lib/types";
import { cn } from "@/lib/utils";

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

// Mini calendar for the current month
function MiniCalendar({ sessions }: { sessions: StudySession[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sessionDates = new Set(
    sessions.map((s) => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month ? d.getDate() : null;
    }).filter(Boolean)
  );
  const completedDates = new Set(
    sessions.filter((s) => s.completed).map((s) => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month ? d.getDate() : null;
    }).filter(Boolean)
  );

  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  // Build grid: start on Monday (adjust from Sunday-based)
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{monthNames[month]} {year}</h3>
        <Badge variant="secondary">{sessionDates.size} sessions</Badge>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === now.getDate();
          const hasSession = day !== null && sessionDates.has(day);
          const isCompleted = day !== null && completedDates.has(day);
          return (
            <div
              key={i}
              className={cn(
                "h-8 w-8 mx-auto flex items-center justify-center rounded-full text-xs transition-colors",
                !day && "invisible",
                isToday && "bg-primary text-primary-foreground font-bold",
                !isToday && hasSession && isCompleted && "bg-green-500/20 text-green-400",
                !isToday && hasSession && !isCompleted && "bg-yellow-500/20 text-yellow-400",
                !isToday && !hasSession && "text-foreground hover:bg-accent cursor-default"
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500/60 inline-block" />
          Complétée
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-500/60 inline-block" />
          Planifiée
        </span>
      </div>
    </div>
  );
}

export function Planning() {
  const [goals, setGoals] = React.useState<StudyGoal[]>(mockGoals);
  const [sessions] = React.useState<StudySession[]>(mockSessions);
  const [showGoalModal, setShowGoalModal] = React.useState(false);

  const upcomingSessions = sessions
    .filter((s) => !s.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  const handleCreateGoal = (goal: Omit<StudyGoal, "id" | "completedItemIds">) => {
    setGoals((prev) => [...prev, { ...goal, id: prev.length + 1, completedItemIds: [] }]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Planifiez vos sessions d'étude et suivez vos objectifs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowGoalModal(true)} className="gap-1.5">
            <Target className="h-4 w-4" />
            Objectif
          </Button>
          <Button variant="outline" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Session
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="rounded-lg border bg-card p-5">
          <MiniCalendar sessions={sessions} />
        </div>

        {/* Upcoming sessions */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Prochaines sessions</h2>
            <Badge variant="secondary">{upcomingSessions.length} à venir</Badge>
          </div>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune session planifiée</p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => {
                const daysUntil = getDaysUntil(session.date);
                return (
                  <div key={session.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-md flex flex-col items-center justify-center text-xs",
                      daysUntil <= 2 ? "bg-red-500/20 text-red-400" :
                      daysUntil <= 5 ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-primary/20 text-primary"
                    )}>
                      <span className="font-bold text-base leading-none">
                        {new Date(session.date).getDate()}
                      </span>
                      <span>
                        {new Date(session.date).toLocaleString("fr", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDuration(session.duration)}</span>
                        <span className="text-xs text-muted-foreground">
                          {session.itemIds.length} item{session.itemIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {session.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{session.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats summary */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold text-sm mb-4">Résumé d'activité</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sessions complétées</span>
              <span className="font-semibold">{sessions.filter((s) => s.completed).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Temps total</span>
              <span className="font-semibold">
                {formatDuration(sessions.filter((s) => s.completed).reduce((a, s) => a + s.duration, 0))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Items revus</span>
              <span className="font-semibold">
                {new Set(sessions.filter((s) => s.completed).flatMap((s) => s.itemIds)).size}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Objectifs actifs</span>
              <span className="font-semibold">{goals.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Objectifs d'étude</h2>
          <Button variant="outline" size="sm" onClick={() => setShowGoalModal(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const pct = goal.itemIds.length > 0
              ? Math.round((goal.completedItemIds.length / goal.itemIds.length) * 100)
              : 0;
            const daysLeft = getDaysUntil(goal.targetDate);
            const isOverdue = daysLeft < 0;
            const isUrgent = daysLeft >= 0 && daysLeft <= 7;

            return (
              <div key={goal.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
                    )}
                  </div>
                  <Target className={cn(
                    "h-4 w-4 shrink-0",
                    isOverdue ? "text-red-400" : isUrgent ? "text-yellow-400" : "text-primary"
                  )} />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {goal.completedItemIds.length}/{goal.itemIds.length} items
                    </span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{goal.targetDate}</span>
                  </div>
                  <Badge className={cn(
                    "text-xs border",
                    isOverdue
                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                      : isUrgent
                      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      : "bg-primary/20 text-primary border-primary/30"
                  )}>
                    {isOverdue
                      ? `${Math.abs(daysLeft)}j dépassé`
                      : daysLeft === 0
                      ? "Aujourd'hui"
                      : `${daysLeft}j restants`}
                  </Badge>
                </div>

                {pct === 100 && (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Objectif atteint
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <GoalCreationModal
        open={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onCreate={handleCreateGoal}
      />
    </div>
  );
}
