// Lifetracks v3 model — types, zod schemas, and v2→v3 migration.
// Pure module: no React, no DOM, no Dexie.
//
// Vocabulary (user-facing → internal kind):
//   Event → "event" · Task → "task" · Stem → "stem" · Flag → "flag"
// v2→v3 renames: goal→task, recurring→stem, milestone→flag (event unchanged).

import { z } from "zod";

/* ----------------------------------------------------------- primitive schemas */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const isoDateOrNull = isoDate.nullable();

export const ClipKindSchema = z.enum(["event", "task", "stem", "flag"]);
export type ClipKind = z.infer<typeof ClipKindSchema>;

export const ClipStatusSchema = z.enum(["planned", "active", "done", "skipped"]);
export type ClipStatus = z.infer<typeof ClipStatusSchema>;

export const ClipSourceSchema = z.enum(["manual", "ai", "template"]);
export type ClipSource = z.infer<typeof ClipSourceSchema>;

export const RecurrenceFreqSchema = z.enum(["daily", "weekly", "biweekly", "monthly"]);
export type RecurrenceFreq = z.infer<typeof RecurrenceFreqSchema>;

export const RecurrenceSchema = z.object({
  freq: RecurrenceFreqSchema,
  until: isoDate,
  interval: z.number().int().positive().default(1),
  /** Number of occurrences per period (e.g. "3 per week"). Defaults to 1. */
  count: z.number().int().min(1).max(31).default(1),
});
export type Recurrence = z.infer<typeof RecurrenceSchema>;

export const DisruptionSchema = z.object({
  monthsBefore: z.number().min(0).default(0),
  monthsAfter: z.number().min(0).default(1),
  capacityReduction: z.number().min(0).max(1).default(0.3),
});
export type Disruption = z.infer<typeof DisruptionSchema>;

export const WindowSchema = z.object({
  earliest: isoDateOrNull.default(null),
  latest: isoDateOrNull.default(null),
});
export type Window = z.infer<typeof WindowSchema>;

/* ------------------------------------------------------------- track and clip */

export const TrackSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string(),
  order: z.number().int(),
  muted: z.boolean().default(false),
  soloed: z.boolean().default(false),
  collapsed: z.boolean().default(false),
  notes: z.string().default(""),
  updatedAt: isoDate,
  deletedAt: isoDateOrNull.default(null),
});
export type Track = z.infer<typeof TrackSchema>;

export const ClipSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  kind: ClipKindSchema,
  title: z.string(),
  notes: z.string().default(""),
  start: isoDate,
  /** Optional time-of-day for events ("HH:MM"). Tasks/stems/flags ignore this. */
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  end: isoDateOrNull.default(null),
  effort: z.number().int().min(1).max(5).default(3),
  dependsOn: z.array(z.string()).default([]),
  recurrence: RecurrenceSchema.nullable().default(null),
  disruption: DisruptionSchema.nullable().default(null),
  window: WindowSchema.nullable().default(null),
  status: ClipStatusSchema.default("planned"),
  source: ClipSourceSchema.default("manual"),
  aiProposalId: z.string().nullable().default(null),
  updatedAt: isoDate,
  deletedAt: isoDateOrNull.default(null),
});
export type Clip = z.infer<typeof ClipSchema>;

/* ----------------------------------------------------------------- settings */

export const SettingsSchema = z.object({
  apiKey: z.string().nullable().default(null),
  horizonYears: z.number().int().min(1).max(20).default(5),
  monthlyCapacity: z.number().positive().default(1.0),
  lookaheadDays: z.number().int().min(1).default(14),
});
export type Settings = z.infer<typeof SettingsSchema>;

/* ----------------------------------------------------------------- roadmap */

