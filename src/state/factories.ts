// Factories for new entities. These attach a fresh `id`, the current
// `updatedAt`, and per-kind defaults that match v2's `addClip` behaviour.
// (Pure-core stays free of `uid()` and time; that lives here.)

import {
  type Clip,
  type ClipKind,
  type Track,
  ClipSchema,
  TrackSchema,
  addMonths,
} from "@/core";
import { uid } from "./uid";

export const PALETTE = [
  "#5b8def",
  "#e07a5f",
  "#81b29a",
  "#f2cc8f",
  "#c89cd1",
  "#7cd3c4",
  "#f4a261",
  "#d195c4",
  "#a3c4f3",
  "#bcd979",
];

export function pickColor(order: number): string {
  return PALETTE[((order % PALETTE.length) + PALETTE.length) % PALETTE.length]!;
}

export interface MakeTrackInput {
  name: string;
  color?: string;
  order: number;
}

export function makeTrack(input: MakeTrackInput, now: string): Track {
  return TrackSchema.parse({
    id: uid(),
    name: input.name,
    color: input.color ?? pickColor(input.order),
    order: input.order,
    updatedAt: now,
  });
}

export interface MakeClipInput {
  trackId: string;
  kind: ClipKind;
  title: string;
  start: string;
  end?: string | null;
  effort?: number;
  /** Optional recurrence override (only used for stems). */
  recurrence?: { freq: "daily" | "weekly" | "biweekly" | "monthly"; until: string; interval?: number };
}

export function makeClip(input: MakeClipInput, now: string): Clip {
  const base: Record<string, unknown> = {
    id: uid(),
    trackId: input.trackId,
    kind: input.kind,
    title: input.title,
    start: input.start,
    effort: input.effort ?? 3,
    updatedAt: now,
  };
  if (input.kind === "task") {
    base.end = input.end ?? addMonths(input.start, 3);
  } else if (input.kind === "stem") {
    base.recurrence = input.recurrence
      ? {
          freq: input.recurrence.freq,
          until: input.recurrence.until,
          interval: input.recurrence.interval ?? 1,
        }
      : {
          freq: "weekly",
          until: addMonths(input.start, 6),
          interval: 1,
        };
  } else if (input.kind === "event") {
    base.disruption = {
      monthsBefore: 0,
      monthsAfter: 1,
      capacityReduction: 0.3,
    };
  }
  return ClipSchema.parse(base);
}
