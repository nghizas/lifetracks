import { useEffect, useState } from "react";
import { useStore, selectOrderedTracks } from "@/state";
import { Timeline } from "@/timeline";
import {
  BalanceMeter,
  EmptyState,
  SheetHost,
  StatusBar,
} from "@/panels";

// Thumb-first toolbar: 44px-tall buttons with real text labels (no glyph-only
// chrome). Bigger, more obvious, optimised for tapping on a phone.

export function App() {
  const ready = useStore((s) => s.ready);
  const tracks = useStore(selectOrderedTracks);
  const openSheet = useStore((s) => s.openSheet);
  const canUndo = useStore((s) => s.history.undo.length > 0);
  const canRedo = useStore((s) => s.history.redo.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

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
        <header className="flex shrink-0 items-center justify-between border-b border-ink/5 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <h1 className="text-lg font-semibold tracking-tight">Lifetracks</h1>
          <button
            type="button"
            onClick={() => openSheet({ kind: "settings" })}
            className="grid h-9 w-9 place-items-center rounded-full text-lg text-muted hover:bg-ink/5"
            aria-label="Settings"
          >
            ⋯
          </button>
        </header>

        {!ready ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            loading…
          </div>
        ) : tracks.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-ink/5 px-3 py-2">
              <button
                type="button"
                onClick={() => openSheet({ kind: "new-track" })}
                className="h-11 rounded-full bg-ink px-4 text-[14px] font-semibold text-white"
              >
                + Track
              </button>
              <button
                type="button"
                onClick={() => openSheet({ kind: "new-clip" })}
                className="h-11 rounded-full border border-ink/15 bg-white px-4 text-[14px] font-semibold"
              >
                + Clip
              </button>
              <button
                type="button"
                onClick={() => setShowBalance((b) => !b)}
                aria-pressed={showBalance}
                aria-label="Toggle balance meter"
                className={`grid h-11 w-11 place-items-center rounded-full border text-[16px] ${
                  showBalance
                    ? "border-ink bg-ink text-white"
                    : "border-ink/15 bg-white text-ink"
                }`}
              >
                ⚖
              </button>
              <span className="ml-auto flex gap-1.5">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={undo}
                  aria-label="Undo"
                  className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white text-[18px] disabled:opacity-30"
                >
                  ↶
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={redo}
                  aria-label="Redo"
                  className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white text-[18px] disabled:opacity-30"
                >
                  ↷
                </button>
              </span>
            </div>

            <StatusBar />

            {showBalance ? <BalanceMeter /> : null}

            <div className="flex-1 overflow-hidden">
              <Timeline />
            </div>
          </>
        )}
      </div>

      <SheetHost />
    </>
  );
}
