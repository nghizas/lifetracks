// Left-column track headers. Vertical positions match `layouts` so headers
// line up with their lanes pixel-for-pixel. Width is driven by the caller
// (Timeline drag-resizes it via view.headerWidth).

import type { Track } from "@/core";
import type { LayoutResult } from "./layout";

interface Props {
  tracks: readonly Track[];
  layout: LayoutResult;
  width: number;
  onRemoveTrack?: (id: string) => void;
  onRenameTrack?: (id: string, name: string) => void;
  onAddClipToTrack?: (id: string) => void;
}

export function TrackHeaders({
  tracks,
  layout,
  width,
  onRemoveTrack,
  onRenameTrack,
  onAddClipToTrack,
}: Props) {
  return (
    <div
      className="relative shrink-0 bg-white"
      style={{ width, height: layout.totalHeight }}
    >
      {tracks.map((t) => {
        const lay = layout.layouts.get(t.id);
        if (!lay) return null;
        const isCompact = lay.height <= 32;
        return (
          <div
            key={t.id}
            className="absolute left-0 right-0 flex items-center gap-2 border-b border-ink/5 px-2"
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
              className={`min-w-0 flex-1 text-left ${
                isCompact ? "truncate" : ""
              } text-[13px] font-medium leading-tight`}
              title={t.name}
              style={isCompact ? undefined : { whiteSpace: "normal", wordBreak: "break-word" }}
            >
              {t.name}
            </button>
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
