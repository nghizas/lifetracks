// Floating "track tag" overlays. The track header column is gone — instead
// each track's name + mute/solo buttons live as a compact card pinned to the
// top-left of that track's row inside the canvas itself. Cards are sized to
// fit the full track name (no truncation) and use a semi-transparent backdrop
// so clips beneath remain visible.

import type { Track } from "@/core";
import type { LayoutResult } from "./layout";

interface Props {
  tracks: readonly Track[];
  layout: LayoutResult;
  onRemoveTrack?: (id: string) => void;
  onRenameTrack?: (id: string, name: string) => void;
  onAddClipToTrack?: (id: string) => void;
  onToggleMute?: (id: string) => void;
  onToggleSolo?: (id: string) => void;
}

export function TrackLabelOverlay({
  tracks,
  layout,
  onRemoveTrack,
  onRenameTrack,
  onAddClipToTrack,
  onToggleMute,
  onToggleSolo,
}: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{ height: layout.totalHeight }}
    >
      {tracks.map((t) => {
        const lay = layout.layouts.get(t.id);
        if (!lay) return null;
        return (
          <div
            key={t.id}
            className="pointer-events-auto absolute flex items-center gap-1 rounded-lg border border-ink/10 bg-white/60 px-1.5 py-1 shadow-sm backdrop-blur-md"
            style={{ top: lay.yStart + 3, left: 6 }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
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
              className="whitespace-nowrap text-[12px] font-semibold leading-none"
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
                className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[9px] font-bold ${
                  t.muted
                    ? "bg-ink text-white"
                    : "border border-ink/15 text-muted"
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
                className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[9px] font-bold ${
                  t.soloed
                    ? "bg-amber-400 text-ink"
                    : "border border-ink/15 text-muted"
                }`}
              >
                S
              </button>
            ) : null}
            {onAddClipToTrack ? (
              <button
                type="button"
                onClick={() => onAddClipToTrack(t.id)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-[14px] leading-none text-muted"
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
