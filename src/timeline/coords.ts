// Pure date ↔ pixel conversions for the timeline. View state lives in the
// store; this module is stateless — pass `origin`, `pxPerDay`, `scrollX`.

import { addDays, daysBetween } from "@/core";

export function worldXForDate(origin: string, date: string, pxPerDay: number): number {
  return daysBetween(origin, date) * pxPerDay;
}

export function screenXForDate(
  origin: string,
  date: string,
  pxPerDay: number,
  scrollX: number,
): number {
  return worldXForDate(origin, date, pxPerDay) - scrollX;
}

export function dateForScreenX(
  origin: string,
  x: number,
  pxPerDay: number,
  scrollX: number,
): string {
  // Round to the nearest whole day. Math.floor would lose a day across DST
  // transitions because `daysBetween` returns a fractional value when an
  // hour goes missing in spring (so worldX→dateForScreenX won't round-trip
  // with floor).
  const days = Math.round((x + scrollX) / pxPerDay);
  return addDays(origin, days);
}

export const PX_PER_DAY_MIN = 0.1;
export const PX_PER_DAY_MAX = 40;
// 10 px/day puts the default view in the "month" ruler scale (Jan, Feb, Mar…)
// rather than the cryptic "Q3" of the previous default. ~14 months visible on a
// 390px-wide phone after the track header column.
export const DEFAULT_PX_PER_DAY = 10;

export function clampPxPerDay(p: number): number {
  return Math.max(PX_PER_DAY_MIN, Math.min(PX_PER_DAY_MAX, p));
}
