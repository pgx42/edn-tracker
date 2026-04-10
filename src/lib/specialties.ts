export interface SpecialtyConfig {
  id: string;
  name: string;
  /** Hex color for Apple Calendar and UI accents */
  color: string;
  /** Tailwind background + text classes for session blocks */
  blockClass: string;
  /** Tailwind dot class for the specialty badge */
  dotClass: string;
}

export const SPECIALTY_CONFIG: Record<string, SpecialtyConfig> = {
  cardio: {
    id: "cardio",
    name: "Cardiologie",
    color: "#ef4444",
    blockClass: "bg-red-500/20 border-red-500/50 text-red-300",
    dotClass: "bg-red-500",
  },
  pneumo: {
    id: "pneumo",
    name: "Pneumologie",
    color: "#3b82f6",
    blockClass: "bg-blue-500/20 border-blue-500/50 text-blue-300",
    dotClass: "bg-blue-500",
  },
  gastro: {
    id: "gastro",
    name: "Gastroentérologie",
    color: "#f97316",
    blockClass: "bg-orange-500/20 border-orange-500/50 text-orange-300",
    dotClass: "bg-orange-500",
  },
  neuro: {
    id: "neuro",
    name: "Neurologie",
    color: "#8b5cf6",
    blockClass: "bg-violet-500/20 border-violet-500/50 text-violet-300",
    dotClass: "bg-violet-500",
  },
  nephro: {
    id: "nephro",
    name: "Néphrologie",
    color: "#06b6d4",
    blockClass: "bg-cyan-500/20 border-cyan-500/50 text-cyan-300",
    dotClass: "bg-cyan-500",
  },
  hemato: {
    id: "hemato",
    name: "Hématologie",
    color: "#ec4899",
    blockClass: "bg-pink-500/20 border-pink-500/50 text-pink-300",
    dotClass: "bg-pink-500",
  },
  onco: {
    id: "onco",
    name: "Oncologie",
    color: "#84cc16",
    blockClass: "bg-lime-500/20 border-lime-500/50 text-lime-300",
    dotClass: "bg-lime-500",
  },
  rheum: {
    id: "rheum",
    name: "Rhumatologie",
    color: "#14b8a6",
    blockClass: "bg-teal-500/20 border-teal-500/50 text-teal-300",
    dotClass: "bg-teal-500",
  },
  endo: {
    id: "endo",
    name: "Endocrinologie",
    color: "#f59e0b",
    blockClass: "bg-amber-500/20 border-amber-500/50 text-amber-300",
    dotClass: "bg-amber-500",
  },
  hepato: {
    id: "hepato",
    name: "Hépatologie",
    color: "#eab308",
    blockClass: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",
    dotClass: "bg-yellow-500",
  },
  ortho: {
    id: "ortho",
    name: "Orthopédie",
    color: "#64748b",
    blockClass: "bg-slate-500/20 border-slate-500/50 text-slate-300",
    dotClass: "bg-slate-500",
  },
  ophthalmo: {
    id: "ophthalmo",
    name: "Ophtalmologie",
    color: "#6366f1",
    blockClass: "bg-indigo-500/20 border-indigo-500/50 text-indigo-300",
    dotClass: "bg-indigo-500",
  },
  orl: {
    id: "orl",
    name: "ORL",
    color: "#d946ef",
    blockClass: "bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300",
    dotClass: "bg-fuchsia-500",
  },
};

export const SPECIALTIES_LIST: SpecialtyConfig[] = Object.values(SPECIALTY_CONFIG);

/** Fallback config when specialty is unknown */
export const SPECIALTY_DEFAULT: SpecialtyConfig = {
  id: "other",
  name: "Autre",
  color: "#64748b",
  blockClass: "bg-slate-500/20 border-slate-500/50 text-slate-300",
  dotClass: "bg-slate-500",
};

export function getSpecialty(id: string | null | undefined): SpecialtyConfig {
  if (!id) return SPECIALTY_DEFAULT;
  return SPECIALTY_CONFIG[id] ?? SPECIALTY_DEFAULT;
}
