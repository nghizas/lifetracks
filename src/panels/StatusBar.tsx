// Slim status strip between toolbar and timeline. Shows:
//   - conflict count (tap → ConflictsSheet)
//   - "next up" chips (tap → EditClipSheet)

import { useMemo } from "react";
import {
  type Clip,
  daysBetween,
  runSequencer,
  todayStr,
} from "@/core";
import { useStore } from "@/state";

interface Props {
  onOpenConflicts: () => void;
}

export function StatusBar({ onOpenConflicts }: Props) {
  const roadmap = useStore((s) => s.roadmap);
  const openSheet = useStore((s) => s.openSheet);
  const today = todayStr();

  const result = useMemo(() => runSequencer(roadmap, today), [roadmap, today]);

  const conflictCount = result.conflicts.length;
  const worstSeverity =
    result.conflicts.find((c) => c.severity === "overload")
      ? "overload"
      : result.conflicts.find((c) => c.severity === "snug")
        ? "snug"
        : "info";

  const upNext = useMemo(() => {
    const lookahead = roadmap.settings.lookaheadDays;
    const out: { clip: Clip; days: number }[] = [];
    for (const c of roadmap.clips) {
      if (c.status === "done" || c.status === "skipped") continue;
      const d = daysBetween(today, c.start);
      if (d >= 0 && d <= lookahead) out.push({ clip: c, days: Math.round(d) });
    }
    return out.sort((a, b) => a.days - b.days).slice(0, 3);
  }, [roadmap.clips, roadmap.settings.lookaheadDays, today]);

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-ink/5 px-3 py-1.5 text-[11px]">
      {conflictCount > 0 ? (
        <button
          type="button"
          onClick={onOpenConflicts}
          className={`shrink-0 rounded-full px-2.5 py-1 font-medium ${
            worstSeverity === "overload"
              ? "bg-overload/10 text-overload"
              : worstSeverity === "snug"
                ? "bg-snug/15 text-amber-700"
                : "bg-ink/5 text-ink"
          }`}
        >
          ⚠ {conflictCount} {conflictCount === 1 ? "conflict" : "conflicts"}
        </button>
      ) : (
        <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-muted">
          all calm
        </span>
      )}

      {upNext.length > 0 ? (
        <span className="shrink-0 text-muted">·</span>
      ) : null}

      {upNext.map(({ clip, days }) => (
        <button
          key={clip.id}
          type="button"
          onClick={() => openSheet({ kind: "edit-clip", clipId: clip.id })}
          className="shrink-0 rounded-full border border-ink/10 px-2.5 py-1"
        >
          <span className="font-medium">{clip.title}</span>
          <span className="ml-1 text-muted">{relativeDayLabel(days)}</span>
        </button>
      ))}
    </div>
  );
}

function relativeDayLabel(d: number): string {
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d}d`;
}
