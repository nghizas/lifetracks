import { useEffect } from "react";
import { useStore, selectOrderedTracks } from "@/state";
import { Timeline } from "@/timeline";
import { SheetHost } from "@/panels";

export function App() {
  const ready = useStore((s) => s.ready);
  const tracks = useStore(selectOrderedTracks);
  const openSheet = useStore((s) => s.openSheet);
  const canUndo = useStore((s) => s.history.undo.length > 0);
  const canRedo = useStore((s) => s.history.redo.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  // Keyboard shortcuts (desktop): cmd/ctrl-Z = undo, cmd/ctrl-shift-Z = redo,
  // `t` = new track, `n` = new clip
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
            1c
          </span>
        </header>

        {!ready ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            loading…
          </div>
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
                disabled={tracks.length === 0}
                onClick={() => openSheet({ kind: "new-clip" })}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-[11px] font-medium disabled:opacity-40"
              >
                + Clip
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
