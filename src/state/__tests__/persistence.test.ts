import { describe, it, expect, beforeEach } from "vitest";
import { RoadmapSchema, SettingsSchema, type Roadmap } from "@/core";
import { FakeAdapter } from "@/storage";
import { useStore } from "../store";
import { bindPersistence } from "../persistence";

function resetStore(): void {
  useStore.setState({
    roadmap: RoadmapSchema.parse({
      version: 3,
      settings: SettingsSchema.parse({}),
      tracks: [],
      clips: [],
    }),
    ready: false,
    history: { undo: [], redo: [] },
    selection: null,
    view: { scrollX: 0, pxPerDay: 10, headerWidth: 124 },
  });
}

function buildSeed(): Roadmap {
  return RoadmapSchema.parse({
    version: 3,
    settings: SettingsSchema.parse({}),
    tracks: [
      {
        id: "t1",
        name: "Career",
        color: "#5b8def",
        order: 0,
        updatedAt: "2026-06-13",
      },
    ],
    clips: [],
  });
}

describe("bindPersistence", () => {
  beforeEach(resetStore);

  it("hydrates the store with the adapter's loaded roadmap", async () => {
    const adapter = new FakeAdapter(buildSeed());
    const dispose = bindPersistence(adapter);
    // Wait a tick for the async load() to resolve.
    await Promise.resolve();
    await Promise.resolve();
    expect(useStore.getState().ready).toBe(true);
    expect(useStore.getState().roadmap.tracks).toHaveLength(1);
    dispose();
  });

  it("saves after a mutation", async () => {
    const adapter = new FakeAdapter(null);
    const dispose = bindPersistence(adapter);
    await Promise.resolve();
    await Promise.resolve();

    useStore.getState().addTrack({ name: "Health" });
    // Allow the save queue's microtask to flush.
    await new Promise((r) => setTimeout(r, 0));
    const reloaded = await adapter.load();
    expect(reloaded?.tracks).toHaveLength(1);
    expect(reloaded?.tracks[0]?.name).toBe("Health");
    dispose();
  });
});
