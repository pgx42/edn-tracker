import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, Check, BookOpen, Brain, FileText, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSpecialty } from "@/lib/specialties";
import type { StudySession } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  calendar_title: string;
}

interface ItemPlanningInfo {
  item_id: number;
  code: string;
  title: string;
  specialty_id: string;
  rank: string;
  description: string | null;
  linked_pdf_count: number;
  linked_pdfs: Array<{ id: string; title: string; doc_type: string | null; num_pages: number }>;
  anki_note_count: number;
  anki_notes: Array<{ id: string; question: string; deck_name: string | null }>;
  error_count: number;
}

interface Props {
  date: Date;
  sessions: StudySession[];
  appleEvents?: AppleEvent[];
  onAddSession: (hour: number) => void;
  onDeleteSession: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onMoveSession: (id: string, newStartTime: string, newEndTime: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT_PX = 64;
const SNAP_MINUTES = 15;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, "0"); }

function isoToDate(iso: string): Date { return new Date(iso); }

function timeToMinutes(iso: string): number {
  const d = isoToDate(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToOffset(totalMin: number): number {
  return Math.max(0, ((totalMin - START_HOUR * 60) / 60) * HOUR_HEIGHT_PX);
}


function minutesToHeight(durationMin: number): number {
  return Math.max(28, (durationMin / 60) * HOUR_HEIGHT_PX);
}

function formatTime(iso: string): string {
  const d = isoToDate(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDuration(startIso: string, endIso: string): string {
  const diff = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

function applyMinutesToIso(originalIso: string, newTotalMinutes: number): string {
  const d = new Date(originalIso);
  const h = Math.floor(newTotalMinutes / 60);
  const m = newTotalMinutes % 60;
  d.setHours(h, m, 0, 0);
  return d.toISOString().replace("Z", "").slice(0, 19);
}

function isSameDay(date: Date, iso: string): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

// ── Session Detail Panel ──────────────────────────────────────────────────────

function SessionDetailPanel({
  session,
  onClose,
}: {
  session: StudySession;
  onClose: () => void;
}) {
  const [info, setInfo] = React.useState<ItemPlanningInfo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const sp = getSpecialty(session.specialtyId);

  React.useEffect(() => {
    if (!session.itemId) return;
    setLoading(true);
    invoke<ItemPlanningInfo>("get_item_planning_info", { itemId: session.itemId })
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [session.itemId]);

  const RANK_COLORS: Record<string, string> = {
    A: "bg-red-500/20 text-red-400 border-red-500/30",
    B: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    C: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  return (
    <div className="w-72 flex-shrink-0 border-l flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className={cn("px-3 py-2.5 border-b flex items-center justify-between", sp.blockClass)}>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{session.title}</p>
          <p className="text-[10px] opacity-70">
            {formatTime(session.startTime)} – {formatTime(session.endTime)}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 flex-shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Specialty badge */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: sp.color }} />
          <span className="text-xs text-muted-foreground">{sp.name}</span>
        </div>

        {/* Item info */}
        {session.itemId ? (
          loading ? (
            <p className="text-xs text-muted-foreground">Chargement...</p>
          ) : info ? (
            <div className="space-y-3">
              {/* Item header */}
              <div className="rounded-lg border p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-muted-foreground">{info.code}</span>
                  <Badge className={cn("text-[10px] h-4 px-1 border", RANK_COLORS[info.rank])}>
                    {info.rank}
                  </Badge>
                </div>
                <p className="text-xs font-medium leading-snug">{info.title}</p>
                {info.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-3">{info.description}</p>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border p-2 text-center">
                  <FileText className="h-3.5 w-3.5 mx-auto mb-0.5 text-blue-400" />
                  <p className="text-base font-bold">{info.linked_pdf_count}</p>
                  <p className="text-[10px] text-muted-foreground">PDF</p>
                </div>
                <div className="rounded-md border p-2 text-center">
                  <Brain className="h-3.5 w-3.5 mx-auto mb-0.5 text-violet-400" />
                  <p className="text-base font-bold">{info.anki_note_count}</p>
                  <p className="text-[10px] text-muted-foreground">Anki</p>
                </div>
                <div className="rounded-md border p-2 text-center">
                  <AlertTriangle className="h-3.5 w-3.5 mx-auto mb-0.5 text-red-400" />
                  <p className="text-base font-bold">{info.error_count}</p>
                  <p className="text-[10px] text-muted-foreground">Erreurs</p>
                </div>
              </div>

              {/* Linked PDFs */}
              {info.linked_pdfs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <FileText className="h-3 w-3" /> PDFs disponibles
                  </p>
                  {info.linked_pdfs.map((pdf) => (
                    <div key={pdf.id} className="flex items-center gap-2 text-xs rounded-md border p-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1">{pdf.title}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{pdf.num_pages}p</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Anki notes */}
              {info.anki_notes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Brain className="h-3 w-3" /> Cartes Anki
                  </p>
                  {info.anki_notes.map((note) => (
                    <div key={note.id} className="text-xs rounded-md border p-2 space-y-0.5">
                      <p className="line-clamp-2 text-foreground/80">{note.question}</p>
                      {note.deck_name && (
                        <p className="text-[10px] text-muted-foreground">{note.deck_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Infos item indisponibles</p>
          )
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Aucun item EDN lié à cette session.
            </p>
          </div>
        )}

        {/* Session notes */}
        {session.notes && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{session.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DayView component ─────────────────────────────────────────────────────────

export function DayView({
  date,
  sessions,
  appleEvents = [],
  onAddSession,
  onDeleteSession,
  onToggleComplete,
  onMoveSession,
}: Props) {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const dayFrNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const monthFrNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];

  const daySessions = sessions.filter((s) => isSameDay(date, s.startTime));
  const dayAppleEvents = appleEvents.filter((e) => isSameDay(date, e.start_time));

  // ── Drag state ──────────────────────────────────────────────────────────────
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState<{
    id: string;
    initialMouseY: number;
    initialStartMin: number;
    durationMin: number;
    currentStartMin: number;
  } | null>(null);

  const handleSessionMouseDown = (e: React.MouseEvent, session: StudySession) => {
    e.preventDefault();
    e.stopPropagation();
    const startMin = timeToMinutes(session.startTime);
    const endMin = timeToMinutes(session.endTime);
    setDragging({
      id: session.id,
      initialMouseY: e.clientY,
      initialStartMin: startMin,
      durationMin: endMin - startMin,
      currentStartMin: startMin,
    });
  };

  React.useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const deltaY = e.clientY - dragging.initialMouseY;
      const deltaMinutes = (deltaY / HOUR_HEIGHT_PX) * 60;
      const newStartMin = dragging.initialStartMin + deltaMinutes;
      const snapped = Math.round(newStartMin / SNAP_MINUTES) * SNAP_MINUTES;
      const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - dragging.durationMin, snapped));
      void rect; // suppress unused
      setDragging((prev) => prev ? { ...prev, currentStartMin: clamped } : null);
    };

    const handleMouseUp = () => {
      if (!dragging) return;
      const session = sessions.find((s) => s.id === dragging.id);
      if (session) {
        const newStart = applyMinutesToIso(session.startTime, dragging.currentStartMin);
        const newEnd = applyMinutesToIso(session.endTime, dragging.currentStartMin + dragging.durationMin);
        onMoveSession(dragging.id, newStart, newEnd);
      }
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, sessions, onMoveSession]);

  // ── Selected session (detail panel) ──────────────────────────────────────────
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const selectedSession = daySessions.find((s) => s.id === selectedSessionId) ?? null;

  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT_PX;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <div>
          <p className="text-xs text-muted-foreground">{dayFrNames[date.getDay()]}</p>
          <h3 className="font-semibold text-base">
            {date.getDate()} {monthFrNames[date.getMonth()]} {date.getFullYear()}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {daySessions.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {daySessions.filter((s) => s.completed).length}/{daySessions.length} terminées
            </span>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => onAddSession(9)}>
            <Plus className="h-3.5 w-3.5" />
            Session
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timeline */}
        <div className="flex-1 overflow-y-auto" style={{ userSelect: dragging ? "none" : "auto" }}>
          <div className="flex">
            {/* Hour labels */}
            <div className="w-14 flex-shrink-0">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR).map((hour) => (
                <div
                  key={hour}
                  style={{ height: HOUR_HEIGHT_PX }}
                  className="flex items-start justify-end pr-2 pt-1"
                >
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {pad2(hour)}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Event grid */}
            <div
              ref={gridRef}
              className="flex-1 relative border-l"
              style={{ height: totalHeight }}
            >
              {/* Hour lines */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-border/40"
                  style={{ top: i * HOUR_HEIGHT_PX }}
                />
              ))}
              {/* Half-hour dashed */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={`h-${i}`}
                  className="absolute left-0 right-0 border-t border-border/20 border-dashed"
                  style={{ top: i * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
                />
              ))}

              {/* Clickable hour slots */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR).map((hour) => (
                <button
                  key={`slot-${hour}`}
                  className="absolute left-0 right-0 hover:bg-primary/5 transition-colors"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                  onClick={() => !dragging && onAddSession(hour)}
                  aria-label={`Ajouter à ${pad2(hour)}:00`}
                />
              ))}

              {/* Current time indicator */}
              {isToday && currentMinutes >= START_HOUR * 60 && currentMinutes < END_HOUR * 60 && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: minutesToOffset(currentMinutes) }}
                >
                  <div className="relative">
                    <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
                    <div className="h-px bg-red-500 w-full" />
                  </div>
                </div>
              )}

              {/* Apple Calendar events */}
              {dayAppleEvents.map((ev) => {
                const startMin = timeToMinutes(ev.start_time);
                const endMin = timeToMinutes(ev.end_time);
                const top = minutesToOffset(startMin);
                const height = minutesToHeight(endMin - startMin);
                return (
                  <div
                    key={ev.id}
                    className="absolute left-1 right-1 z-10 rounded border bg-muted/15 border-muted/30 px-2 py-1 overflow-hidden pointer-events-none"
                    style={{ top, height }}
                  >
                    <p className="text-[11px] font-medium text-muted-foreground truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground/50">{ev.calendar_title}</p>
                  </div>
                );
              })}

              {/* EDN Sessions */}
              {daySessions.map((session) => {
                const isDragging = dragging?.id === session.id;
                const startMin = isDragging ? dragging.currentStartMin : timeToMinutes(session.startTime);
                const endMin = isDragging
                  ? dragging.currentStartMin + dragging.durationMin
                  : timeToMinutes(session.endTime);
                const top = minutesToOffset(startMin);
                const height = minutesToHeight(endMin - startMin);
                const sp = getSpecialty(session.specialtyId);
                const isSelected = selectedSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    className={cn(
                      "absolute left-1 right-1 z-20 rounded border px-2 py-1 overflow-hidden group transition-shadow",
                      sp.blockClass,
                      session.completed && "opacity-50",
                      isDragging && "shadow-xl ring-2 ring-white/20 z-30 cursor-grabbing",
                      !isDragging && "cursor-grab",
                      isSelected && "ring-2 ring-white/40"
                    )}
                    style={{ top, height }}
                    onMouseDown={(e) => handleSessionMouseDown(e, session)}
                    onClick={(e) => {
                      if (dragging) return;
                      e.stopPropagation();
                      setSelectedSessionId(isSelected ? null : session.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-1 pointer-events-none">
                      <div className="min-w-0 flex-1">
                        {session.specialtyId && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full mr-1 mb-0.5 flex-shrink-0"
                            style={{ backgroundColor: sp.color }}
                          />
                        )}
                        <span className="text-xs font-semibold">{session.title}</span>
                        {height >= 42 && (
                          <p className="text-[10px] opacity-70 mt-0.5">
                            {pad2(Math.floor(startMin / 60))}:{pad2(startMin % 60)} –{" "}
                            {pad2(Math.floor(endMin / 60))}:{pad2(endMin % 60)}{" "}
                            ({formatDuration(session.startTime, session.endTime)})
                          </p>
                        )}
                        {session.itemId && height >= 52 && (
                          <p className="text-[10px] opacity-60">Item #{session.itemId}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                        <button
                          className="p-0.5 rounded hover:bg-white/10"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); onToggleComplete(session.id, !session.completed); }}
                          title={session.completed ? "Non terminé" : "Terminé"}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          className="p-0.5 rounded hover:bg-red-500/20"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); if (selectedSessionId === session.id) setSelectedSessionId(null); onDeleteSession(session.id); }}
                          title="Supprimer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Drag ghost time label */}
              {dragging && (
                <div
                  className="absolute left-1 z-40 pointer-events-none"
                  style={{ top: minutesToOffset(dragging.currentStartMin) - 20 }}
                >
                  <span className="text-xs bg-background border rounded px-1.5 py-0.5 font-mono shadow-sm">
                    {pad2(Math.floor(dragging.currentStartMin / 60))}:{pad2(dragging.currentStartMin % 60)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session detail panel */}
        {selectedSession && (
          <SessionDetailPanel
            session={selectedSession}
            onClose={() => setSelectedSessionId(null)}
          />
        )}
      </div>
    </div>
  );
}
