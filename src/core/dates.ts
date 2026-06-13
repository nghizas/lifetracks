// Pure date helpers. ISO date strings ("YYYY-MM-DD") are the canonical form
// throughout core/. All parsing treats the bare date as *local* midnight, matching
// v2's stance ("the roadmap renders in the user's clock"). No DOM, no globals.

/** Parse an ISO date string ("YYYY-MM-DD") to a Date at *local* midnight. */
export function parseDate(s: string): Date {
  if (!s) throw new Error("parseDate: empty string");
  return new Date(s + "T00:00:00");
}

/** Format a Date as an ISO date string ("YYYY-MM-DD"), using *local* fields. */
export function fmtDate(d: Date): string {
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today as an ISO date string. Pass a Date for testability; defaults to `new Date()`. */
export function todayStr(now: Date = new Date()): string {
  return fmtDate(now);
}

export function daysBetween(a: string, b: string): number {
  return (parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000;
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

export function addMonths(s: string, n: number): string {
  const d = parseDate(s);
  d.setMonth(d.getMonth() + n);
  return fmtDate(d);
}

export function maxDate(a: string, b: string): string {
  return parseDate(a) > parseDate(b) ? a : b;
}

export function minDate(a: string, b: string): string {
  return parseDate(a) < parseDate(b) ? a : b;
}

/** Month key in the form "YYYY-MM". */
export function monthKey(s: string): string {
  const d = parseDate(s);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export function monthsBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

/** Inclusive slice of `sortedAll` (each "YYYY-MM") between startKey and endKey. */
export function monthRange(
  startKey: string,
  endKey: string,
  sortedAll: readonly string[],
): string[] {
  const out: string[] = [];
  for (const m of sortedAll) if (m >= startKey && m <= endKey) out.push(m);
  return out;
}

/** Format "YYYY-MM" as a short label like `Aug '26`. */
export function fmtMonthLabel(m: string): string {
  const d = parseDate(m + "-01");
  return d.toLocaleString(undefined, { month: "short" }) + " '" + String(d.getFullYear()).slice(2);
}
