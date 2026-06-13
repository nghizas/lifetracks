import { describe, it, expect } from "vitest";
import { occurrences } from "../recurrence";

describe("recurrence.occurrences", () => {
  it("weekly with default interval enumerates every 7 days", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "weekly", until: "2026-01-29", interval: 1 },
      "2026-12-31",
    );
    expect(out).toEqual(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"]);
  });

  it("respects `until` (occurrences past it are dropped)", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "weekly", until: "2026-01-21", interval: 1 },
      "2026-12-31",
    );
    expect(out.at(-1)).toBe("2026-01-15");
  });

  it("respects `upTo` (caller-supplied ceiling)", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "weekly", until: "2026-12-31", interval: 1 },
      "2026-01-15",
    );
    expect(out.at(-1)).toBe("2026-01-15");
  });

  it("monthly recurrence", () => {
    const out = occurrences(
      "2026-01-15",
      { freq: "monthly", until: "2026-06-30", interval: 1 },
      "2026-12-31",
    );
    expect(out).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
      "2026-06-15",
    ]);
  });

  it("biweekly with interval 2 = monthly-ish", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "biweekly", until: "2026-03-01", interval: 1 },
      "2026-12-31",
    );
    // every 14 days
    expect(out).toEqual(["2026-01-01", "2026-01-15", "2026-01-29", "2026-02-12", "2026-02-26"]);
  });

  it("daily honours interval", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "daily", until: "2026-01-10", interval: 3 },
      "2026-12-31",
    );
    expect(out).toEqual(["2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10"]);
  });
});
