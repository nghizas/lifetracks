// Sub-lane assignment via greedy interval packing. Pure, no rendering concerns.
// A clip's "visual interval" is its on-screen footprint:
//   - task:  [start, end ?? start]
//   - stem:  [start, recurrence.until ?? start]
//   - event: disruption-zone span when present, else [start, start]
//   - flag:  [start, start]

import { addMonths, parseDate } from "./dates";
import type { Clip } from "./model";

export interface VisualInterval {
  start: string;
  end: string;
}

export function getVisualInterval(c: Clip): VisualInterval {
  if (c.kind === "task") {
    return { start: c.start, end: c.end ?? c.start };
  }
  if (c.kind === "stem") {
    const until = c.recurrence?.until ?? addMonths(c.start, 6);
    return { start: c.start, end: until };
  }
  if (c.kind === "event") {
    if (c.disruption) {
      return {
        start: addMonths(c.start, -c.disruption.monthsBefore),
        end: addMonths(c.start, c.disruption.monthsAfter),
      };
    }
    return { start: c.start, end: c.start };
  }
  // flag
  return { start: c.start, end: c.start };
}

export interface LanePackResult {
  laneCount: number;
  /** clip.id → 0-indexed sub-lane assignment */
  assignments: Map<string, number>;
}

/**
 * Greedy first-fit interval packing. Clips are sorted by start; each is placed
 * in the lowest-indexed lane whose last occupant ends ≤ this clip's start. A
 * new lane is opened only when no existing lane fits.
 *
 * This guarantees no two clips ever overlap visually within a lane (Phase 1
 * acceptance: "nothing ever visually overlaps").
 */
export function packIntoLanes(clips: readonly Clip[]): LanePackResult {
  const sorted = clips
    .slice()
    .sort(
      (a, b) =>
        parseDate(getVisualInterval(a).start).getTime() -
        parseDate(getVisualInterval(b).start).getTime(),
    );

  const laneEnds: string[] = [];
  const assignments = new Map<string, number>();

  for (const c of sorted) {
    const iv = getVisualInterval(c);
    let placed = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      const end = laneEnds[i];
      if (end !== undefined && parseDate(end) <= parseDate(iv.start)) {
        placed = i;
        break;
      }
    }
    if (placed === -1) {
      laneEnds.push(iv.end);
      placed = laneEnds.length - 1;
    } else {
      laneEnds[placed] = iv.end;
    }
    assignments.set(c.id, placed);
  }

  return { laneCount: laneEnds.length, assignments };
}
