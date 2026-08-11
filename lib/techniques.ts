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
