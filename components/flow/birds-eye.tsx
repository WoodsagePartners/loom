"use client";

import { useMemo } from "react";

// A small bird's-eye map of a process: every step as a tiny block, lanes as bands, and
// colored markers for whatever the caller wants to hop between (insights, gaps, comments…).
// Pure and presentational, so it can live in any drawer, card or page.

export type EyeBox = { id: string; x: number; y: number; w: number; h: number };
export type EyeBand = { y: number; h: number; color?: string | null };
export type EyeMarker = { key: string; x: number; y: number; color: string; dashed?: boolean };

export function BirdsEye({
  boxes, bands = [], markers = [], width = 230, maxH = 220, activeKey, onMarker, onBackground,
}: {
  boxes: EyeBox[];
  bands?: EyeBand[];
  markers?: EyeMarker[];
  width?: number;
  maxH?: number;
  activeKey?: string | null;
  onMarker?: (key: string) => void;
  onBackground?: (x: number, y: number) => void; // click empty map → map coordinates (flow px)
}) {
  const g = useMemo(() => {
    const pad = 30;
    const xs = boxes.flatMap((b) => [b.x, b.x + b.w]).concat(markers.map((m) => m.x));
    const ys = boxes.flatMap((b) => [b.y, b.y + b.h]).concat(bands.flatMap((b) => [b.y, b.y + b.h]));
    if (!xs.length || !ys.length) return null;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
    const y0 = Math.min(...ys) - pad / 2, y1 = Math.max(...ys) + pad / 2;
    const s = width / (x1 - x0);
    return { x0, y0, s, w: width, h: Math.max(56, Math.min(maxH, (y1 - y0) * s)) };
  }, [boxes, bands, markers, width, maxH]);
  if (!g) return null;
  const sc = (v: number, o: number) => (v - o) * g.s;
  return (
    <svg
      width={g.w}
      height={g.h}
      viewBox={`0 0 ${g.w} ${g.h}`}
      className="rounded-lg border border-white/10 bg-black/30"
      onClick={(e) => {
        if (!onBackground) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        onBackground((e.clientX - r.left) / g.s + g.x0, (e.clientY - r.top) / g.s + g.y0);
      }}
      style={{ cursor: onBackground ? "crosshair" : undefined }}
    >
      {bands.map((b, i) => (
        <rect key={i} x={0} y={sc(b.y, g.y0)} width={g.w} height={b.h * g.s} fill={b.color ? `${b.color}22` : "rgba(255,255,255,.04)"} stroke="rgba(255,255,255,.12)" strokeDasharray="3 3" />
      ))}
      {boxes.map((b) => (
        <rect key={b.id} x={sc(b.x, g.x0)} y={sc(b.y, g.y0)} width={Math.max(3, b.w * g.s)} height={Math.max(2, b.h * g.s)} rx={1.5} fill="rgba(255,255,255,.22)" />
      ))}
      {markers.map((m) => {
        const on = m.key === activeKey;
        return (
          <g key={m.key} onClick={(e) => { e.stopPropagation(); onMarker?.(m.key); }} style={{ cursor: "pointer" }}>
            <circle cx={sc(m.x, g.x0)} cy={sc(m.y, g.y0)} r={on ? 7 : 4.5} fill={m.dashed ? "rgba(12,16,26,.8)" : m.color} stroke={m.color} strokeWidth={1.5} strokeDasharray={m.dashed ? "2 2" : undefined} opacity={m.dashed && !on ? 0.85 : 1} />
            {on && <circle cx={sc(m.x, g.x0)} cy={sc(m.y, g.y0)} r={11} fill="none" stroke={m.color} strokeOpacity={0.5} />}
          </g>
        );
      })}
    </svg>
  );
}
