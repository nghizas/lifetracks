// Slice-1a placeholder UI: enough to verify storage + state + undo on the phone.
// Replaced by the real timeline canvas in slice 1b.

import { useStore, selectOrderedTracks } from "@/state";
import { todayStr, addMonths } from "@/core";

export function App() {
  const ready = useStore((s) => s.ready);
  const tracks = useStore(selectOrderedTracks);
  const clips = useStore((s) => s.roadmap.clips);
  const canUndo = useStore((s) => s.history.undo.length > 0);
  const canRedo = useStore((s) => s.history.redo.length > 0);

  const addTrack = useStore((s) => s.addTrack);
  const addClip = useStore((s) => s.addClip);
  const removeTrack = useStore((s) => s.removeTrack);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  return (
    <div className="mx-auto flex h-full max-w-[430px] flex-col">
      <header className="flex items-center justify-between border-b border-ink/5 px-5 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
        <h1 className="text-xl font-semibold tracking-tight">Lifetracks</h1>
        <span className="rounded-full bg-ink/5 px-2 py-1 text-xs text-muted">
          Phase 1 · slice 1a
        </span>
      </header>

      {!ready ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          loading…
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-ink/5 px-5 py-3">
            <button
              type="button"
              onClick={() => {
                const t = addTrack({ name: prompt("Track name?") ?? "New track" });
                if (t) void t;
              }}
              className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white"
            >
              + Track
            </button>
            <button
              type="button"
              disabled={tracks.length === 0}
              onClick={() => {
                const first = tracks[0];
                if (!first) return;
                addClip({
                  trackId: first.id,
                  kind: "task",
                  title: "Untitled task",
                  start: todayStr(),
                  end: addMonths(todayStr(), 2),
                });
              }}
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              + Task on top track
            </button>
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                className="rounded-full border border-ink/15 px-2.5 py-1.5 text-xs disabled:opacity-30"
              >
                ↶
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={redo}
                className="rounded-full border border-ink/15 px-2.5 py-1.5 text-xs disabled:opacity-30"
              >
                ↷
              </button>
            </span>
          </div>

          <main className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted">
              {tracks.length} {tracks.length === 1 ? "track" : "tracks"} ·{" "}
              {clips.length} {clips.length === 1 ? "clip" : "clips"}
            </div>

            {tracks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-ink/15 p-6 text-center text-sm text-muted">
                No tracks yet. Tap <strong>+ Track</strong> to add one.
              </p>
            ) : (
              <ul className="space-y-2">
                {tracks.map((t) => {
                  const trackClips = clips.filter((c) => c.trackId === t.id);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: t.color }}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted">
                          {trackClips.length}{" "}
                          {trackClips.length === 1 ? "clip" : "clips"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTrack(t.id)}
                        className="text-xs text-muted underline underline-offset-2"
                      >
                        delete
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </main>
        </>
      )}

      <footer className="border-t border-ink/5 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 text-center text-xs text-muted">
        slice 1a · storage + state + undo
      </footer>
    </div>
  );
}
