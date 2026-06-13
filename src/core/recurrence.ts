// Stem occurrence math. Pure, deterministic enumeration of recurrence dates.

import { addDays, addMonths, parseDate } from "./dates";
import type { Recurrence } from "./model";

/**
 * Enumerate occurrence dates for a stem starting at `start` and recurring per
 * `recurrence`, up to and including `upTo`. Returned dates are ISO strings.
 * The `until` field on `recurrence` is honoured: occurrences past `until` are dropped.
 *
 * Frequencies:
 *   - daily:    +1 day  × interval
 *   - weekly:   +7 days × interval
 *   - biweekly: +14 days × interval
 *   - monthly:  +1 month × interval
 */
export function occurrences(
  start: string,
  recurrence: Recurrence,
  upTo: string,
): string[] {
  const cap = parseDate(minIsoDate(recurrence.until, upTo));
  const out: string[] = [];
  let cur = start;
  const step = recurrence.interval > 0 ? recurrence.interval : 1;

  // Defensive ceiling so a misconfigured recurrence can't loop forever.
  const MAX_STEPS = 10_000;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (parseDate(cur) > cap) break;
    out.push(cur);
    cur = advance(cur, recurrence.freq, step);
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
