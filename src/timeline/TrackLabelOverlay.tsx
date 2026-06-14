// Track tag overlay. The label sits in the dedicated label row at the top of
// each track. Tapping the name opens EditTrackSheet; long-pressing it (~350ms)
// enters drag-reorder mode — the label follows the finger vertically, and
// release commits a `reorderTracks` based on where the finger lands.

import { useRef, useState, type RefObject } from "react";
import type { Track } from "@/core";
import { useStore } from "@/state";
import { type LayoutResult, LABEL_ROW_HEIGHT } from "./layout";

const LONG_PRESS_MS = 350;
const TAP_MAX_MOVE_PX = 8;
const TAP_MAX_MS = 300;

interface Props {
  tracks: readonly Track[];
  layout: LayoutResult;
  canvasRef: RefObject<HTMLDivElement>;
  onEditTrack?: (id: string) => void;
  onAddClipToTrack?: (id: string) => void;
  onToggleMute?: (id: string) => void;
  onToggleSolo?: (id: string) => void;
}

export function TrackLabelOverlay({
  tracks,
  layout,
  canvasRef,
  onEditTrack,
  onAddClipToTrack,
  onToggleMute,
  onToggleSolo,
}: Props) {
  const reorderTracks = useStore((s) => s.reorderTracks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  function startInteraction(e: React.PointerEvent<HTMLButtonElement>, trackId: string) {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startTime = Date.now();
    let isDragging = false;

    const longPressTimer = window.setTimeout(() => {
      isDragging = true;
      setDragId(trackId);
      setDragOffsetY(0);
      if (navigator.vibrate) navigator.vibrate(8);
    }, LONG_PRESS_MS);

    const onMove = (ev: PointerEvent) => {
      if (!isDragging) {
        const moved =
          Math.abs(ev.clientY - startY) + Math.abs(ev.clientX - startX);
        if (moved > TAP_MAX_MOVE_PX) {
          window.clearTimeout(longPressTimer);
          cleanup();
        }
        return;
      }
      setDragOffsetY(ev.clientY - startY);
    };

    const onUp = (ev: PointerEvent) => {
      window.clearTimeout(longPressTimer);
      cleanup();

      if (isDragging) {
        const targetIdx = computeTargetIdx(ev.clientY, trackId);
        const fromIdx = tracks.findIndex((t) => t.id === trackId);
        if (targetIdx !== fromIdx && fromIdx >= 0) {
          const swapped = tracks.slice();
          const [moved] = swapped.splice(fromIdx, 1);
          if (moved) swapped.splice(targetIdx, 0, moved);
          reorderTracks(swapped.map((t) => t.id));
        }
        setDragId(null);
        setDragOffsetY(0);
        return;
      }

      // Was a tap — open the edit sheet.
      const elapsed = Date.now() - startTime;
      const moved = Math.abs(ev.clientY - startY) + Math.abs(ev.clientX - startX);
      if (elapsed < TAP_MAX_MS && moved < TAP_MAX_MOVE_PX) {
        onEditTrack?.(trackId);
      }
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      cleanupRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    cleanupRef.current = cleanup;
  }

  function computeTargetIdx(clientY: number, _trackId: string): number {
    const el = canvasRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const localY = clientY - rect.top + el.scrollTop;
    let idx = 0;
    for (const t of tracks) {
      const lay = layout.layouts.get(t.id);
      if (!lay) continue;
      const midY = lay.yStart + lay.height / 2;
      if (localY < midY) return idx;
      idx++;
    }
    return Math.max(0, tracks.length - 1);
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{ height: layout.totalHeight }}
    >
      {tracks.map((t) => {
        const lay = layout.layouts.get(t.id);
        if (!lay) return null;
        const isDragging = dragId === t.id;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto absolute flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-2 shadow-sm transition-shadow ${
              isDragging ? "z-20 shadow-lg" : ""
            }`}
            style={{
              top: lay.yStart + (LABEL_ROW_HEIGHT - 22) / 2,
              left: 6,
              height: 22,
              transform: isDragging
                ? `translateY(${dragOffsetY}px) scale(1.04)`
                : undefined,
              transitionProperty: isDragging ? "none" : "box-shadow",
            }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: t.color }}
              aria-hidden
            />
            <button
              type="button"
              onPointerDown={(e) => startInteraction(e, t.id)}
              className="whitespace-nowrap text-[12px] font-semibold leading-none"
              title={`Tap to edit • Long-press to drag ${t.name}`}
              style={{ touchAction: "none" }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onAddClipToTrack(t.id);
                }}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[13px] font-bold leading-none text-white shadow-sm"
                style={{ background: t.color }}
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
