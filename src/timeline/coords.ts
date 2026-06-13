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

export const PX_PER_DAY_MIN = 0.25;
export const PX_PER_DAY_MAX = 40;
export const DEFAULT_PX_PER_DAY = 4;

export function clampPxPerDay(p: number): number {
  return Math.max(PX_PER_DAY_MIN, Math.min(PX_PER_DAY_MAX, p));
}
