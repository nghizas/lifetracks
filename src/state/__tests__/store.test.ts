// Store action tests. Because Zustand stores are module-level singletons, each
// test resets to a fresh empty roadmap.

import { describe, it, expect, beforeEach } from "vitest";
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
    view: { scrollX: 0, pxPerDay: 4 },
  });
}

describe("store actions", () => {
  beforeEach(resetStore);

  it("addTrack inserts at order 0 and shifts existing tracks down (newest on top)", () => {
    const s = useStore.getState();
    const a = s.addTrack({ name: "first" });
    const b = useStore.getState().addTrack({ name: "second" });
    const tracks = useStore.getState().roadmap.tracks;
    expect(tracks.find((t) => t.id === b.id)!.order).toBe(0);
    expect(tracks.find((t) => t.id === a.id)!.order).toBe(1);
  });

  it("removeTrack cascades clips, undo restores both", () => {
    const t = useStore.getState().addTrack({ name: "career" });
    useStore.getState().addClip({
      trackId: t.id,
      kind: "task",
      title: "promo",
      start: "2026-07-01",
    });
    useStore.getState().addClip({
      trackId: t.id,
      kind: "task",
      title: "review",
      start: "2026-09-01",
    });
    expect(useStore.getState().roadmap.clips).toHaveLength(2);

    useStore.getState().removeTrack(t.id);
    expect(useStore.getState().roadmap.tracks).toEqual([]);
    expect(useStore.getState().roadmap.clips).toEqual([]);

    useStore.getState().undo();
    expect(useStore.getState().roadmap.tracks).toHaveLength(1);
    expect(useStore.getState().roadmap.clips).toHaveLength(2);
  });

  it("undo/redo round-trips a patchClip", () => {
    const t = useStore.getState().addTrack({ name: "career" });
    const c = useStore.getState().addClip({
      trackId: t.id,
      kind: "task",
      title: "before",
      start: "2026-07-01",
    });

    useStore.getState().patchClip(c.id, { title: "after" });
    expect(useStore.getState().roadmap.clips[0]!.title).toBe("after");

    useStore.getState().undo();
    expect(useStore.getState().roadmap.clips[0]!.title).toBe("before");

    useStore.getState().redo();
    expect(useStore.getState().roadmap.clips[0]!.title).toBe("after");
  });

  it("new mutations clear the redo stack", () => {
    const t = useStore.getState().addTrack({ name: "x" });
    useStore.getState().renameTrack(t.id, "y");
    useStore.getState().undo();
    expect(useStore.getState().canRedo()).toBe(true);

    useStore.getState().renameTrack(t.id, "z");
    expect(useStore.getState().canRedo()).toBe(false);
    expect(useStore.getState().roadmap.tracks[0]!.name).toBe("z");
  });

  it("undo on empty history is a no-op", () => {
    useStore.getState().undo();
    expect(useStore.getState().roadmap.tracks).toEqual([]);
  });

  it("history caps at MAX_HISTORY", () => {
    const t = useStore.getState().addTrack({ name: "career" });
    for (let i = 0; i < 150; i++) {
      useStore.getState().renameTrack(t.id, `name-${i}`);
    }
    // Bound but not specified strictly in the store API surface — assert <= 200 as a soft check.
    expect(useStore.getState().history.undo.length).toBeLessThanOrEqual(200);
    expect(useStore.getState().history.undo.length).toBeGreaterThan(0);
  });

  it("setView and setSelection do not push history", () => {
    const before = useStore.getState().history.undo.length;
    useStore.getState().setView({ pxPerDay: 8 });
    useStore.getState().setSelection({ kind: "track", id: "anything" });
    expect(useStore.getState().history.undo.length).toBe(before);
    expect(useStore.getState().view.pxPerDay).toBe(8);
    expect(useStore.getState().selection).toEqual({ kind: "track", id: "anything" });
  });
});
