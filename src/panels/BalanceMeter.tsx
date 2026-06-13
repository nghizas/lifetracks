// Stacked effort share per month, per track. A small horizontal strip that
// shows where the roadmap is calm vs. piled up. Threshold lines at 1.0× and
// 1.2× capacity (the snug/overload boundaries).

import { useMemo } from "react";
import { runSequencer, todayStr } from "@/core";
import { useStore } from "@/state";

interface Props {
  height?: number;
}

export function BalanceMeter({ height = 56 }: Props) {
  const roadmap = useStore((s) => s.roadmap);
  const today = todayStr();
  const result = useMemo(() => runSequencer(roadmap, today), [roadmap, today]);

  const months = useMemo(() => {
    // Render the next 12 months only (mobile width is tight).
    const all = result.months.slice().sort();
    const todayKey = `${new Date(today).getFullYear()}-${String(
      new Date(today).getMonth() + 1,
    ).padStart(2, "0")}`;
    const idx = all.indexOf(todayKey);
    return idx >= 0 ? all.slice(idx, idx + 12) : all.slice(0, 12);
  }, [result.months, today]);

  if (roadmap.tracks.length === 0) return null;

  const trackColor = new Map(roadmap.tracks.map((t) => [t.id, t.color]));
  const trackOrder = roadmap.tracks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((t) => t.id);

  // Find the peak load across visible months for scaling (cap at 1.4× of capacity)
  const peakRatio = Math.max(
    1.2,
    ...months.map((m) => {
      const cap = result.capByMonth.get(m) ?? 1;
      const tot = result.totalByMonth.get(m) ?? 0;
      return cap > 0 ? tot / cap : 0;
    }),
  );

  const barWidth = `${100 / months.length}%`;

  return (
    <div
      className="flex items-end gap-0.5 border-t border-ink/5 bg-white px-1"
      style={{ height }}
      title="12-month effort balance"
    >
      {months.map((m) => {
        const cap = result.capByMonth.get(m) ?? 1;
        const total = result.totalByMonth.get(m) ?? 0;
        const ratio = cap > 0 ? total / cap : 0;
        return (
          <div
            key={m}
            className="relative flex h-full flex-col-reverse"
            style={{ width: barWidth }}
          >
            {/* Threshold guide lines */}
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-snug/60"
              style={{ bottom: `${(1.0 / peakRatio) * 100}%` }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-overload/60"
              style={{ bottom: `${(1.2 / peakRatio) * 100}%` }}
            />
            {/* Stacked segments per track */}
            {trackOrder.map((tid) => {
              const inner = result.effortByTrackByMonth.get(tid);
              const v = inner?.get(m) ?? 0;
              if (v <= 0) return null;
              const segRatio = v / cap;
              const heightPct = (segRatio / peakRatio) * 100;
              return (
                <div
                  key={tid}
                  style={{
                    background: trackColor.get(tid),
                    height: `${heightPct}%`,
                    minHeight: 1,
                  }}
                  className="opacity-80"
                />
              );
            })}
            {/* Snug/overload top-band glow if applicable */}
            {ratio > 1.2 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-overload/10" />
            ) : ratio > 1.0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-snug/15" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