export const RoadmapSchema = z.object({
  version: z.literal(3),
  settings: SettingsSchema,
  tracks: z.array(TrackSchema),
  clips: z.array(ClipSchema),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

export function emptyRoadmap(now: string): Roadmap {
  return RoadmapSchema.parse({
    version: 3,
    settings: SettingsSchema.parse({}),
    tracks: [],
    clips: [],
  });
  // `now` reserved for future seeding; signature kept symmetric with migrateV2.
  void now;
}

/* ============================================================================
 * v2 → v3 migration
 *
 * The v2 prototype stored everything in localStorage under a single object.
 * The shape we accept here is the v2 JSON export (and tolerated drift —
 * missing fields get defaults). Renames:
 *   kind: goal → task, recurring → stem, milestone → flag
 *   settings.weeklyCapacity → settings.monthlyCapacity (number is unchanged;
 *     v2's own comment: "treat as monthly ratio = same number")
 *
 * Added fields on every entity: updatedAt, deletedAt. We don't have history,
 * so updatedAt is stamped with the migration time; deletedAt starts null.
 * ========================================================================= */

const V2_KIND_MAP: Record<string, ClipKind> = {
  goal: "task",
  recurring: "stem",
  milestone: "flag",
  event: "event",
};

interface V2Settings {
  apiKey?: string | null;
  horizonYears?: number;
  weeklyCapacity?: number;
  lookaheadDays?: number;
}
interface V2Track {
  id: string;
  name?: string;
  color?: string;
  order?: number;
  muted?: boolean;
  soloed?: boolean;
  collapsed?: boolean;
  notes?: string;
}
interface V2Clip {
  id: string;
  trackId: string;
  kind: string;
  title?: string;
  notes?: string;
  start: string;
  end?: string | null;
  effort?: number;
  dependsOn?: string[];
  recurrence?: { freq?: string; until?: string } | null;
  disruption?: { monthsBefore?: number; monthsAfter?: number; capacityReduction?: number } | null;
  window?: { earliest?: string | null; latest?: string | null } | null;
  status?: string;
  source?: string;
  aiProposalId?: string | null;
}
interface V2State {
  version?: number;
  settings?: V2Settings;
  tracks?: V2Track[];
  clips?: V2Clip[];
}

function normaliseRecurrenceFreq(f: string | undefined): RecurrenceFreq {
  if (f === "daily" || f === "weekly" || f === "biweekly" || f === "monthly") return f;
  return "weekly";
}

function normaliseStatus(s: string | undefined): ClipStatus {
  if (s === "planned" || s === "active" || s === "done" || s === "skipped") return s;
  return "planned";
}

function normaliseSource(s: string | undefined): ClipSource {
  if (s === "manual" || s === "ai" || s === "template") return s;
  return "manual";
}

/**
 * Migrate a v2 JSON export (or already-v3 input) into a validated v3 Roadmap.
 * `now` is the ISO date used to stamp updatedAt on migrated entities.
 * Throws ZodError if the result fails validation.
 */
export function migrateV2(raw: unknown, now: string): Roadmap {
  if (raw && typeof raw === "object" && (raw as { version?: number }).version === 3) {
    return RoadmapSchema.parse(raw);
  }
  const v2 = (raw ?? {}) as V2State;

  const settings = SettingsSchema.parse({
    apiKey: v2.settings?.apiKey ?? null,
    horizonYears: v2.settings?.horizonYears ?? 5,
    monthlyCapacity: v2.settings?.weeklyCapacity ?? 1.0,
    lookaheadDays: v2.settings?.lookaheadDays ?? 14,
  });

  const tracks: Track[] = (v2.tracks ?? []).map((t, i) =>
    TrackSchema.parse({
      id: t.id,
      name: t.name ?? "Untitled track",
      color: t.color ?? "#5b8def",
      order: typeof t.order === "number" ? t.order : i,
      muted: !!t.muted,
      soloed: !!t.soloed,
      collapsed: !!t.collapsed,
      notes: t.notes ?? "",
      updatedAt: now,
      deletedAt: null,
    }),
  );

  const clips: Clip[] = (v2.clips ?? []).map((c) => {
    const kind = V2_KIND_MAP[c.kind] ?? "task";
    return ClipSchema.parse({
      id: c.id,
      trackId: c.trackId,
      kind,
      title: c.title ?? "Untitled",
      notes: c.notes ?? "",
      start: c.start,
      end: c.end ?? null,
      effort: clampEffort(c.effort),
      dependsOn: Array.isArray(c.dependsOn) ? c.dependsOn : [],
      recurrence:
        kind === "stem" && c.recurrence
          ? {
              freq: normaliseRecurrenceFreq(c.recurrence.freq),
              until: c.recurrence.until ?? c.start,
              interval: 1,
            }
          : null,
      disruption:
        kind === "event" && c.disruption
          ? {
              monthsBefore: c.disruption.monthsBefore ?? 0,
              monthsAfter: c.disruption.monthsAfter ?? 1,
              capacityReduction: c.disruption.capacityReduction ?? 0.3,
            }
          : null,
      window: c.window
        ? { earliest: c.window.earliest ?? null, latest: c.window.latest ?? null }
        : null,
      status: normaliseStatus(c.status),
      source: normaliseSource(c.source),
      aiProposalId: c.aiProposalId ?? null,
      updatedAt: now,
      deletedAt: null,
    });
  });

  return RoadmapSchema.parse({ version: 3, settings, tracks, clips });
}

function clampEffort(e: number | undefined): number {
  const n = typeof e === "number" && Number.isFinite(e) ? Math.round(e) : 3;
  return Math.max(1, Math.min(5, n));
}
