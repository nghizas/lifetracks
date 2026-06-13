import { useStore, selectOrderedTracks } from "@/state";
import { Timeline } from "@/timeline";
import { todayStr, addMonths, addDays } from "@/core";

export function App() {
  const ready = useStore((s) => s.ready);
  const tracks = useStore(selectOrderedTracks);
  const addTrack = useStore((s) => s.addTrack);
  const addClip = useStore((s) => s.addClip);
  const canUndo = useStore((s) => s.history.undo.length > 0);
  const canRedo = useStore((s) => s.history.redo.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  return (
    <div className="mx-auto flex h-full max-w-[430px] flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-ink/5 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <h1 className="text-base font-semibold tracking-tight">Lifetracks</h1>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
          1b
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
              onClick={() => {
                const name = window.prompt("Track name?");
                if (name?.trim()) addTrack({ name: name.trim() });
              }}
              className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white"
            >
              + Track
            </button>
            <button
              type="button"
              disabled={tracks.length === 0}
              onClick={() => {
                const t = tracks[0];
                if (!t) return;
                const start = addDays(todayStr(), 7);
                addClip({
                  trackId: t.id,
                  kind: "task",
                  title: "New task",
                  start,
                  end: addMonths(start, 2),
                });
              }}
              className="rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium disabled:opacity-40"
            >
              + Task
            </button>
            <button
              type="button"
              disabled={tracks.length === 0}
              onClick={() => {
                const t = tracks[0];
                if (!t) return;
                addClip({
                  trackId: t.id,
                  kind: "stem",
                  title: "Weekly habit",
                  start: todayStr(),
                });
              }}
              className="rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium disabled:opacity-40"
            >
              + Stem
            </button>
            <button
              type="button"
              disabled={tracks.length === 0}
              onClick={() => {
                const t = tracks[0];
                if (!t) return;
                addClip({
                  trackId: t.id,
                  kind: "event",
                  title: "Milestone date",
                  start: addMonths(todayStr(), 3),
                });
              }}
              className="rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium disabled:opacity-40"
            >
              + Event
            </button>
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                aria-label="Undo"
                className="rounded-full border border-ink/15 px-2 py-1 text-[11px] disabled:opacity-30"
              >
                ↶
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={redo}
                aria-label="Redo"
                className="rounded-full border border-ink/15 px-2 py-1 text-[11px] disabled:opacity-30"
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
  );
}
