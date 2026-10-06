"use client";

import { useSyncExternalStore } from "react";

export type Lang = "en" | "de";
const KEY = "loom_lang";
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage blocked — falls back to English next load */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "en" as Lang);
}

// English is the source of truth: a missing German string falls back to it,
// so adding a new English string never breaks the German view.
export function useT() {
  const lang = useLang();
  return (en: string, de?: string) => (lang === "de" && de ? de : en);
}
