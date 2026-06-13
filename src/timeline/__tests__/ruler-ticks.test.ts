import { describe, it, expect } from "vitest";
import { generateTicks, scaleForPxPerDay } from "../ruler-ticks";

describe("scaleForPxPerDay", () => {
  it("maps pxPerDay into the five accordion levels", () => {
    expect(scaleForPxPerDay(0.3)).toBe("decade");
    expect(scaleForPxPerDay(1)).toBe("year");
    expect(scaleForPxPerDay(4)).toBe("quarter");
    expect(scaleForPxPerDay(12)).toBe("month");
    expect(scaleForPxPerDay(30)).toBe("week");
  });
});

describe("generateTicks", () => {
  it("year scale emits one tick per year (inclusive of bounds)", () => {
    const ticks = generateTicks("2026-03-15", "2028-09-01", "year");
    expect(ticks.map((t) => t.label)).toEqual(["2026", "2027", "2028", "2029"]);
    expect(ticks.every((t) => t.major)).toBe(true);
  });

  it("quarter scale emits Q-labels with year context on every tick", () => {
    const ticks = generateTicks("2026-01-15", "2026-12-31", "quarter");
    const labels = ticks.map((t) => t.label);
    expect(labels).toContain("Q1 2026");
    expect(labels).toContain("Q2 '26");
    expect(labels).toContain("Q3 '26");
    expect(labels).toContain("Q4 '26");
    const yearTick = ticks.find((t) => t.label === "Q1 2026")!;
    expect(yearTick.major).toBe(true);
  });

  it("month scale emits one tick per month, January carries the year", () => {
    const ticks = generateTicks("2026-06-15", "2026-10-15", "month");
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    // No January in the range, so no "Jan 2026" tick
    expect(ticks.find((t) => t.label.startsWith("Jan "))).toBeUndefined();
  });

  it("month scale labels January with the year", () => {
    const ticks = generateTicks("2025-11-01", "2026-04-01", "month");
    expect(ticks.find((t) => t.label === "Jan 2026")).toBeDefined();
  });

  it("week scale anchors on Monday", () => {
    const ticks = generateTicks("2026-06-01", "2026-06-30", "week");
    for (const t of ticks) {
      const d = new Date(t.date + "T00:00:00");
      expect(d.getDay()).toBe(1); // Monday
    }
  });

  it("decade scale labels look like 2020s, 2030s", () => {
    const ticks = generateTicks("2026-01-01", "2035-12-31", "decade");
    expect(ticks.map((t) => t.label)).toEqual(["2020s", "2030s", "2040s"]);
  });
});
