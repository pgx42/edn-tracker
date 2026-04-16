import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Loader2, Trash2, CheckCircle2, ClipboardList, BarChart3, AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnnaleCreationModal } from "@/components/AnnaleCreationModal";
import { toast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

interface AnnaleSession {
  id: string;
  title: string;
  year: number;
  specialty_id: string | null;
  total_questions: number;
  score: number | null;
  completed_at: string | null;
  created_at: string | null;
  notes: string | null;
}

interface QuestionWithAnswer {
  question: {
    id: string;
    question_number: number;
    item_id: number | null;
    question_text: string | null;
    correct_answer: string | null;
    points: number;
  };
  answer: {
    id: string;
    user_answer: string | null;
    is_correct: number | null;
    partial_score: number | null;
    notes: string | null;
  } | null;
  item_title: string | null;
}

interface SessionDetail {
  session: AnnaleSession;
  questions: QuestionWithAnswer[];
  specialty_name: string | null;
}

interface AnnaleError {
  id: string;
  title: string;
  description: string | null;
  error_type: string;
  severity: string;
  item_id: number | null;
  created_at: string | null;
  resolved_at: string | null;
}

interface AnnaleStats {
  total_annales: number;
  completed_annales: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
  by_year: { year: number; count: number; avg_score: number }[];
  by_specialty: { specialty_id: string; specialty_name: string; count: number; avg_score: number }[];
}

interface Specialty { id: string; name: string; }

const severityColors: Record<string, string> = {
  minor: "bg-blue-500/20 text-blue-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  critical: "bg-red-500/20 text-red-400",
};

export function Annales() {
  const [sessions, setSessions] = useState<AnnaleSession[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [errors, setErrors] = useState<AnnaleError[]>([]);
  const [stats, setStats] = useState<AnnaleStats | null>(null);
  const [filterYear, setFilterYear] = useState("all");
  const [filterSpec, setFilterSpec] = useState("all");

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, sp] = await Promise.all([
        invoke<AnnaleSession[]>("list_annale_sessions", {
          year: filterYear === "all" ? null : parseInt(filterYear),
          specialtyId: filterSpec === "all" ? null : filterSpec,
        }),
        invoke<Specialty[]>("get_specialties"),
      ]);
      setSessions(s);
      setSpecialties(sp);
    } catch { /**/ } finally {
      setIsLoading(false);
    }
  }, [filterYear, filterSpec]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load detail when selected
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    invoke<SessionDetail>("get_annale_session_detail", { id: selectedId })
      .then(setDetail).catch(() => setDetail(null));
    invoke<AnnaleError[]>("get_annale_errors", { annaleSessionId: selectedId, specialtyId: null })
      .then(setErrors).catch(() => setErrors([]));
  }, [selectedId]);

  const loadStats = useCallback(async () => {
    try {
      const s = await invoke<AnnaleStats>("get_annale_stats");
      setStats(s);
    } catch { /**/ }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette session d'annale ?")) return;
    try {
      await invoke("delete_annale_session", { id });
      if (selectedId === id) setSelectedId(null);
      await loadSessions();
      toast({ title: "Session supprimée" });
    } catch (e) {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    }
  };

  const handleAnswer = async (questionId: string, isCorrect: boolean) => {
    try {
      await invoke("submit_annale_answer", {
        questionId,
        userAnswer: null,
        isCorrect,
        partialScore: null,
        notes: null,
      });
      // Refresh detail
      if (selectedId) {
        const d = await invoke<SessionDetail>("get_annale_session_detail", { id: selectedId });
        setDetail(d);
      }
    } catch (e) {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    }
  };

  const handleCalculateScore = async () => {
    if (!selectedId) return;
    try {
      const score = await invoke<number>("calculate_annale_score", { sessionId: selectedId });
      toast({ title: "Score calculé", description: `${score.toFixed(1)}%` });
      await loadSessions();
      const d = await invoke<SessionDetail>("get_annale_session_detail", { id: selectedId });
      setDetail(d);
    } catch (e) {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    }
  };

  const handleCreateError = async (questionNumber: number, itemId: number | null) => {
    if (!selectedId) return;
    const title = prompt("Titre de l'erreur :");
    if (!title) return;
    try {
      await invoke("create_annale_error", {
        annaleSessionId: selectedId,
        title,
        description: `Question ${questionNumber}`,
        errorType: "knowledge_gap",
        severity: "medium",
        itemId: itemId,
      });
      toast({ title: "Erreur créée" });
      const e = await invoke<AnnaleError[]>("get_annale_errors", { annaleSessionId: selectedId, specialtyId: null });
      setErrors(e);
    } catch (e) {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    }
  };

  const specMap = Object.fromEntries(specialties.map((s) => [s.id, s.name]));
  const years = [...new Set(sessions.map((s) => s.year))].sort((a, b) => b - a);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b bg-card/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Annales</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {sessions.length} session{sessions.length !== 1 ? "s" : ""} d'annales
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nouvelle annale
          </Button>
        </div>
        <div className="flex gap-3">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les années</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSpec} onValueChange={setFilterSpec}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Spécialité" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes spécialités</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="list" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="list" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Sessions</TabsTrigger>
              <TabsTrigger value="correction" className="gap-1.5" disabled={!selectedId}><CheckCircle2 className="h-3.5 w-3.5" />Correction</TabsTrigger>
              <TabsTrigger value="errors" className="gap-1.5" onClick={() => selectedId && invoke<AnnaleError[]>("get_annale_errors", { annaleSessionId: selectedId, specialtyId: null }).then(setErrors)}><AlertCircle className="h-3.5 w-3.5" />Erreurs</TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5" onClick={loadStats}><BarChart3 className="h-3.5 w-3.5" />Stats</TabsTrigger>
            </TabsList>
          </div>

          {/* Sessions list */}
          <TabsContent value="list" className="flex-1 overflow-auto px-6 pb-6">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <BookOpen className="h-10 w-10 opacity-30" />
                <p className="text-sm">Aucune annale pour le moment</p>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>Créer une session</Button>
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors",
                      selectedId === s.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{s.year}</Badge>
                        {s.specialty_id && specMap[s.specialty_id] && (
                          <Badge variant="secondary" className="text-xs">{specMap[s.specialty_id]}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{s.total_questions} questions</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {s.score != null ? (
                        <Badge className={cn(
                          "text-sm font-bold border",
                          s.score >= 70 ? "bg-green-500/20 text-green-400 border-green-500/30" :
                          s.score >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                          "bg-red-500/20 text-red-400 border-red-500/30"
                        )}>
                          {s.score.toFixed(1)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Non corrigée</Badge>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-1 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Correction */}
          <TabsContent value="correction" className="flex-1 overflow-auto px-6 pb-6">
            {!detail ? (
              <p className="text-sm text-muted-foreground mt-4">Sélectionnez une annale dans l'onglet Sessions.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm">{detail.session.title} — Correction</h2>
                  <Button size="sm" onClick={handleCalculateScore} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Calculer le score
                  </Button>
                </div>
                {detail.session.score != null && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <span className="text-sm font-medium">Score : </span>
                    <span className={cn(
                      "text-lg font-bold",
                      detail.session.score >= 70 ? "text-green-400" :
                      detail.session.score >= 50 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {detail.session.score.toFixed(1)}%
                    </span>
                  </div>
                )}
                {detail.questions.map((q) => {
                  const answered = q.answer != null;
                  const correct = q.answer?.is_correct === 1;
                  return (
                    <div
                      key={q.question.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        answered ? (correct ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5") : "border-border"
                      )}
                    >
                      <span className="text-sm font-mono text-muted-foreground w-8 shrink-0">
                        Q{q.question.question_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        {q.item_title && (
                          <p className="text-xs text-muted-foreground truncate">{q.item_title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant={answered && correct ? "default" : "outline"}
                          className="h-7 text-xs gap-1"
                          onClick={() => handleAnswer(q.question.id, true)}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Juste
                        </Button>
                        <Button
                          size="sm"
                          variant={answered && !correct ? "destructive" : "outline"}
                          className="h-7 text-xs gap-1"
                          onClick={() => handleAnswer(q.question.id, false)}
                        >
                          <AlertCircle className="h-3 w-3" />
                          Faux
                        </Button>
                        {answered && !correct && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleCreateError(q.question.question_number, q.question.item_id ? Number(q.question.item_id) : null)}
                          >
                            + Erreur
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Errors */}
          <TabsContent value="errors" className="flex-1 overflow-auto px-6 pb-6">
            {!selectedId ? (
              <p className="text-sm text-muted-foreground mt-4">Sélectionnez une annale.</p>
            ) : errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2 mt-4">
                <AlertCircle className="h-8 w-8 opacity-30" />
                <p className="text-sm">Aucune erreur pour cette annale</p>
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                <h2 className="font-semibold text-sm mb-3">
                  Carnet d'erreurs — {errors.length} erreur{errors.length > 1 ? "s" : ""}
                </h2>
                {errors.map((err) => (
                  <div key={err.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <AlertCircle className={cn(
                      "h-4 w-4 shrink-0",
                      err.severity === "critical" ? "text-red-400" :
                      err.severity === "medium" ? "text-yellow-400" : "text-blue-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{err.title}</p>
                      {err.description && <p className="text-xs text-muted-foreground">{err.description}</p>}
                    </div>
                    <Badge className={cn("text-xs border-0", severityColors[err.severity])}>
                      {err.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="flex-1 overflow-auto px-6 pb-6">
            {!stats ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : stats.total_annales === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2 mt-4">
                <BarChart3 className="h-8 w-8 opacity-30" />
                <p className="text-sm">Pas encore de statistiques</p>
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold">{stats.total_annales}</p>
                    <p className="text-xs text-muted-foreground">Annales</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold">{stats.avg_score.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Score moyen</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{stats.best_score.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Meilleur score</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">{stats.worst_score.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Pire score</p>
                  </div>
                </div>

                {stats.by_year.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">Par année</h3>
                    <div className="space-y-2">
                      {stats.by_year.map((y) => (
                        <div key={y.year} className="flex items-center justify-between">
                          <span className="text-sm">{y.year}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{y.count} annales</span>
                            <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${y.avg_score}%` }} />
                            </div>
                            <span className="text-sm font-mono w-16 text-right">{y.avg_score.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats.by_specialty.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">Par spécialité</h3>
                    <div className="space-y-2">
                      {stats.by_specialty.map((s) => (
                        <div key={s.specialty_id} className="flex items-center justify-between">
                          <span className="text-sm">{s.specialty_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{s.count} annales</span>
                            <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${s.avg_score}%` }} />
                            </div>
                            <span className="text-sm font-mono w-16 text-right">{s.avg_score.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AnnaleCreationModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadSessions} />
    </div>
  );
}
