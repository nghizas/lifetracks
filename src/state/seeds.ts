// Sample-life seed for the "Load a sample life" door. A small but realistic
// 3-track roadmap that exercises every clip kind, designed to feel like a
// believable life-in-motion rather than test data.

import {
  type Clip,
  type Track,
  ClipSchema,
  TrackSchema,
  addMonths,
} from "@/core";
import { uid } from "./uid";

interface Seed {
  tracks: Track[];
  clips: Clip[];
}

export function buildSampleLife(today: string): Seed {
  const tCareer = uid();
  const tHealth = uid();
  const tFamily = uid();

  const tracks: Track[] = [
    TrackSchema.parse({
      id: tFamily,
      name: "Fatherhood",
      color: "#81b29a",
      order: 0,
      updatedAt: today,
    }),
    TrackSchema.parse({
      id: tHealth,
      name: "Health",
      color: "#e07a5f",
      order: 1,
      updatedAt: today,
    }),
    TrackSchema.parse({
      id: tCareer,
      name: "Career",
      color: "#5b8def",
      order: 2,
      updatedAt: today,
    }),
  ];

  const clips: Clip[] = [
    // Fatherhood
    ClipSchema.parse({
      id: uid(),
      trackId: tFamily,
      kind: "event",
      title: "Baby due",
      start: addMonths(today, 5),
      disruption: { monthsBefore: 1, monthsAfter: 3, capacityReduction: 0.4 },
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tFamily,
      kind: "stem",
      title: "Sunday walk",
      start: today,
      effort: 1,
      recurrence: { freq: "weekly", until: addMonths(today, 12), interval: 1 },
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tFamily,
      kind: "task",
      title: "Set up nursery",
      start: addMonths(today, 2),
      end: addMonths(today, 4),
      effort: 3,
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tFamily,
      kind: "flag",
      title: "Birth class done",
      start: addMonths(today, 4),
      updatedAt: today,
    }),
    // Health
    ClipSchema.parse({
      id: uid(),
      trackId: tHealth,
      kind: "stem",
      title: "Strength 3×/week",
      start: today,
      effort: 2,
      recurrence: { freq: "weekly", until: addMonths(today, 18), interval: 1 },
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tHealth,
      kind: "task",
      title: "Train for half-marathon",
      start: addMonths(today, 1),
      end: addMonths(today, 5),
      effort: 4,
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tHealth,
      kind: "event",
      title: "Half-marathon",
      start: addMonths(today, 5),
      updatedAt: today,
    }),
    // Career
    ClipSchema.parse({
      id: uid(),
      trackId: tCareer,
      kind: "task",
      title: "Promo packet",
      start: addMonths(today, 1),
      end: addMonths(today, 4),
      effort: 4,
      window: { earliest: null, latest: addMonths(today, 5) },
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tCareer,
      kind: "flag",
      title: "Self-review submitted",
      start: addMonths(today, 3),
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tCareer,
      kind: "stem",
      title: "Weekly 1:1 prep",
      start: today,
      effort: 1,
      recurrence: { freq: "weekly", until: addMonths(today, 18), interval: 1 },
      updatedAt: today,
    }),
    ClipSchema.parse({
      id: uid(),
      trackId: tCareer,
      kind: "task",
      title: "Learn distributed systems",
      start: addMonths(today, 6),
      end: addMonths(today, 12),
      effort: 3,
      updatedAt: today,
    }),
  ];

  return { tracks, clips };
}
