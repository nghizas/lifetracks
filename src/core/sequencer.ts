// Deterministic sequencer — capacity, conflicts, placements.
//
// Pure function: `(roadmap, today) => SequencerResult`.
// Ported faithfully from the v2 prototype's `runSequencer`, with vocabulary
// updated to v3 (task/stem/flag/event) and `today` threaded as an argument so
// the function is fully deterministic (no `new Date()` inside).
//
// Capacity bands (per spec):
//   ratio ≤ 1.0           → fine, no conflict
//   1.0 < ratio ≤ 1.2     → SNUG  ("tight but plausible")  · yellow
//   ratio > 1.2           → OVER                            · red
// Effort weighting:
//   task = effort/5  per month over [start, end]
//   stem = effort/15 per month over [start, until]
// Event disruption zones reduce capacity multiplicatively with a 0.1 floor.

import { addMonths, daysBetween, fmtMonthLabel, monthKey, monthRange, parseDate } from "./dates";
import type { Clip, Roadmap, Track } from "./model";

/* ------------------------------------------------------------------- types */

export type ConflictSeverity = "snug" | "overload" | "info";

export type Conflict =
  | {
      kind: "overload";
      severity: "snug" | "overload";
      msg: string;
      months: string[];
    }
  | {
      kind: "transition";
      severity: "info";
      msg: string;
      clipIds: string[];
    }
  | {
      kind: "deadline";
      severity: "info";
      msg: string;
      clipIds: string[];
    }
  | {
      kind: "silent";
      severity: "info";
      msg: string;
      trackId: string;
    }
  | {
      kind: "cycle";
      severity: "info";
      msg: string;
      clipIds: string[];
    };

export interface SequencerResult {
  /** Topologically-sorted ids of task/flag clips (dependency-respecting). */
  order: string[];
  conflicts: Conflict[];
  /** trackId → (monthKey → effort 0..N). */
  effortByTrackByMonth: Map<string, Map<string, number>>;
  /** monthKey → effective capacity after event disruption. */
  capByMonth: Map<string, number>;
  /** monthKey → total cross-track load. */
  totalByMonth: Map<string, number>;
  /** Sorted month keys spanning the planning horizon. */
  months: string[];
}

/* --------------------------------------------------------------- sequencer */

