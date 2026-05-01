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
