// Stacked effort share per month, per track. Honest density of where the
// roadmap is full vs. open — no threshold lines, no danger colors. The
// sequencer's worry framing was removed in the calm-over-complete pass.

import { useMemo } from "react";
import { runSequencer, todayStr } from "@/core";
import { useStore } from "@/state";

interface Props {
  height?: number;
}

export function BalanceMeter({ height = 64 }: Props) {
  const roadmap = useStore((s) => s.roadmap);
  const today = todayStr();
  const result = useMemo(() => runSequencer(roadmap, today), [roadmap, today]);

  const months = useMemo(() => {
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

  const peak = Math.max(
    1.0,
    ...months.map((m) => result.totalByMonth.get(m) ?? 0),
  );

  const barWidth = `${100 / months.length}%`;

  return (
    <div
      className="flex items-end gap-1 border-t border-ink/5 bg-white px-2 py-1"
      style={{ height }}
      title="12-month effort balance"
    >
      {months.map((m) => {
        return (
          <div
            key={m}
            className="relative flex h-full flex-col-reverse rounded-sm bg-ink/[0.03]"
            style={{ width: barWidth }}
          >
            {trackOrder.map((tid) => {
              const inner = result.effortByTrackByMonth.get(tid);
              const v = inner?.get(m) ?? 0;
              if (v <= 0) return null;
              const heightPct = (v / peak) * 100;
              return (
                <div
                  key={tid}
                  style={{
                    background: trackColor.get(tid),
                    height: `${heightPct}%`,
                    minHeight: 1,
                  }}
                  className="opacity-85"
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
