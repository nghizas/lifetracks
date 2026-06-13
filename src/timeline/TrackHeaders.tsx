// Left-column track headers. Vertical positions match `layouts` so headers
// line up with their lanes pixel-for-pixel.

import type { Track } from "@/core";
import type { LayoutResult } from "./layout";

interface Props {
  tracks: readonly Track[];
  layout: LayoutResult;
  width: number;
  onRemoveTrack?: (id: string) => void;
  onRenameTrack?: (id: string, name: string) => void;
}

export function TrackHeaders({
  tracks,
  layout,
  width,
  onRemoveTrack,
  onRenameTrack,
}: Props) {
  return (
    <div
      className="relative shrink-0 border-r border-ink/5 bg-white"
      style={{ width, height: layout.totalHeight }}
    >
      {tracks.map((t) => {
        const lay = layout.layouts.get(t.id);
        if (!lay) return null;
        return (
          <div
            key={t.id}
            className="absolute left-0 right-0 flex items-center gap-2 px-3"
            style={{ top: lay.yStart, height: lay.height }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: t.color }}
            />
            <button
              type="button"
              onClick={() => {
                if (!onRenameTrack) return;
                const next = window.prompt("Rename track", t.name);
                if (next && next.trim() && next !== t.name) onRenameTrack(t.id, next.trim());
              }}
              className="flex-1 truncate text-left text-sm font-medium"
              title={t.name}
            >
              {t.name}
            </button>
            {onRemoveTrack ? (
              <button
                type="button"
                onClick={() => onRemoveTrack(t.id)}
                className="text-xs text-muted"
                aria-label={`Delete ${t.name}`}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
