// Fat purple scrubber. The user-feedback pass made this much more prominent
// (80px tall, violet background, big rounded viewport rectangle) because the
// minimap doubles as both navigation and "I've zoomed in too far, where am I"
// orientation. Tap or drag anywhere to jump the viewport center.

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
  height = 80,
}: Props) {
  const totalDays = daysBetween(origin, horizonEnd);
  const today = todayStr();
  const todayDays = daysBetween(origin, today);

  const minimapPxPerDay = width / Math.max(1, totalDays);

  const viewportStartDays = view.scrollX / view.pxPerDay;
  const viewportEndDays = (view.scrollX + viewportPxWidth) / view.pxPerDay;

  const vpX = Math.max(0, viewportStartDays * minimapPxPerDay);
  const vpW = Math.max(28, (viewportEndDays - viewportStartDays) * minimapPxPerDay);

  const density = useMemo(() => {
    const out: { x: number; color: string }[] = [];
    for (const c of clips) {
      const startDays = daysBetween(origin, c.start);
      const x = startDays * minimapPxPerDay;
      if (Number.isFinite(x)) out.push({ x, color: trackColorByClip(c) });
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
      {/* Lavender backplate */}
      <rect width={width} height={height} fill="#f5f3ff" />
      {/* Track density marks, big and proud */}
      {density.map((b, i) => (
        <line
          key={i}
          x1={b.x}
          y1={10}
          x2={b.x}
          y2={height - 10}
          stroke={b.color}
          strokeWidth={2}
          opacity={0.7}
        />
      ))}
      {/* Today line */}
      <line
        x1={todayDays * minimapPxPerDay}
        y1={0}
        x2={todayDays * minimapPxPerDay}
        y2={height}
        stroke="#e11d48"
        strokeWidth={2}
        opacity={0.85}
      />
      {/* Viewport rectangle — solid violet, big enough to grab */}
      <rect
        x={vpX}
        y={4}
        width={vpW}
        height={height - 8}
        fill="#7c3aed"
        fillOpacity={0.18}
        stroke="#6d28d9"
        strokeWidth={2}
        rx={8}
      />
      {/* Grip dots on the rectangle so it reads as "I'm draggable" */}
      <g pointerEvents="none">
        <circle cx={vpX + 8} cy={height / 2} r={2.5} fill="#6d28d9" />
        <circle cx={vpX + vpW - 8} cy={height / 2} r={2.5} fill="#6d28d9" />
      </g>
    </svg>
  );
}
