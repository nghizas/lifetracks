import { describe, it, expect } from "vitest";
import {
  type Clip,
  type Track,
  ClipSchema,
  TrackSchema,
} from "@/core";
import {
  FLAG_LANE_HEIGHT,
  LANE_HEIGHT,
  computeTrackLayouts,
} from "../layout";

const NOW = "2026-06-13";

function track(id: string, order = 0, collapsed = false): Track {
  return TrackSchema.parse({
    id,
    name: id,
    color: "#5b8def",
    order,
    collapsed,
    updatedAt: NOW,
  });
}

function task(id: string, trackId: string, start: string, end: string): Clip {
  return ClipSchema.parse({
    id,
    trackId,
    kind: "task",
    title: id,
    start,
    end,
    updatedAt: NOW,
  });
}

function flag(id: string, trackId: string, start: string): Clip {
  return ClipSchema.parse({
    id,
    trackId,
    kind: "flag",
    title: id,
    start,
    updatedAt: NOW,
  });
}

describe("computeTrackLayouts", () => {
  it("empty track gets minimum height", () => {
    const r = computeTrackLayouts([track("t1")], []);
    expect(r.totalHeight).toBe(LANE_HEIGHT);
    const lay = r.layouts.get("t1")!;
    expect(lay.taskLaneCount).toBe(0);
    expect(lay.height).toBe(LANE_HEIGHT);
  });

  it("non-overlapping tasks share a lane → height = LANE_HEIGHT", () => {
    const r = computeTrackLayouts(
      [track("t1")],
      [
        task("a", "t1", "2026-01-01", "2026-02-01"),
        task("b", "t1", "2026-02-15", "2026-03-15"),
      ],
    );
    expect(r.totalHeight).toBe(LANE_HEIGHT);
    expect(r.layouts.get("t1")!.taskLaneCount).toBe(1);
  });

  it("overlapping tasks open extra lanes → height grows", () => {
    const r = computeTrackLayouts(
      [track("t1")],
      [
        task("a", "t1", "2026-01-01", "2026-06-01"),
        task("b", "t1", "2026-02-01", "2026-04-01"),
        task("c", "t1", "2026-03-01", "2026-05-01"),
      ],
    );
    expect(r.layouts.get("t1")!.taskLaneCount).toBe(3);
    expect(r.totalHeight).toBe(3 * LANE_HEIGHT);
  });

  it("flag lane is added above task lanes when flags present", () => {
    const r = computeTrackLayouts(
      [track("t1")],
      [
        flag("f1", "t1", "2026-03-01"),
        task("a", "t1", "2026-01-01", "2026-06-01"),
      ],
    );
    const lay = r.layouts.get("t1")!;
    expect(lay.flagLaneY).toBe(0);
    expect(lay.taskLaneStartY).toBe(FLAG_LANE_HEIGHT);
    expect(lay.height).toBe(FLAG_LANE_HEIGHT + LANE_HEIGHT);
  });

  it("collapsed track uses fixed thin height", () => {
    const r = computeTrackLayouts(
      [track("t1", 0, true)],
      [task("a", "t1", "2026-01-01", "2026-06-01")],
    );
    const lay = r.layouts.get("t1")!;
    expect(lay.collapsed).toBe(true);
    expect(lay.taskLaneCount).toBe(0);
  });

  it("multiple tracks stack vertically using yStart from prior heights", () => {
    const r = computeTrackLayouts(
      [track("t1", 0), track("t2", 1)],
      [
        task("a", "t1", "2026-01-01", "2026-06-01"),
        task("b", "t1", "2026-02-01", "2026-04-01"),
        task("c", "t2", "2026-01-01", "2026-02-01"),
      ],
    );
    const t1 = r.layouts.get("t1")!;
    const t2 = r.layouts.get("t2")!;
    expect(t2.yStart).toBe(t1.yStart + t1.height);
  });
});
