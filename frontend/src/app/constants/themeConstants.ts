export interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  description?: string;
}

export const COLOR_PALETTES: ColorPalette[] = [
  { name: "Kacha Brand", primary: "#e55400", secondary: "#ffda00", description: "Classic Kacha branding" },
  { name: "Oceanic", primary: "#0369a1", secondary: "#7dd3fc", description: "Corporate blue & sky" },
  { name: "Emerald", primary: "#047857", secondary: "#6ee7b7", description: "Sustainability & growth" },
  { name: "Electric", primary: "#4338ca", secondary: "#c7d2fe", description: "Modern tech vibes" },
  { name: "Amethyst", primary: "#7e22ce", secondary: "#e9d5ff", description: "Creative & luxurious" },
  { name: "Crimson", primary: "#be123c", secondary: "#fecdd3", description: "Bold & energetic" },
  { name: "Midnight", primary: "#0f172a", secondary: "#94a3b8", description: "Deep slate & silver" },
  { name: "Sunset Gold", primary: "#b45309", secondary: "#fde68a", description: "Warm & professional" },
  { name: "Forest", primary: "#166534", secondary: "#dcfce7", description: "Nature & stability" },
  { name: "Indigo Night", primary: "#312e81", secondary: "#a5b4fc", description: "Trusted & deep" },
  { name: "Ruby", primary: "#9f1239", secondary: "#fda4af", description: "Passion & precision" },
  { name: "Steel", primary: "#334155", secondary: "#cbd5e1", description: "Industrial & clean" },
  { name: "Vibrant Cyan", primary: "#0e7490", secondary: "#a5f3fc", description: "Fresh & digital" },
  { name: "Autumn", primary: "#9a3412", secondary: "#ffedd5", description: "Earthy & grounded" },
  { name: "Plum", primary: "#581c87", secondary: "#f3e8ff", description: "Sophisticated & unique" },
  { name: "Teal Green", primary: "#0f766e", secondary: "#ccfbf1", description: "Modern & calming" },
  { name: "Espresso", primary: "#451a03", secondary: "#fef3c7", description: "Rich & established" },
  { name: "Berry", primary: "#701a75", secondary: "#fdf4ff", description: "Playful & creative" },
  { name: "Slate Blue", primary: "#1e40af", secondary: "#dbeafe", description: "Reliable & accessible" },
  { name: "Charcoal Gold", primary: "#1a1a1a", secondary: "#d4af37", description: "Ultimate luxury" },
];

// ── OKR Confidence Level Design Tokens ────────────────────────────────────────

/** The three confidence states for any OKR-related entity. `null` = unknown. */
export type ConfidenceLevel = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | null;

/**
 * Centralized color tokens for OKR confidence levels.
 * Use these instead of hardcoded Tailwind classes to ensure consistency
 * across all plan entities (Quarterly, Monthly, Weekly, Daily).
 *
 *  🟢 ON_TRACK  — emerald (green)
 *  🟡 AT_RISK   — amber  (yellow)
 *  🔴 OFF_TRACK — rose   (red)
 */
export const CONFIDENCE_COLORS = {
  ON_TRACK: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
    ring: "ring-emerald-300",
    label: "On Track",
    emoji: "🟢",
    hex: "#10b981",
  },
  AT_RISK: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
    border: "border-amber-200",
    ring: "ring-amber-300",
    label: "At Risk",
    emoji: "🟡",
    hex: "#f59e0b",
  },
  OFF_TRACK: {
    bg: "bg-rose-100",
    text: "text-rose-700",
    dot: "bg-rose-500",
    border: "border-rose-200",
    ring: "ring-rose-300",
    label: "Off Track",
    emoji: "🔴",
    hex: "#ef4444",
  },
} as const satisfies Record<
  NonNullable<ConfidenceLevel>,
  {
    bg: string;
    text: string;
    dot: string;
    border: string;
    ring: string;
    label: string;
    emoji: string;
    hex: string;
  }
>;
