import * as React from "react";
import { Plus, Target, Clock, CheckCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { GoalCreationModal } from "@/components/GoalCreationModal";
import { SessionCreationModal } from "@/components/SessionCreationModal";
import { DayView } from "@/components/DayView";
import type { StudyGoal, StudySession, CreateSessionInput } from "@/lib/types";
import { getSpecialty } from "@/lib/specialties";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function sessionDurationMinutes(s: StudySession): number {
  return Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000);
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mapSession(raw: Record<string, unknown>): StudySession {
  return {
    id: raw.id as string,
    title: (raw.title as string | null) ?? "Session",
    startTime: raw.start_time as string,
    endTime: (raw.end_time as string | null) ?? (raw.start_time as string),
    itemId: (raw.item_id as number | null) ?? null,
    specialtyId: (raw.specialty_id as string | null) ?? null,
    itemIds: raw.item_ids ? JSON.parse(raw.item_ids as string) : [],
    notes: (raw.note as string | null) ?? null,
    completed: Boolean(raw.completed),
    calendarEventId: (raw.calendar_event_id as string | null) ?? null,
  };
}

// ── MiniCalendar ──────────────────────────────────────────────────────────────

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface MiniCalendarProps {
  sessions: StudySession[];
  selectedDay: Date | null;
  currentMonth: Date;
  onDayClick: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function MiniCalendar({
  sessions, selectedDay, currentMonth, onDayClick, onPrevMonth, onNextMonth,
}: MiniCalendarProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const now = new Date();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Collect days that have sessions + their specialties
  const daySpecialties: Record<number, string[]> = {};
  const completedDays = new Set<number>();
  for (const s of sessions) {
    const d = new Date(s.startTime);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    if (!daySpecialties[day]) daySpecialties[day] = [];
    if (s.specialtyId && !daySpecialties[day].includes(s.specialtyId)) {
      daySpecialties[day].push(s.specialtyId);
    }
    if (s.completed) completedDays.add(day);
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevMonth} className="p-1 rounded hover:bg-accent transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-semibold text-sm">{MONTH_NAMES_FR[month]} {year}</h3>
        <button onClick={onNextMonth} className="p-1 rounded hover:bg-accent transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-8 w-8" />;
          const today = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
          const isSelected = selectedDay?.getFullYear() === year && selectedDay.getMonth() === month && selectedDay.getDate() === day;
          const specs = daySpecialties[day] ?? [];
          const hasSession = specs.length > 0;
          const isCompleted = completedDays.has(day);

          return (
            <button
              key={i}
              onClick={() => onDayClick(new Date(year, month, day))}
              className={cn(
                "h-8 w-8 mx-auto flex flex-col items-center justify-center rounded-full text-xs transition-colors cursor-pointer relative",
                today && "bg-primary text-primary-foreground font-bold",
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                !today && isSelected && "bg-primary/20 text-primary font-semibold",
                !today && !isSelected && !hasSession && "text-foreground hover:bg-accent",
                !today && !isSelected && hasSession && isCompleted && "bg-green-500/10 text-green-400",
                !today && !isSelected && hasSession && !isCompleted && "text-foreground"
              )}
            >
              {day}
              {/* Specialty dots below the number */}
              {hasSession && specs.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 absolute bottom-0.5">
                  {specs.slice(0, 3).map((spId) => {
                    const sp = getSpecialty(spId);
                    return (
                      <span
                        key={spId}
                        className="h-1 w-1 rounded-full"
                        style={{ backgroundColor: sp.color }}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500/60 inline-block" />
          Complétée
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1 w-4 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-orange-500 inline-block" />
          Spécialités
        </span>
      </div>
    </div>
  );
}

// ── Planning page ─────────────────────────────────────────────────────────────

export function Planning() {
  const [goals, setGoals] = React.useState<StudyGoal[]>([]);
  const [sessions, setSessions] = React.useState<StudySession[]>([]);
  const [appleEvents, setAppleEvents] = React.useState<Array<{
    id: string; title: string; start_time: string; end_time: string; calendar_title: string;
  }>>([]);

  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());
  const [showGoalModal, setShowGoalModal] = React.useState(false);
  const [showSessionModal, setShowSessionModal] = React.useState(false);
  const [sessionDefaultHour, setSessionDefaultHour] = React.useState(8);
  const [syncStatus, setSyncStatus] = React.useState<"idle" | "syncing" | "done" | "error">("idle");
  const [calendarAuth, setCalendarAuth] = React.useState<string>("not_determined");

  React.useEffect(() => {
    loadSessions();
    checkCalendarAuth();
  }, []);

  React.useEffect(() => {
    if (!selectedDay) return;
    const dayStart = isoDate(selectedDay) + "T00:00:00";
    const dayEnd = isoDate(selectedDay) + "T23:59:59";
    invoke<Array<Record<string, unknown>>>("import_apple_calendar_events", {
      dateFrom: dayStart, dateTo: dayEnd,
    })
      .then((evs) =>
        setAppleEvents(evs.map((e) => ({
          id: e.id as string,
          title: e.title as string,
          start_time: e.start_time as string,
          end_time: e.end_time as string,
          calendar_title: e.calendar_title as string,
        })))
      )
      .catch(() => setAppleEvents([]));
  }, [selectedDay]);

  async function loadSessions() {
    try {
      const raw = await invoke<Array<Record<string, unknown>>>("get_sessions");
      setSessions(raw.map(mapSession));
    } catch { /* ignore */ }
  }

  async function checkCalendarAuth() {
    try {
      const status = await invoke<string>("get_calendar_auth_status");
      setCalendarAuth(status);
    } catch { /* ignore */ }
  }

  // ── Session CRUD ──────────────────────────────────────────────────────────

  const handleCreateSession = async (input: CreateSessionInput) => {
    const raw = await invoke<Record<string, unknown>>("create_session", {
      input: {
        title: input.title,
        start_time: input.startTime,
        end_time: input.endTime,
        item_id: input.itemId ?? null,
        specialty_id: input.specialtyId ?? null,
        item_ids: input.itemIds ?? [],
        notes: input.notes ?? null,
      },
    });
    const newSession = mapSession(raw);
    setSessions((prev) => [...prev, newSession]);

    // Auto-export to Apple Calendar if authorized
    if (calendarAuth === "authorized") {
      try {
        const sp = getSpecialty(newSession.specialtyId);
        const eventId = await invoke<string>("export_session_to_apple_calendar", {
          title: newSession.title,
          startTime: newSession.startTime,
          endTime: newSession.endTime,
          notes: newSession.notes,
          specialtyName: sp.id !== "other" ? sp.name : null,
        });
        await invoke("update_session_calendar_id", { id: newSession.id, calendarEventId: eventId });
        setSessions((prev) =>
          prev.map((s) => (s.id === newSession.id ? { ...s, calendarEventId: eventId } : s))
        );
      } catch { /* Non-blocking */ }
    }
  };

  const handleDeleteSession = async (id: string) => {
    const session = sessions.find((s) => s.id === id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    invoke("delete_session", { id }).catch(() => {});
    if (session?.calendarEventId) {
      invoke("delete_apple_calendar_event", { eventId: session.calendarEventId }).catch(() => {});
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, completed } : s)));
    invoke("update_session", { id, completed }).catch(() => {});
  };

  /** Drag & drop reschedule */
  const handleMoveSession = async (id: string, newStartTime: string, newEndTime: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, startTime: newStartTime, endTime: newEndTime } : s))
    );
    invoke("update_session_time", { id, startTime: newStartTime, endTime: newEndTime }).catch(() => {});

    // Update Apple Calendar event if linked
    const session = sessions.find((s) => s.id === id);
    if (session?.calendarEventId && calendarAuth === "authorized") {
      // Delete old + recreate (EventKit update is complex via raw bindings)
      invoke("delete_apple_calendar_event", { eventId: session.calendarEventId }).catch(() => {});
      try {
        const sp = getSpecialty(session.specialtyId);
        const eventId = await invoke<string>("export_session_to_apple_calendar", {
          title: session.title,
          startTime: newStartTime,
          endTime: newEndTime,
          notes: session.notes,
          specialtyName: sp.id !== "other" ? sp.name : null,
        });
        await invoke("update_session_calendar_id", { id, calendarEventId: eventId });
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, calendarEventId: eventId } : s))
        );
      } catch { /* ignore */ }
    }
  };

  const handleCreateGoal = (goal: Omit<StudyGoal, "id" | "completedItemIds">) => {
    setGoals((prev) => [...prev, { ...goal, id: prev.length + 1, completedItemIds: [] }]);
  };

  const handleAddSession = (hour: number) => {
    setSessionDefaultHour(hour);
    setShowSessionModal(true);
  };

  const handleSync = async () => {
    setSyncStatus("syncing");
    try {
      const authStatus = await invoke<string>("get_calendar_auth_status");
      setCalendarAuth(authStatus);

      if (authStatus === "not_determined" || authStatus === "denied") {
        await invoke("request_calendar_permission");
        setSyncStatus("idle");
        return;
      }

      const unsynced = sessions.filter((s) => !s.calendarEventId);
      for (const session of unsynced) {
        try {
          const sp = getSpecialty(session.specialtyId);
          const eventId = await invoke<string>("export_session_to_apple_calendar", {
            title: session.title,
            startTime: session.startTime,
            endTime: session.endTime,
            notes: session.notes,
            specialtyName: sp.id !== "other" ? sp.name : null,
          });
          await invoke("update_session_calendar_id", { id: session.id, calendarEventId: eventId });
          setSessions((prev) =>
            prev.map((s) => (s.id === session.id ? { ...s, calendarEventId: eventId } : s))
          );
        } catch { /* ignore individual */ }
      }
      setSyncStatus("done");

      // Refresh Apple events for selected day
      if (selectedDay) {
        const dayStart = isoDate(selectedDay) + "T00:00:00";
        const dayEnd = isoDate(selectedDay) + "T23:59:59";
        const evs = await invoke<Array<Record<string, unknown>>>("import_apple_calendar_events", {
          dateFrom: dayStart, dateTo: dayEnd,
        });
        setAppleEvents(evs.map((e) => ({
          id: e.id as string,
          title: e.title as string,
          start_time: e.start_time as string,
          end_time: e.end_time as string,
          calendar_title: e.calendar_title as string,
        })));
      }
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  };

  const upcomingSessions = sessions
    .filter((s) => !s.completed)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 7);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sessions par spécialité · synchronisé avec Apple Calendrier
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleSync}
            disabled={syncStatus === "syncing"}
          >
            <RefreshCw className={cn("h-4 w-4", syncStatus === "syncing" && "animate-spin")} />
            {syncStatus === "syncing" ? "Sync..." :
             syncStatus === "done" ? "Synchronisé ✓" :
             syncStatus === "error" ? "Erreur" : "Sync iCloud"}
          </Button>
          <Button onClick={() => setShowGoalModal(true)} variant="outline" className="gap-1.5">
            <Target className="h-4 w-4" />
            Objectif
          </Button>
          <Button className="gap-1.5" onClick={() => handleAddSession(9)}>
            <Plus className="h-4 w-4" />
            Session
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className={cn(
        "grid gap-6",
        selectedDay ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1 lg:grid-cols-3"
      )}>
        {/* Calendar */}
        <div className={cn(
          "rounded-lg border bg-card p-5",
          selectedDay ? "lg:col-span-2" : "lg:col-span-1"
        )}>
          <MiniCalendar
            sessions={sessions}
            selectedDay={selectedDay}
            currentMonth={currentMonth}
            onDayClick={(day) =>
              setSelectedDay(selectedDay?.toDateString() === day.toDateString() ? null : day)
            }
            onPrevMonth={() =>
              setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
            }
          />
        </div>

        {/* Day view */}
        {selectedDay ? (
          <div
            className="lg:col-span-3 rounded-lg border bg-card overflow-hidden"
            style={{ minHeight: 520, maxHeight: 700 }}
          >
            <DayView
              date={selectedDay}
              sessions={sessions}
              appleEvents={appleEvents}
              onAddSession={handleAddSession}
              onDeleteSession={handleDeleteSession}
              onToggleComplete={handleToggleComplete}
              onMoveSession={handleMoveSession}
            />
          </div>
        ) : (
          <>
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
                    const daysUntil = getDaysUntil(session.startTime.slice(0, 10));
                    const sp = getSpecialty(session.specialtyId);
                    return (
                      <div key={session.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-md flex flex-col items-center justify-center text-xs"
                          style={{
                            backgroundColor: sp.color + "22",
                            color: sp.color,
                          }}
                        >
                          <span className="font-bold text-base leading-none">
                            {new Date(session.startTime).getDate()}
                          </span>
                          <span>
                            {new Date(session.startTime).toLocaleString("fr", { month: "short" })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: sp.color }}
                            />
                            <p className="text-sm font-medium truncate">{session.title}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(sessionDurationMinutes(session))}
                            </span>
                            {daysUntil <= 2 && (
                              <Badge className="text-[10px] h-4 px-1 bg-red-500/20 text-red-400 border-red-500/30">
                                Urgent
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats */}
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
                    {formatDuration(sessions.filter((s) => s.completed).reduce((a, s) => a + sessionDurationMinutes(s), 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sessions planifiées</span>
                  <span className="font-semibold">{sessions.filter((s) => !s.completed).length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Objectifs actifs</span>
                  <span className="font-semibold">{goals.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">iCloud Calendrier</span>
                  <Badge variant={calendarAuth === "authorized" ? "secondary" : "outline"} className="text-xs">
                    {calendarAuth === "authorized" ? "Activé" : "Non autorisé"}
                  </Badge>
                </div>
              </div>
            </div>
          </>
        )}
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
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun objectif défini.</p>
        ) : (
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
                    <Target className={cn("h-4 w-4 shrink-0", isOverdue ? "text-red-400" : isUrgent ? "text-yellow-400" : "text-primary")} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{goal.completedItemIds.length}/{goal.itemIds.length} items</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{goal.targetDate}</span>
                    <Badge className={cn("text-xs border", isOverdue ? "bg-red-500/20 text-red-400 border-red-500/30" : isUrgent ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-primary/20 text-primary border-primary/30")}>
                      {isOverdue ? `${Math.abs(daysLeft)}j dépassé` : daysLeft === 0 ? "Aujourd'hui" : `${daysLeft}j restants`}
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
        )}
      </div>

      <GoalCreationModal open={showGoalModal} onClose={() => setShowGoalModal(false)} onCreate={handleCreateGoal} />
      <SessionCreationModal
        open={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        onCreate={handleCreateSession}
        defaultDate={selectedDay ? isoDate(selectedDay) : undefined}
        defaultStartHour={sessionDefaultHour}
      />
    </div>
  );
}
