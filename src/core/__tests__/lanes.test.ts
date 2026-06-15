import { describe, it, expect } from "vitest";
import { getVisualInterval, packIntoLanes } from "../lanes";
import type { Clip } from "../model";
import { ClipSchema } from "../model";

function task(id: string, start: string, end: string, trackId = "t1"): Clip {
  return ClipSchema.parse({
    id,
    trackId,
    kind: "span",
    title: id,
    start,
    end,
    updatedAt: "2026-06-13",
  });
}

describe("lanes.getVisualInterval", () => {
  it("task uses [start, end ?? start]", () => {
    const c = task("a", "2026-01-01", "2026-02-01");
    expect(getVisualInterval(c)).toEqual({ start: "2026-01-01", end: "2026-02-01" });
  });

  it("event with disruption uses the disruption span", () => {
    const ev = ClipSchema.parse({
      id: "e1",
      trackId: "t1",
      kind: "event",
      title: "Wedding",
      start: "2026-06-01",
      disruption: { monthsBefore: 1, monthsAfter: 2, capacityReduction: 0.3 },
      updatedAt: "2026-06-13",
    });
    expect(getVisualInterval(ev)).toEqual({ start: "2026-05-01", end: "2026-08-01" });
  });
});

describe("lanes.packIntoLanes", () => {
  it("non-overlapping clips share a single lane", () => {
    const r = packIntoLanes([
      task("a", "2026-01-01", "2026-02-01"),
      task("b", "2026-02-15", "2026-03-15"),
      task("c", "2026-04-01", "2026-05-01"),
    ]);
    expect(r.laneCount).toBe(1);
    for (const v of r.assignments.values()) expect(v).toBe(0);
  });

  it("overlapping clips get distinct lanes (no visual overlap)", () => {
    const r = packIntoLanes([
      task("a", "2026-01-01", "2026-06-01"),
      task("b", "2026-02-01", "2026-04-01"),
      task("c", "2026-03-01", "2026-05-01"),
    ]);
    expect(r.laneCount).toBe(3);
    expect(new Set(r.assignments.values()).size).toBe(3);
  });

  it("touching at endpoints is allowed in the same lane (end <= next start)", () => {
    const r = packIntoLanes([
      task("a", "2026-01-01", "2026-02-01"),
      task("b", "2026-02-01", "2026-03-01"),
    ]);
    expect(r.laneCount).toBe(1);
  });
});
