export type Technique = {
  id: string;
  key: string;
  plain: string;
  exec: string;
  exemplars: string[];
  antipatterns: string[];
  stats: { pulls: number; kept: number; dropped: number };
};

/** Kept-rate with a Laplace prior so an untested technique isn't penalized
 * against ones with a track record — starts neutral, earns its score. */
function score(t: Technique): number {
  const { pulls, kept } = t.stats;
  return (kept + 1) / (pulls + 2);
}

/**
 * Picks the next technique to apply from a given knot: prefer one that
 * hasn't been used yet on this branch (actual variety of approach),
 * falling back to whichever has the best kept:dropped track record once
 * everything's been tried at least once.
 */
export function pickTechnique(usedKeys: string[], techniques: Technique[]): Technique | null {
  if (techniques.length === 0) return null;
  const untried = techniques.filter((t) => !usedKeys.includes(t.key));
  const pool = untried.length > 0 ? untried : techniques;
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

export function buildTechniqueGuidance(t: Technique): string {
  return `Apply this technique specifically: "${t.key}". ${t.plain} ${t.exec}`.trim();
}

/** Free, instant, no model call — the hover suggestion's "why" comes from
 * the same signal the picker used, explained in a sentence. */
export function explainSuggestion(t: Technique, usedKeys: string[]): string {
  if (!usedKeys.includes(t.key)) return "Not yet tried on this branch.";
  const { pulls, kept } = t.stats;
  if (pulls === 0) return "No track record yet on this thread — worth a first try.";
  return `Kept ${kept} of ${pulls} pulls with this technique so far.`;
}

/** One color per technique — deliberately kept as a thin accent (left
 * border, glyph badge, wire) rather than a full card recolor, so it reads
 * as "which thread of yarn pulled this" without reopening the legibility
 * problem a full-saturation card background caused earlier. */
export const TECHNIQUE_COLOR: Record<string, string> = {
  "first principles": "#b48cff",
  reframe: "#ff6b9d",
  invert: "#6bd4ff",
  "outsider view": "#8cffb4",
  analogous: "#c9ff6b",
  "scope shift": "#ff6b6b",
  absence: "#9aa5b1",
  "forced collision": "#ffe66b",
};
const DEFAULT_TECHNIQUE_COLOR = "#d9a63f"; // matches --wire, for untagged/legacy nodes

export function techColor(key: string): string {
  return TECHNIQUE_COLOR[key] ?? DEFAULT_TECHNIQUE_COLOR;
}
