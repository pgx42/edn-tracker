import { Pencil, CheckCircle2, AlertTriangle, Network, type LucideIcon } from "lucide-react";

export const MOCK_QUEUE = [
  { item: "334", name: "Syndrome coronarien aigu", cards: 12, due: "maintenant", hot: true },
  { item: "232", name: "Diabète sucré T1 / T2", cards: 8, due: "maintenant", hot: true },
  { item: "102", name: "Sclérose en plaques", cards: 14, due: "+1 h" },
  { item: "226", name: "Embolie pulmonaire", cards: 6, due: "+3 h" },
  { item: "328", name: "Insuffisance cardiaque", cards: 2, due: "demain" },
];

export const MOCK_RECENT: Array<{ icon: LucideIcon; txt: string; t: string }> = [
  { icon: Pencil, txt: "Annoté Cardio.pdf — p. 42", t: "12 min" },
  { icon: CheckCircle2, txt: "Session Anki · 28 cartes · 92 %", t: "1 h" },
  { icon: AlertTriangle, txt: "Erreur ajoutée — item 232", t: "3 h" },
  { icon: Network, txt: 'Mindmap "Cycle ovarien" mise à jour', t: "hier" },
];

export const MOCK_ERRORS_BRIEF = [
  { item: "334", txt: "Confondu STEMI postérieur et inférieur", d: "il y a 2 j", spec: "Cardio" },
  { item: "232", txt: "Critères ADA vs OMS", d: "il y a 4 j", spec: "Endo" },
  { item: "226", txt: "Score Wells: cut-off à 4 ou 5 ?", d: "1 sem", spec: "Pneumo" },
];

export const MASTERY_RADAR = [
  { k: "Cardio", v: 0.82 },
  { k: "Pneumo", v: 0.71 },
  { k: "Endo", v: 0.45 },
  { k: "Néphro", v: 0.58 },
  { k: "Neuro", v: 0.66 },
  { k: "Gastro", v: 0.74 },
  { k: "Hémato", v: 0.38 },
  { k: "Gynéco", v: 0.62 },
];

export const MASTERY_TOP = [
  { n: "334", name: "Syndrome coronarien aigu", spec: "Cardio", mastery: 0.96 },
  { n: "232", name: "Diabète sucré", spec: "Endo", mastery: 0.94 },
  { n: "197", name: "Asthme", spec: "Pneumo", mastery: 0.91 },
  { n: "328", name: "Insuffisance cardiaque", spec: "Cardio", mastery: 0.89 },
  { n: "224", name: "HTA essentielle", spec: "Cardio", mastery: 0.87 },
];

export const MASTERY_BOTTOM = [
  { n: "215", name: "Pathologies du cycle menstruel", spec: "Gynéco", mastery: 0.21 },
  { n: "211", name: "Purpuras chez l'enfant", spec: "Hémato", mastery: 0.28 },
  { n: "208", name: "Hyperthyroïdie", spec: "Endo", mastery: 0.32 },
  { n: "263", name: "Protéinurie", spec: "Néphro", mastery: 0.34 },
  { n: "189", name: "Lupus systémique", spec: "Rhumato", mastery: 0.36 },
];
