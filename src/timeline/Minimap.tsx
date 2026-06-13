// Slim strip showing the entire planning horizon. The current viewport
// renders as a translucent rectangle. Tap or drag to jump the viewport.

import { useCallback, useMemo, useRef } from "react";
import type { Clip } from "@/core";
import { daysBetween, todayStr } from "@/core";
import type { ViewState } from "@/state";

interface Props {
  origin: string;
  horizonEnd: string;
  clips: readonly Clip[];
  trackColorByClip: (c: Clip) => string;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  width: number;
  viewportPxWidth: number;
  height?: number;
}

export function Minimap({
  origin,
  horizonEnd,
  clips,
  trackColorByClip,
  view,
  setView,
  width,
  viewportPxWidth,
  height = 24,
}: Props) {
  const totalDays = daysBetween(origin, horizonEnd);
  const today = todayStr();
  const todayDays = daysBetween(origin, today);

  // Translate world coords (in current pxPerDay) into minimap pixels.
  const minimapPxPerDay = width / Math.max(1, totalDays);

  const viewportStartDays = view.scrollX / view.pxPerDay;
  const viewportEndDays = (view.scrollX + viewportPxWidth) / view.pxPerDay;

  const vpX = Math.max(0, viewportStartDays * minimapPxPerDay);
  const vpW = Math.max(8, (viewportEndDays - viewportStartDays) * minimapPxPerDay);

  // Density: bucket clips into 60 buckets and render a faint mark per bucket.
  const buckets = useMemo(() => {
    const out: { x: number; color: string; weight: number }[] = [];
    for (const c of clips) {
      const startDays = daysBetween(origin, c.start);
      const x = startDays * minimapPxPerDay;
      if (Number.isFinite(x)) out.push({ x, color: trackColorByClip(c), weight: 1 });
    }
    return out;
  }, [clips, origin, minimapPxPerDay, trackColorByClip]);

  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const moveViewportTo = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const centerDays = x / minimapPxPerDay;
      const targetScrollX = centerDays * view.pxPerDay - viewportPxWidth / 2;
      setView({ scrollX: targetScrollX });
    },
    [minimapPxPerDay, view.pxPerDay, viewportPxWidth, setView],
  );

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className="block touch-none"
      onPointerDown={(e) => {
        ref.current?.setPointerCapture(e.pointerId);
        dragging.current = true;
        moveViewportTo(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        moveViewportTo(e.clientX);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        try {
          ref.current?.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <rect width={width} height={height} fill="#f4f4f5" />
      {/* Today line */}
      <line
        x1={todayDays * minimapPxPerDay}
        y1={0}
        x2={todayDays * minimapPxPerDay}
        y2={height}
        stroke="#e11d48"
        strokeWidth={1}
        opacity={0.6}
      />
      {/* Density marks */}
      {buckets.map((b, i) => (
        <line
          key={i}
          x1={b.x}
          y1={4}
          x2={b.x}
          y2={height - 4}
          stroke={b.color}
          strokeWidth={1}
          opacity={0.5}
        />
      ))}
      {/* Viewport */}
      <rect
        x={vpX}
        y={1}
        width={vpW}
        height={height - 2}
        fill="#0f1217"
        opacity={0.1}
        stroke="#0f1217"
        strokeOpacity={0.4}
        strokeWidth={1}
        rx={3}
      />
    </svg>
  );
}
