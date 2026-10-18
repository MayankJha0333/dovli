// Built-in page covers: soft gradients drawn in CSS, so they cost nothing to load.
// A page stores "g:<id>" for one of these, "file:<id>" for an uploaded image, or a web address.

export interface CoverPreset {
  id: string;
  name: string;
  css: string;
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: "dawn", name: "Dawn", css: "linear-gradient(120deg, #fbc2eb 0%, #a6c1ee 100%)" },
  { id: "citrus", name: "Citrus", css: "linear-gradient(120deg, #f6d365 0%, #fda085 100%)" },
  { id: "meadow", name: "Meadow", css: "linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)" },
  { id: "lagoon", name: "Lagoon", css: "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)" },
  { id: "dusk", name: "Dusk", css: "linear-gradient(135deg, #2a3a8f 0%, #8e5fbf 60%, #f6b19c 100%)" },
  { id: "ink", name: "Ink", css: "linear-gradient(135deg, #1b1d24 0%, #3b3f4d 100%)" },
  { id: "paper", name: "Paper", css: "linear-gradient(180deg, #efece6 0%, #ddd8cd 100%)" },
  { id: "aurora", name: "Aurora", css: "radial-gradient(ellipse at 20% 20%, #40d2aa 0%, transparent 50%), radial-gradient(ellipse at 80% 40%, #8c5ae6 0%, transparent 55%), #0b0d14" },
];

export function coverPreset(value: string | null | undefined): CoverPreset | null {
  if (!value?.startsWith("g:")) return null;
  return COVER_PRESETS.find((c) => c.id === value.slice(2)) ?? null;
}