export function runSequencer(roadmap: Roadmap, today: string): SequencerResult {
  const { settings, tracks, clips } = roadmap;
  const conflicts: Conflict[] = [];
  const clipById = new Map<string, Clip>(clips.map((c) => [c.id, c]));
  const trackById = new Map<string, Track>(tracks.map((t) => [t.id, t]));
  void trackById;

  // 1. Topological sort of task/flag by dependsOn (cycle detection).
  const graph = new Map<string, Set<string>>();
  const nodes = clips.filter((c) => c.kind === "span" || c.kind === "flag");
  for (const c of nodes) {
    graph.set(
      c.id,
      new Set((c.dependsOn ?? []).filter((d) => clipById.has(d))),
    );
  }
  const order: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycleHit = false;
  const visit = (id: string): void => {
    if (cycleHit || visited.has(id)) return;
    if (visiting.has(id)) {
      conflicts.push({
        kind: "cycle",
        severity: "info",
        clipIds: [id],
        msg: `Dependency cycle involving "${clipById.get(id)?.title ?? id}"`,
      });
      cycleHit = true;
      return;
    }
    visiting.add(id);
    for (const d of graph.get(id) ?? []) visit(d);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  };
  for (const id of graph.keys()) visit(id);

  // 2. Capacity model per month across the planning horizon.
  const horizonMonths = settings.horizonYears * 12;
  const baseStartDate = parseDate(today);
  baseStartDate.setDate(1);
  const months: string[] = [];
  for (let i = -6; i < horizonMonths; i++) {
    const d = new Date(baseStartDate);
    d.setMonth(d.getMonth() + i);
    months.push(monthKey(toIsoDate(d)));
  }

  const baseCap = settings.monthlyCapacity;
  const capByMonth = new Map<string, number>(months.map((m) => [m, baseCap]));

  // Event disruption — compounding multiplicative reduction, floored at 0.1.
  const liveEvents = clips.filter(
    (c) => c.kind === "event" && c.disruption && c.status !== "skipped",
  );
  for (const ev of liveEvents) {
    const d = ev.disruption!;
    const zStart = addMonths(ev.start, -d.monthsBefore);
    const zEnd = addMonths(ev.start, d.monthsAfter);
    const r = clamp01(d.capacityReduction);
    for (const m of months) {
      const md = m + "-15";
      if (parseDate(md) >= parseDate(zStart) && parseDate(md) <= parseDate(zEnd)) {
        const cur = capByMonth.get(m) ?? baseCap;
        capByMonth.set(m, Math.max(0.1, cur * (1 - r)));
      }
    }
  }

  // 3. Effort per track per month (tasks and stems).
  const effortByTrackByMonth = new Map<string, Map<string, number>>();
  const addEffort = (trackId: string, mKey: string, amount: number): void => {
    let inner = effortByTrackByMonth.get(trackId);
    if (!inner) {
      inner = new Map();
      effortByTrackByMonth.set(trackId, inner);
    }
    inner.set(mKey, (inner.get(mKey) ?? 0) + amount);
  };

  for (const c of clips) {
    if (c.status === "done" || c.status === "skipped") continue;
    const e = clampEffort(c.effort);
    if (c.kind === "span") {
      const startD = parseDate(c.start);
      const endD = parseDate(c.end ?? c.start);
      const perMonth = e / 5;
      for (const m of months) {
        const md0 = parseDate(m + "-01");
        const md1 = parseDate(addMonths(m + "-01", 1));
        if (md1 <= startD) continue;
        if (md0 >= endD) continue;
        addEffort(c.trackId, m, perMonth);
      }
    } else if (c.kind === "stem" && c.recurrence) {
      const startD = parseDate(c.start);
      const until = parseDate(c.recurrence.until);
      const perMonth = e / 15;
      for (const m of months) {
        const md0 = parseDate(m + "-01");
        const md1 = parseDate(addMonths(m + "-01", 1));
        if (md1 <= startD) continue;
        if (md0 >= until) continue;
        addEffort(c.trackId, m, perMonth);
      }
    }
  }

  // Cross-track total monthly load.
  const totalByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const inner of effortByTrackByMonth.values()) {
    for (const [m, v] of inner) {
      totalByMonth.set(m, (totalByMonth.get(m) ?? 0) + v);
    }
  }

  // 3a. Capacity bands → contiguous-run conflicts with peak.
  const sortedMonths = months.slice().sort();
  type Band = "snug" | "overload";
  const bandFor = (ratio: number): Band | null => {
    if (ratio > 1.2) return "overload";
    if (ratio > 1.0 + 1e-6) return "snug";
    return null;
  };
  interface Run {
    band: Band;
    start: string;
    end: string;
    peak: number;
    peakMonth: string;
  }
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (const m of sortedMonths) {
    const total = totalByMonth.get(m) ?? 0;
    const cap = capByMonth.get(m) ?? baseCap;
    const ratio = cap > 0 ? total / cap : 0;
    const b = bandFor(ratio);
    const curBand: Band | null = cur === null ? null : cur.band;
    if (b !== curBand) {
      if (cur !== null) runs.push(cur);
      cur = b === null ? null : { band: b, start: m, end: m, peak: ratio, peakMonth: m };
    } else if (b !== null && cur !== null) {
      cur.end = m;
      if (ratio > cur.peak) {
        cur.peak = ratio;
        cur.peakMonth = m;
      }
    }
  }
  if (cur !== null) runs.push(cur);

  for (const r of runs) {
    const range =
      r.start === r.end ? fmtMonthLabel(r.start) : `${fmtMonthLabel(r.start)} – ${fmtMonthLabel(r.end)}`;
    const peak = `peak ${r.peak.toFixed(2)}× in ${fmtMonthLabel(r.peakMonth)}`;
    if (r.band === "overload") {
      conflicts.push({
        kind: "overload",
        severity: "overload",
        msg: `Over capacity ${range} (${peak}). Try a defer, a shorter span, or a lower-effort.`,
        months: monthRange(r.start, r.end, sortedMonths),
      });
    } else {
      conflicts.push({
        kind: "overload",
        severity: "snug",
        msg: `Snug ${range} (${peak}) — tight but plausible. A coach would watch, not panic.`,
        months: monthRange(r.start, r.end, sortedMonths),
      });
    }
  }

  // 3b. Transition collision — high-effort task (≥4) intersects an event's disruption zone.
  for (const ev of liveEvents) {
    const d = ev.disruption!;
    const zStart = addMonths(ev.start, -d.monthsBefore);
    const zEnd = addMonths(ev.start, d.monthsAfter);
    for (const t of clips) {
      if (t.kind !== "span") continue;
      if (t.status === "done" || t.status === "skipped") continue;
      if (t.effort < 4) continue;
      if (parseDate(t.start) > parseDate(zEnd)) continue;
      if (parseDate(t.end ?? t.start) < parseDate(zStart)) continue;
      conflicts.push({
        kind: "transition",
        severity: "info",
        clipIds: [t.id, ev.id],
        msg: `"${t.title}" (effort ${t.effort}) overlaps the disruption zone of "${ev.title}"`,
      });
    }
  }

  // 3c. Deadline risk — dependency chain + duration won't fit before window.latest.
  for (const c of clips) {
    if (!c.window?.latest) continue;
    if (c.status === "done" || c.status === "skipped") continue;
    const dur = c.end ? daysBetween(c.start, c.end) : 0;
    let earliest = parseDate(c.start);
    for (const depId of c.dependsOn) {
      const dep = clipById.get(depId);
      if (!dep) continue;
      const depEnd = parseDate(dep.end ?? dep.start);
      if (depEnd > earliest) earliest = depEnd;
    }
    const finish = new Date(earliest.getTime() + dur * 86_400_000);
    if (finish > parseDate(c.window.latest)) {
      conflicts.push({
        kind: "deadline",
        severity: "info",
        clipIds: [c.id],
        msg: `"${c.title}" can't finish by ${c.window.latest} given dependencies and duration`,
      });
    }
  }

  // 3d. Silent track — no planned/active clip in the next 12 months. Skip muted.
  const horizon12 = addMonths(today, 12);
  for (const t of tracks) {
    if (t.muted) continue;
    const has = clips.some(
      (c) =>
        c.trackId === t.id &&
        (c.status === "planned" || c.status === "active") &&
        parseDate(c.start) <= parseDate(horizon12) &&
        parseDate(c.end ?? c.start) >= parseDate(today),
    );
    if (!has) {
      conflicts.push({
        kind: "silent",
        severity: "info",
        trackId: t.id,
        msg: `Track "${t.name}" has nothing planned in the next 12 months`,
      });
    }
  }

  return { order, conflicts, effortByTrackByMonth, capByMonth, totalByMonth, months };
}

/* ---------------------------------------------------------------- helpers */

function clampEffort(e: number): number {
  return Math.max(1, Math.min(5, Math.round(e)));
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function toIsoDate(d: Date): string {
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
