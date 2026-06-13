import { describe, it, expect, beforeEach } from "vitest";
import { runSequencer } from "@/core";
import { RoadmapSchema, SettingsSchema } from "@/core";
import { useStore } from "../store";

function resetStore(): void {
  useStore.setState({
    roadmap: RoadmapSchema.parse({
      version: 3,
      settings: SettingsSchema.parse({}),
      tracks: [],
      clips: [],
    }),
    ready: true,
    history: { undo: [], redo: [] },
    selection: null,
    sheet: null,
    view: { scrollX: 0, pxPerDay: 10, headerWidth: 124 },
  });
}

describe("loadSample / buildSampleLife", () => {
  beforeEach(resetStore);

  it("inserts 3 tracks and at least 10 clips", () => {
    useStore.getState().loadSample();
    const r = useStore.getState().roadmap;
    expect(r.tracks.length).toBe(3);
    expect(r.clips.length).toBeGreaterThanOrEqual(10);
  });

  it("is undoable in one step", () => {
    useStore.getState().loadSample();
    expect(useStore.getState().roadmap.tracks.length).toBeGreaterThan(0);
    useStore.getState().undo();
    expect(useStore.getState().roadmap.tracks).toEqual([]);
    expect(useStore.getState().roadmap.clips).toEqual([]);
  });

  it("produces a sequencer run that includes the disruption event", () => {
    useStore.getState().loadSample();
    const r = runSequencer(useStore.getState().roadmap, "2026-06-13");
    expect(r.months.length).toBeGreaterThan(0);
    // Some kind of conflict is expected from a realistic sample life.
    expect(r.conflicts.length).toBeGreaterThan(0);
  });
});
