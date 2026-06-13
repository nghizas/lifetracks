import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtDate,
  fmtMonthLabel,
  maxDate,
  minDate,
  monthKey,
  monthRange,
  monthsBetween,
  parseDate,
  todayStr,
} from "../dates";

describe("dates", () => {
  it("parseDate uses local midnight, fmtDate round-trips", () => {
    const s = "2026-06-13";
    expect(fmtDate(parseDate(s))).toBe(s);
  });

  it("addDays / addMonths preserve ISO format", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-03-03"); // JS quirk: Jan 31 + 1mo overflows
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("daysBetween is signed", () => {
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
    expect(daysBetween("2026-01-11", "2026-01-01")).toBe(-10);
  });

  it("monthKey + monthsBetween", () => {
    expect(monthKey("2026-06-13")).toBe("2026-06");
    expect(monthsBetween("2026-01-15", "2027-04-15")).toBe(15);
  });

  it("monthRange filters a sorted list inclusively", () => {
    const sorted = ["2026-01", "2026-02", "2026-03", "2026-04"];
    expect(monthRange("2026-02", "2026-03", sorted)).toEqual(["2026-02", "2026-03"]);
  });

  it("min/maxDate compare lexicographically (ISO order = chronological)", () => {
    expect(minDate("2026-01-01", "2026-01-02")).toBe("2026-01-01");
    expect(maxDate("2026-01-01", "2026-01-02")).toBe("2026-01-02");
  });

  it("todayStr accepts a Date for test determinism", () => {
    expect(todayStr(new Date(2026, 5, 13))).toBe("2026-06-13");
  });

  it("fmtMonthLabel returns short label", () => {
    expect(fmtMonthLabel("2026-08")).toMatch(/^[A-Z][a-z]{2} '26$/);
  });
});
