"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { FlowComment } from "@/lib/flow";

// A small floating card with the conversation on one step.
export function CommentCard({
  title,
  comments,
  meId,
  canModerate,
  onAdd,
  onDelete,
  onClose,
}: {
  title: string;
  comments: FlowComment[];
  meId: string;
  canModerate: boolean;
  onAdd: (body: string) => Promise<void> | void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [comments.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function post() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    await onAdd(body);
    setBusy(false);
    setDraft("");
  }

  return (
    <div
      className="fixed right-5 top-24 z-40 w-[min(21rem,calc(100vw-2.5rem))] rounded-2xl border border-white/15 shadow-2xl flex flex-col max-h-[70vh]"
      style={{ background: "var(--tint-solid)" }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2 border-b border-white/10">
        <div className="min-w-0">
          <div className="font-mono text-[0.68rem] tracking-[0.14em] text-orange">{t("COMMENTS", "KOMMENTARE")}</div>
          <div className="text-sm truncate">{title || t("Untitled step", "Schritt ohne Namen")}</div>
        </div>
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label={t("Close", "Schließen")}>✕</button>
      </div>
      <div ref={listRef} className="px-4 py-3 space-y-3 overflow-y-auto min-h-[3rem]">
        {comments.length === 0 && (
          <p className="text-[0.85rem] text-muted font-normal">
            {t("No comments yet. Leave a note for your team about this step.", "Noch keine Kommentare. Hinterlassen Sie Ihrem Team eine Notiz zu diesem Schritt.")}
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="text-[0.85rem]">
            <div className="flex items-baseline justify-between gap-2 text-[0.74rem] text-muted">
              <span className="truncate">
                {c.author_name || t("Someone", "Jemand")} · {new Date(c.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </span>
              {(c.author_id === meId || canModerate) && (
                <button onClick={() => onDelete(c.id)} className="hover:text-text flex-none">{t("delete", "löschen")}</button>
              )}
            </div>
            <div className="whitespace-pre-wrap font-normal">{c.body}</div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3 pt-2 border-t border-white/10">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) post();
          }}
          rows={2}
          maxLength={2000}
          placeholder={t("Add a comment…", "Kommentar hinzufügen …")}
          className="w-full bg-black/30 border border-white/10 rounded-xl text-text text-sm font-normal px-3 py-2 outline-none focus:border-orange/50 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[0.72rem] text-muted font-normal">{t("Ctrl+Enter to post", "Strg+Eingabe zum Senden")}</span>
          <button
            onClick={post}
            disabled={busy || !draft.trim()}
            className="rounded-full text-white text-xs font-mono tracking-wider px-4 py-1.5 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, rgba(248,153,29,.9), rgba(194,87,27,.85))" }}
          >
            {t("POST", "SENDEN")}
          </button>
        </div>
      </div>
    </div>
  );
}
