import { describe, it, expect } from "vitest";
import { occurrences } from "../recurrence";

describe("recurrence.occurrences", () => {
  it("weekly with default interval enumerates every 7 days", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "weekly", until: "2026-01-29", interval: 1, count: 1 },
      "2026-12-31",
    );
    expect(out).toEqual(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"]);
  });

  it("respects `until` (occurrences past it are dropped)", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "weekly", until: "2026-01-21", interval: 1, count: 1 },
      "2026-12-31",
    );
    expect(out.at(-1)).toBe("2026-01-15");
  });

  it("respects `upTo` (caller-supplied ceiling)", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "weekly", until: "2026-12-31", interval: 1, count: 1 },
      "2026-01-15",
    );
    expect(out.at(-1)).toBe("2026-01-15");
  });

  it("monthly recurrence", () => {
    const out = occurrences(
      "2026-01-15",
      { freq: "monthly", until: "2026-06-30", interval: 1, count: 1 },
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
      { freq: "biweekly", until: "2026-03-01", interval: 1, count: 1 },
      "2026-12-31",
    );
    // every 14 days
    expect(out).toEqual(["2026-01-01", "2026-01-15", "2026-01-29", "2026-02-12", "2026-02-26"]);
  });

  it("daily honours interval", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "daily", until: "2026-01-10", interval: 3, count: 1 },
      "2026-12-31",
    );
    expect(out).toEqual(["2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10"]);
  });

  it("count > 1 distributes that many occurrences evenly within each period", () => {
    const out = occurrences(
      "2026-01-05",
      { freq: "weekly", until: "2026-01-19", interval: 1, count: 3 },
      "2026-12-31",
    );
    // Week from Jan 5: round(0 * 7/3)=0, round(7/3)=2, round(14/3)=5 → Jan 5, 7, 10
    // Week from Jan 12: Jan 12, 14, 17
    // Week from Jan 19: Jan 19 (Jan 21 past until)
    expect(out).toEqual([
      "2026-01-05",
      "2026-01-07",
      "2026-01-10",
      "2026-01-12",
      "2026-01-14",
      "2026-01-17",
      "2026-01-19",
    ]);
  });

  it("monthly with count > 1 distributes across each calendar month", () => {
    const out = occurrences(
      "2026-01-01",
      { freq: "monthly", until: "2026-02-28", interval: 1, count: 4 },
      "2026-12-31",
    );
    // Jan: 31 days, gap 7.75 → offsets 0, 8, 16, 23 → Jan 1, 9, 17, 24
    // Feb: 28 days, gap 7 → offsets 0, 7, 14, 21 → Feb 1, 8, 15, 22
    expect(out).toEqual([
      "2026-01-01",
      "2026-01-09",
      "2026-01-17",
      "2026-01-24",
      "2026-02-01",
      "2026-02-08",
      "2026-02-15",
      "2026-02-22",
    ]);
  });
});
