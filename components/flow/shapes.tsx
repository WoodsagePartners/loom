"use client";

import type { ActorKind } from "@/lib/flow";

// Shape = what KIND of actor owns a step (the owner's name/color ride on top).
//   person   → pill          team     → rounded rectangle
//   system   → square-cornered box     ai → hexagon     external → parallelogram

export const HEX = "18,2 182,2 198,38 182,74 18,74 2,38";
export const PARA = "26,2 198,2 174,74 2,74";

/** Background + outline for a node body of the given actor kind (fills the parent box). */
export function ShapeBody({
  kind,
  color,
  dashed,
  glow,
}: {
  kind: ActorKind | null;
  color: string;
  dashed?: boolean;
  glow?: boolean;
}) {
  const fill = "var(--tint-node)";
  const tint = `${color}1f`;
  const shadow = glow ? `0 0 18px ${color}55` : "0 2px 10px rgba(0,0,0,.35)";
  if (kind === "ai" || kind === "external") {
    return (
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox="0 0 200 76"
        preserveAspectRatio="none"
        style={{ filter: glow ? `drop-shadow(0 0 8px ${color}66)` : undefined }}
      >
        <polygon points={kind === "ai" ? HEX : PARA} style={{ fill }} />
        <polygon
          points={kind === "ai" ? HEX : PARA}
          fill={tint}
          stroke={`${color}b8`}
          strokeWidth={1.5}
          strokeDasharray={dashed ? "6 5" : undefined}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  const radius = kind === "person" ? 999 : kind === "system" ? 4 : 16; // team + unassigned
  return (
    <div
      className="absolute inset-0 glass-rim"
      style={{
        borderRadius: radius,
        background: `linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03)), linear-gradient(${tint}, ${tint}), ${fill}`,
        backdropFilter: "blur(14px) saturate(125%)",
        WebkitBackdropFilter: "blur(14px) saturate(125%)",
        border: `1.5px ${dashed ? "dashed" : "solid"} ${color}b8`,
        boxShadow: `${shadow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
      }}
    />
  );
}

/** Small icon of an actor-kind shape, for the nav and pickers. */
export function ShapeIcon({ kind, color, size = 26 }: { kind: ActorKind; color: string; size?: number }) {
  const w = size;
  const h = Math.round(size * 0.6);
  const common = { fill: `${color}33`, stroke: color, strokeWidth: 1.6 } as const;
  return (
    <svg width={w} height={h} viewBox="0 0 30 18" className="flex-none">
      {kind === "person" && <rect x="1" y="2" width="28" height="14" rx="7" {...common} />}
      {kind === "team" && <rect x="1" y="2" width="28" height="14" rx="4" {...common} />}
      {kind === "system" && <rect x="1.5" y="2" width="27" height="14" rx="0.8" {...common} />}
      {kind === "ai" && <polygon points="7,1.5 23,1.5 29,9 23,16.5 7,16.5 1,9" {...common} strokeLinejoin="round" />}
      {kind === "external" && <polygon points="8,2 29,2 22,16 1,16" {...common} strokeLinejoin="round" />}
    </svg>
  );
}

/** Electrical-ground symbol: where a workflow ends. */
export function GroundSymbol({ color = "#93a5b6", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="10" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="6.5" y1="15" x2="17.5" y2="15" />
      <line x1="10" y1="20" x2="14" y2="20" />
    </svg>
  );
}
