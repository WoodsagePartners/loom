"use client";

import { useSyncExternalStore } from "react";

export type ThemeName = "dark" | "light";

const KEY = "loom_theme"; // read by the inline script in app/layout.tsx before first paint
const listeners = new Set<() => void>();

function read(): ThemeName {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(next: ThemeName) {
  if (typeof document === "undefined") return;
  if (next === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(KEY, next); } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useTheme(): ThemeName {
  return useSyncExternalStore(subscribe, read, () => "dark");
}
