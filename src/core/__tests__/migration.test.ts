// Phase 0 acceptance: "v2 JSON export round-trips into the new model in tests."

import { describe, it, expect } from "vitest";
import { RoadmapSchema, migrateV2 } from "../model";

const NOW = "2026-06-13";

const V2_EXPORT = {
  version: 2,
  settings: {
    apiKey: null,
    horizonYears: 5,
    weeklyCapacity: 1.0,
    lookaheadDays: 14,
  },
  tracks: [
    {
      id: "tr-career",
      name: "Career",
      color: "#5b8def",
      order: 0,
      muted: false,
      soloed: false,
      collapsed: false,
      notes: "promotion track",
    },
    {
      id: "tr-fatherhood",
      name: "Fatherhood",
      color: "#81b29a",
      order: 1,
    },
  ],
  clips: [
    {
      id: "c-promo",
      trackId: "tr-career",
      kind: "goal", // → task
      title: "Promo packet",
      start: "2026-07-01",
      end: "2026-12-01",
      effort: 4,
      dependsOn: [],
      status: "planned",
      source: "manual",
    },
    {
      id: "c-walk",
      trackId: "tr-fatherhood",
      kind: "recurring", // → stem
      title: "Sunday walk",
      start: "2026-06-15",
      effort: 2,
      recurrence: { freq: "weekly", until: "2027-06-15" },
      status: "active",
    },
    {
      id: "c-baby",
      trackId: "tr-fatherhood",
      kind: "event",
      title: "Baby arrives",
      start: "2026-11-01",
      disruption: { monthsBefore: 1, monthsAfter: 3, capacityReduction: 0.4 },
    },
    {
      id: "c-flag",
      trackId: "tr-career",
      kind: "milestone", // → flag
      title: "Self-review submitted",
      start: "2026-09-15",
    },
    {
      id: "c-orphan",
      trackId: "tr-career",
      kind: "goal",
      title: "Learn distributed systems",
      start: "2026-08-01",
      end: "2026-12-01",
      effort: 3,
      dependsOn: ["does-not-exist"], // dangling — should survive migration (sequencer filters)
    },
  ],
  chat: [{ role: "user", text: "ignored on import" }], // v2 had a chat array; v3 drops it
};

describe("migrateV2 round-trip", () => {
  it("accepts the v2 export shape and produces a valid v3 Roadmap", () => {
    const v3 = migrateV2(V2_EXPORT, NOW);
    // The result must be a valid v3 Roadmap (re-parsing is the contract).
    const reparsed = RoadmapSchema.parse(v3);
    expect(reparsed.version).toBe(3);
  });

  it("renames kinds: goal→span, recurring→stem, milestone→flag, event→event", () => {
    const v3 = migrateV2(V2_EXPORT, NOW);
    const byId = new Map(v3.clips.map((c) => [c.id, c]));
    expect(byId.get("c-promo")?.kind).toBe("span");
    expect(byId.get("c-walk")?.kind).toBe("stem");
    expect(byId.get("c-baby")?.kind).toBe("event");
    expect(byId.get("c-flag")?.kind).toBe("flag");
  });

  it("renames settings.weeklyCapacity → settings.monthlyCapacity (number preserved)", () => {
    const v3 = migrateV2(V2_EXPORT, NOW);
    expect(v3.settings.monthlyCapacity).toBe(1.0);
  });

  it("stamps updatedAt with the migration time and starts deletedAt = null", () => {
    const v3 = migrateV2(V2_EXPORT, NOW);
    for (const t of v3.tracks) {
      expect(t.updatedAt).toBe(NOW);
      expect(t.deletedAt).toBeNull();
    }
    for (const c of v3.clips) {
      expect(c.updatedAt).toBe(NOW);
      expect(c.deletedAt).toBeNull();
    }
  });

  it("preserves clip metadata (title, start, end, effort, recurrence, disruption)", () => {
    const v3 = migrateV2(V2_EXPORT, NOW);
    const byId = new Map(v3.clips.map((c) => [c.id, c]));
    const promo = byId.get("c-promo")!;
    expect(promo.title).toBe("Promo packet");
    expect(promo.start).toBe("2026-07-01");
    expect(promo.end).toBe("2026-12-01");
    expect(promo.effort).toBe(4);
    const walk = byId.get("c-walk")!;
    expect(walk.recurrence).toEqual({ freq: "weekly", until: "2027-06-15", interval: 1, count: 1 });
    const baby = byId.get("c-baby")!;
    expect(baby.disruption).toEqual({
      monthsBefore: 1,
      monthsAfter: 3,
      capacityReduction: 0.4,
    });
  });

  it("is idempotent when given an already-v3 input", () => {
    const v3 = migrateV2(V2_EXPORT, NOW);
    const again = migrateV2(v3, "2099-01-01");
    expect(again).toEqual(v3); // already-v3 short-circuits → updatedAt is NOT restamped
  });

  it("survives a missing/garbage input by producing an empty valid Roadmap", () => {
    expect(() => RoadmapSchema.parse(migrateV2({}, NOW))).not.toThrow();
    expect(() => RoadmapSchema.parse(migrateV2(null, NOW))).not.toThrow();
  });
});
