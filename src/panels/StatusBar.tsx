// Up-next strip. Conflict surfacing was deliberately removed (calm-over-complete
// pass) — the sequencer still runs in core for the balance meter, but its
// findings no longer escalate to a worry-state chip in the chrome.

import { useMemo } from "react";
import { type Clip, daysBetween, todayStr } from "@/core";
import { useStore } from "@/state";

export function StatusBar() {
  const clips = useStore((s) => s.roadmap.clips);
  const lookahead = useStore((s) => s.roadmap.settings.lookaheadDays);
  const openSheet = useStore((s) => s.openSheet);
  const today = todayStr();

  const upNext = useMemo(() => {
    const out: { clip: Clip; days: number }[] = [];
    for (const c of clips) {
      if (c.status === "done" || c.status === "skipped") continue;
      const d = daysBetween(today, c.start);
      if (d >= 0 && d <= lookahead) out.push({ clip: c, days: Math.round(d) });
    }
    return out.sort((a, b) => a.days - b.days).slice(0, 4);
  }, [clips, lookahead, today]);

  if (upNext.length === 0) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-ink/5 px-4 py-2 text-[12px] text-muted">
        <span>Nothing on deck yet.</span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-ink/5 px-3 py-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Up next
      </span>
      {upNext.map(({ clip, days }) => (
        <button
          key={clip.id}
          type="button"
          onClick={() => openSheet({ kind: "edit-clip", clipId: clip.id })}
          className="shrink-0 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[13px]"
        >
          <span className="font-medium">{clip.title}</span>
          <span className="ml-2 text-muted">{relativeDayLabel(days)}</span>
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
