// Accordion ruler — generates date ticks at the appropriate scale.
// Pure: input is a date range + scale; output is { date, label, major } ticks.

import { addDays, addMonths, fmtDate, parseDate } from "@/core";

export type RulerScale = "decade" | "year" | "quarter" | "month" | "week";

export function scaleForPxPerDay(pxPerDay: number): RulerScale {
  if (pxPerDay < 0.6) return "decade";
  if (pxPerDay < 2) return "year";
  if (pxPerDay < 8) return "quarter";
  if (pxPerDay < 22) return "month";
  return "week";
}

export interface Tick {
  date: string;
  label: string;
  major: boolean;
}

export function generateTicks(
  startDate: string,
  endDate: string,
  scale: RulerScale,
): Tick[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const ticks: Tick[] = [];

  if (scale === "decade") {
    let year = Math.floor(start.getFullYear() / 10) * 10;
    while (year <= end.getFullYear() + 10) {
      ticks.push({ date: `${year}-01-01`, label: `${year}s`, major: true });
      year += 10;
    }
    return ticks;
  }

  if (scale === "year") {
    let year = start.getFullYear();
    while (year <= end.getFullYear() + 1) {
      ticks.push({ date: `${year}-01-01`, label: String(year), major: true });
      year++;
    }
    return ticks;
  }

  if (scale === "quarter") {
    let cursor = fmtDate(new Date(start.getFullYear(), 0, 1));
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      const m = d.getMonth() + 1;
      if (m === 1 || m === 4 || m === 7 || m === 10) {
        const isYearStart = m === 1;
        const label = isYearStart ? String(d.getFullYear()) : `Q${(m - 1) / 3 + 1}`;
        ticks.push({ date: cursor, label, major: isYearStart });
      }
      cursor = addMonths(cursor, 1);
    }
    return ticks;
  }

  if (scale === "month") {
    let cursor = fmtDate(new Date(start.getFullYear(), start.getMonth(), 1));
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      const m = d.getMonth();
      const label =
        m === 0
          ? String(d.getFullYear())
          : d.toLocaleString(undefined, { month: "short" });
      ticks.push({ date: cursor, label, major: m === 0 });
      cursor = addMonths(cursor, 1);
    }
    return ticks;
  }

  // week — anchor on Mondays
  const dow = start.getDay(); // 0 = Sun
  const offset = dow === 0 ? 1 : (1 - dow + 7) % 7;
  let cursor = addDays(fmtDate(start), offset);
  while (parseDate(cursor) <= end) {
    const d = parseDate(cursor);
    const day = d.getDate();
    const isMonthStart = day <= 7;
    const label = isMonthStart
      ? d.toLocaleString(undefined, { month: "short", day: "numeric" })
      : String(day);
    ticks.push({ date: cursor, label, major: isMonthStart });
    cursor = addDays(cursor, 7);
  }
  return ticks;
}
