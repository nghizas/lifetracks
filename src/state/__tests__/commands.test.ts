import { describe, it, expect } from "vitest";
import {
  RoadmapSchema,
  SettingsSchema,
  type Clip,
  type Roadmap,
  type Track,
  ClipSchema,
  TrackSchema,
} from "@/core";
import { applyCommand, type Command } from "../commands";

const NOW = "2026-06-13";

function emptyRoadmap(): Roadmap {
  return RoadmapSchema.parse({
    version: 3,
    settings: SettingsSchema.parse({}),
    tracks: [],
    clips: [],
  });
}

function makeTrack(id: string, order = 0): Track {
  return TrackSchema.parse({
    id,
    name: id,
    color: "#5b8def",
    order,
    updatedAt: NOW,
  });
}

function makeClip(id: string, trackId: string): Clip {
  return ClipSchema.parse({
    id,
    trackId,
    kind: "span",
    title: id,
    start: "2026-07-01",
    end: "2026-08-01",
    updatedAt: NOW,
  });
}

describe("applyCommand", () => {
  it("addTrack appends; duplicates are ignored", () => {
    const t = makeTrack("a");
    let r = applyCommand(emptyRoadmap(), { type: "addTrack", track: t }, NOW);
    expect(r.tracks.map((x) => x.id)).toEqual(["a"]);
    r = applyCommand(r, { type: "addTrack", track: t }, NOW);
    expect(r.tracks).toHaveLength(1);
  });

  it("removeTrack removes by id (does not cascade clips on its own)", () => {
    let r = emptyRoadmap();
    r = applyCommand(r, { type: "addTrack", track: makeTrack("a") }, NOW);
    r = applyCommand(r, { type: "addClip", clip: makeClip("c1", "a") }, NOW);
    r = applyCommand(r, { type: "removeTrack", trackId: "a" }, NOW);
    expect(r.tracks).toEqual([]);
    expect(r.clips).toHaveLength(1); // cascade is the action layer's job
  });

  it("patchTrack updates fields and stamps updatedAt", () => {
    let r = applyCommand(emptyRoadmap(), { type: "addTrack", track: makeTrack("a") }, NOW);
    r = applyCommand(
      r,
      { type: "patchTrack", trackId: "a", after: { name: "renamed" } },
      "2026-08-01",
    );
    expect(r.tracks[0]!.name).toBe("renamed");
    expect(r.tracks[0]!.updatedAt).toBe("2026-08-01");
  });

  it("reorderTracks rewrites .order and stamps updatedAt only for changed", () => {
    let r = emptyRoadmap();
    r = applyCommand(r, { type: "addTrack", track: makeTrack("a", 0) }, NOW);
    r = applyCommand(r, { type: "addTrack", track: makeTrack("b", 1) }, NOW);
    r = applyCommand(
      r,
      { type: "reorderTracks", orders: [{ id: "a", order: 1 }, { id: "b", order: 0 }] },
      "2026-08-01",
    );
    const byId = new Map(r.tracks.map((t) => [t.id, t]));
    expect(byId.get("a")!.order).toBe(1);
    expect(byId.get("b")!.order).toBe(0);
    expect(byId.get("a")!.updatedAt).toBe("2026-08-01");
  });

  it("patchClip stamps updatedAt with provided `now`", () => {
    let r = applyCommand(emptyRoadmap(), { type: "addTrack", track: makeTrack("a") }, NOW);
    r = applyCommand(r, { type: "addClip", clip: makeClip("c1", "a") }, NOW);
    r = applyCommand(
      r,
      { type: "patchClip", clipId: "c1", after: { title: "renamed" } },
      "2026-09-09",
    );
    expect(r.clips[0]!.title).toBe("renamed");
    expect(r.clips[0]!.updatedAt).toBe("2026-09-09");
  });

  it("batch applies sub-commands in order", () => {
    const t = makeTrack("a");
    const c = makeClip("c1", "a");
    const batch: Command = {
      type: "batch",
      cmds: [
        { type: "addTrack", track: t },
        { type: "addClip", clip: c },
      ],
    };
    const r = applyCommand(emptyRoadmap(), batch, NOW);
    expect(r.tracks).toHaveLength(1);
    expect(r.clips).toHaveLength(1);
  });
});
