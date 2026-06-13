import { describe, it, expect } from "vitest";
import {
  clampPxPerDay,
  dateForScreenX,
  PX_PER_DAY_MAX,
  PX_PER_DAY_MIN,
  screenXForDate,
  worldXForDate,
} from "../coords";

describe("coords", () => {
  it("worldX scales linearly with pxPerDay", () => {
    expect(worldXForDate("2026-01-01", "2026-01-11", 4)).toBe(40);
    expect(worldXForDate("2026-01-01", "2026-01-11", 8)).toBe(80);
  });

  it("screenX subtracts scrollX", () => {
    expect(screenXForDate("2026-01-01", "2026-01-11", 4, 30)).toBe(10);
  });

  it("dateForScreenX is the inverse of screenXForDate", () => {
    const origin = "2026-01-01";
    const pxPerDay = 4;
    const scrollX = 23;
    const date = "2026-03-15";
    const x = screenXForDate(origin, date, pxPerDay, scrollX);
    expect(dateForScreenX(origin, x, pxPerDay, scrollX)).toBe(date);
  });

  it("clampPxPerDay enforces bounds", () => {
    expect(clampPxPerDay(0.001)).toBe(PX_PER_DAY_MIN);
    expect(clampPxPerDay(1000)).toBe(PX_PER_DAY_MAX);
    expect(clampPxPerDay(8)).toBe(8);
  });
});
