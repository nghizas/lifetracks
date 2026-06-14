// Stem occurrence math. Pure, deterministic enumeration of recurrence dates.
//
// Supports both "one per period" and "N per period" semantics:
//   - count = 1: classic recurrence — one occurrence at each period start
//     (daily / weekly / biweekly / monthly, optionally with interval > 1)
//   - count > 1: N occurrences distributed evenly within each period
//     ("3 per week" = 3 events spaced ~2.33 days apart, repeating weekly)

import { addDays, addMonths, daysBetween, parseDate } from "./dates";
import type { Recurrence } from "./model";

export function occurrences(
  start: string,
  recurrence: Recurrence,
  upTo: string,
): string[] {
  const cap = parseDate(minIsoDate(recurrence.until, upTo));
  const out: string[] = [];
  const step = recurrence.interval > 0 ? recurrence.interval : 1;
  const count = recurrence.count > 0 ? recurrence.count : 1;

  if (count === 1) {
    // Single occurrence at each period start.
    let cur = start;
    const MAX_STEPS = 10_000;
    for (let i = 0; i < MAX_STEPS; i++) {
      if (parseDate(cur) > cap) break;
      out.push(cur);
      cur = advance(cur, recurrence.freq, step);
    }
    return out;
  }

  // Multiple occurrences per period, evenly spaced.
  let periodStart = start;
  const MAX_PERIODS = 2_000;
  for (let i = 0; i < MAX_PERIODS; i++) {
    if (parseDate(periodStart) > cap) break;
    const nextPeriodStart = advance(periodStart, recurrence.freq, step);
    const periodDays = Math.max(1, daysBetween(periodStart, nextPeriodStart));
    const gap = periodDays / count;
    for (let j = 0; j < count; j++) {
      const offsetDays = Math.round(j * gap);
      const occDate = addDays(periodStart, offsetDays);
      if (parseDate(occDate) > cap) break;
      out.push(occDate);
    }
    periodStart = nextPeriodStart;
  }
  return out;
}

function advance(date: string, freq: Recurrence["freq"], step: number): string {
  switch (freq) {
    case "daily":
      return addDays(date, step);
    case "weekly":
      return addDays(date, 7 * step);
    case "biweekly":
      return addDays(date, 14 * step);
    case "monthly":
      return addMonths(date, step);
  }
}

function minIsoDate(a: string, b: string): string {
  return a < b ? a : b;
}
