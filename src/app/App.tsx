import { useEffect, useState } from "react";
import { useStore, selectOrderedTracks } from "@/state";
import { Timeline } from "@/timeline";
import {
  BalanceMeter,
  ConflictsSheet,
  EmptyState,
  SheetHost,
  StatusBar,
} from "@/panels";

export function App() {
  const ready = useStore((s) => s.ready);
  const tracks = useStore(selectOrderedTracks);
  const openSheet = useStore((s) => s.openSheet);
  const canUndo = useStore((s) => s.history.undo.length > 0);
  const canRedo = useStore((s) => s.history.redo.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target?.closest("input, textarea, select, [contenteditable]");
      if (inField) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === "t") {
        e.preventDefault();
        openSheet({ kind: "new-track" });
      }
      if (e.key === "n") {
        e.preventDefault();
        openSheet({ kind: "new-clip" });
      }
      if (e.key === "b") {
        setShowBalance((b) => !b);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, undo, redo, openSheet]);

  return (
    <>
      <div className="mx-auto flex h-full max-w-[430px] flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-ink/5 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <h1 className="text-base font-semibold tracking-tight">Lifetracks</h1>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            1d
          </span>
        </header>

        {!ready ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            loading…
          </div>
        ) : tracks.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1.5 border-b border-ink/5 px-3 py-2">
              <button
                type="button"
                onClick={() => openSheet({ kind: "new-track" })}
                className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-white"
              >
                + Track
              </button>
              <button
                type="button"
                onClick={() => openSheet({ kind: "new-clip" })}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-[11px] font-medium"
              >
                + Clip
              </button>
              <button
                type="button"
                onClick={() => setShowBalance((b) => !b)}
                aria-pressed={showBalance}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                  showBalance
                    ? "border-ink bg-ink text-white"
                    : "border-ink/15 text-ink"
                }`}
              >
                ⚖
              </button>
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={undo}
                  aria-label="Undo"
                  className="rounded-full border border-ink/15 px-2.5 py-1.5 text-[11px] disabled:opacity-30"
                >
                  ↶
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={redo}
                  aria-label="Redo"
                  className="rounded-full border border-ink/15 px-2.5 py-1.5 text-[11px] disabled:opacity-30"
                >
                  ↷
                </button>
              </span>
            </div>

            <StatusBar onOpenConflicts={() => setConflictsOpen(true)} />

            {showBalance ? <BalanceMeter /> : null}

            <div className="flex-1 overflow-hidden">
              <Timeline />
            </div>
          </>
        )}
      </div>

      <SheetHost />
      <ConflictsSheet open={conflictsOpen} onClose={() => setConflictsOpen(false)} />
    </>
  );
}
