import { describe, it, expect } from "vitest";
import type { Clip, Roadmap, Track } from "../model";
import { ClipSchema, RoadmapSchema, SettingsSchema, TrackSchema } from "../model";
import { runSequencer } from "../sequencer";

const TODAY = "2026-06-13";

function track(id: string, name: string, order: number): Track {
  return TrackSchema.parse({
    id,
    name,
    color: "#5b8def",
    order,
    updatedAt: TODAY,
  });
}

function task(
  id: string,
  trackId: string,
  start: string,
  end: string,
  extra: Partial<Clip> = {},
): Clip {
  return ClipSchema.parse({
    id,
    trackId,
    kind: "span",
    title: id,
    start,
    end,
    updatedAt: TODAY,
    ...extra,
  });
}

function roadmap(parts: Partial<Roadmap> = {}): Roadmap {
  return RoadmapSchema.parse({
    version: 3,
    settings: SettingsSchema.parse({}),
    tracks: [],
    clips: [],
    ...parts,
  });
}

describe("runSequencer", () => {
  it("returns no conflicts for an empty roadmap", () => {
    const r = runSequencer(roadmap(), TODAY);
    expect(r.conflicts).toEqual([]);
    expect(r.order).toEqual([]);
  });

  it("flags overload when stacked tasks exceed 1.2× capacity in a month", () => {
    const t = track("t1", "Career", 0);
    // Two simultaneous effort-5 tasks → 1.0 + 1.0 = 2.0× → overload
    const a = task("a", "t1", "2026-07-01", "2026-08-01", { effort: 5 });
    const b = task("b", "t1", "2026-07-01", "2026-08-01", { effort: 5 });
    const r = runSequencer(roadmap({ tracks: [t], clips: [a, b] }), TODAY);
    const over = r.conflicts.filter((c) => c.kind === "overload" && c.severity === "overload");
    expect(over.length).toBeGreaterThan(0);
  });

  it("flags snug between 1.0 and 1.2× capacity", () => {
    const t = track("t1", "Career", 0);
    // effort-5 task = 1.0/mo, stem effort 2 = 2/15 ≈ 0.133/mo. Sum ≈ 1.133 → snug.
    const a = task("a", "t1", "2026-07-01", "2026-08-01", { effort: 5 });
    const stem = ClipSchema.parse({
      id: "s1",
      trackId: "t1",
      kind: "stem",
      title: "weekly call",
      start: "2026-07-01",
      effort: 2,
      recurrence: { freq: "weekly", until: "2026-08-01", interval: 1 },
      updatedAt: TODAY,
    });
    const r = runSequencer(roadmap({ tracks: [t], clips: [a, stem] }), TODAY);
    const snug = r.conflicts.filter((c) => c.kind === "overload" && c.severity === "snug");
    expect(snug.length).toBeGreaterThan(0);
  });

  it("detects dependency cycles", () => {
    const t = track("t1", "Career", 0);
    const a = task("a", "t1", "2026-07-01", "2026-08-01", { dependsOn: ["b"] });
    const b = task("b", "t1", "2026-07-01", "2026-08-01", { dependsOn: ["a"] });
    const r = runSequencer(roadmap({ tracks: [t], clips: [a, b] }), TODAY);
    expect(r.conflicts.some((c) => c.kind === "cycle")).toBe(true);
  });

  it("detects deadline risk when a window cannot be met", () => {
    const t = track("t1", "Career", 0);
    const a = task("a", "t1", "2026-06-15", "2027-01-15", {
      window: { earliest: null, latest: "2026-09-01" },
    });
    const r = runSequencer(roadmap({ tracks: [t], clips: [a] }), TODAY);
    expect(r.conflicts.some((c) => c.kind === "deadline")).toBe(true);
  });

  it("flags silent tracks (no planned/active clip in next 12 months)", () => {
    const t = track("t1", "Untouched", 0);
    const r = runSequencer(roadmap({ tracks: [t] }), TODAY);
    expect(r.conflicts.some((c) => c.kind === "silent")).toBe(true);
  });

  it("flags transition collision when high-effort task crosses event disruption", () => {
    const t = track("t1", "Career", 0);
    const ev = ClipSchema.parse({
      id: "e1",
      trackId: "t1",
      kind: "event",
      title: "Move house",
      start: "2026-08-01",
      disruption: { monthsBefore: 1, monthsAfter: 2, capacityReduction: 0.3 },
      updatedAt: TODAY,
    });
    const hard = task("hard", "t1", "2026-07-15", "2026-10-01", { effort: 5 });
    const r = runSequencer(roadmap({ tracks: [t], clips: [ev, hard] }), TODAY);
    expect(r.conflicts.some((c) => c.kind === "transition")).toBe(true);
  });

  it("topologically orders tasks/flags by dependsOn", () => {
    const t = track("t1", "Career", 0);
    const a = task("a", "t1", "2026-07-01", "2026-08-01", { dependsOn: ["b"] });
    const b = task("b", "t1", "2026-07-01", "2026-08-01");
    const r = runSequencer(roadmap({ tracks: [t], clips: [a, b] }), TODAY);
    expect(r.order.indexOf("b")).toBeLessThan(r.order.indexOf("a"));
  });

  it("done/skipped clips do not contribute effort", () => {
    const t = track("t1", "Career", 0);
    const a = task("a", "t1", "2026-07-01", "2026-08-01", { effort: 5, status: "done" });
    const b = task("b", "t1", "2026-07-01", "2026-08-01", { effort: 5, status: "skipped" });
    const r = runSequencer(roadmap({ tracks: [t], clips: [a, b] }), TODAY);
    expect(r.conflicts.filter((c) => c.kind === "overload")).toEqual([]);
  });
});
