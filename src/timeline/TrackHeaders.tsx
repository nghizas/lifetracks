// Left-column track headers — GarageBand-style mixer with mute / solo buttons,
// color swatch, single-line truncated name. Long-press the name to delete.
// Tap the name to rename (prompt for now; an EditTrackSheet replaces it later).

import type { Track } from "@/core";
import type { LayoutResult } from "./layout";

interface Props {
  tracks: readonly Track[];
  layout: LayoutResult;
  width: number;
  onRemoveTrack?: (id: string) => void;
  onRenameTrack?: (id: string, name: string) => void;
  onAddClipToTrack?: (id: string) => void;
  onToggleMute?: (id: string) => void;
  onToggleSolo?: (id: string) => void;
}

export function TrackHeaders({
  tracks,
  layout,
  width,
  onRemoveTrack,
  onRenameTrack,
  onAddClipToTrack,
  onToggleMute,
  onToggleSolo,
}: Props) {
  const anySoloed = tracks.some((t) => t.soloed);

  return (
    <div
      className="relative shrink-0 bg-white"
      style={{ width, height: layout.totalHeight }}
    >
      {tracks.map((t) => {
        const lay = layout.layouts.get(t.id);
        if (!lay) return null;
        const dimmed = anySoloed ? !t.soloed : t.muted;
        return (
          <div
            key={t.id}
            className={`absolute left-0 right-0 flex items-center gap-1.5 border-b border-ink/5 px-2 transition-opacity ${
              dimmed ? "opacity-40" : "opacity-100"
            }`}
            style={{ top: lay.yStart, height: lay.height }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: t.color }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => {
                if (!onRenameTrack) return;
                const next = window.prompt("Rename track", t.name);
                if (next && next.trim() && next !== t.name) onRenameTrack(t.id, next.trim());
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (onRemoveTrack && window.confirm(`Delete "${t.name}" and its clips?`)) {
                  onRemoveTrack(t.id);
                }
              }}
              className="min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-tight"
              title={t.name}
            >
              {t.name}
            </button>
            {onToggleMute ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute(t.id);
                }}
                aria-pressed={t.muted}
                aria-label={`${t.muted ? "Unmute" : "Mute"} ${t.name}`}
                className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-bold ${
                  t.muted ? "bg-ink text-white" : "border border-ink/15 text-muted hover:bg-ink/5"
                }`}
              >
                M
              </button>
            ) : null}
            {onToggleSolo ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSolo(t.id);
                }}
                aria-pressed={t.soloed}
                aria-label={`${t.soloed ? "Unsolo" : "Solo"} ${t.name}`}
                className={`grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-bold ${
                  t.soloed ? "bg-amber-400 text-ink" : "border border-ink/15 text-muted hover:bg-ink/5"
                }`}
              >
                S
              </button>
            ) : null}
            {onAddClipToTrack ? (
              <button
                type="button"
                onClick={() => onAddClipToTrack(t.id)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-base leading-none text-muted hover:bg-ink/5"
                aria-label={`Add clip to ${t.name}`}
              >
                +
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
