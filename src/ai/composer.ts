// The Composer — the spec's "track-scoped AI brain." Pure transformer over
// the Provider interface: takes a roadmap + focus + user message + thread,
// builds the system prompt, calls the provider, parses + scope-enforces the
// response. No UI here. No persistence. Tests cover every branch.

import { z } from "zod";
import {
  type Clip,
  type Roadmap,
  ClipKindSchema,
  ClipStatusSchema,
  RecurrenceFreqSchema,
  fmtMonthLabel,
  runSequencer,
} from "@/core";
import type { Provider, ProviderMessage } from "./types";

/* -------------------------------------------------------------------------- *
 * Response contract (zod-validated)
 * -------------------------------------------------------------------------- */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTime = z.string().regex(/^\d{2}:\d{2}$/);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const ComposerRecurrenceSchema = z.object({
  freq: RecurrenceFreqSchema,
  until: isoDate,
  count: z.number().int().min(1).max(31).optional(),
  interval: z.number().int().positive().optional(),
});
export type ComposerRecurrence = z.infer<typeof ComposerRecurrenceSchema>;

const ComposerNewTrackSchema = z.object({
  tempId: z.string().min(1),
  name: z.string().min(1),
  color: hexColor,
});
export type ComposerNewTrack = z.infer<typeof ComposerNewTrackSchema>;

const ComposerNewClipSchema = z.object({
  /** Either the focused track's id, or the tempId of a newly-proposed track. */
  trackId: z.string().min(1),
  kind: ClipKindSchema,
  title: z.string().min(1),
  start: isoDate,
  end: isoDate.nullable().optional(),
  effort: z.number().int().min(1).max(5).optional(),
  recurrence: ComposerRecurrenceSchema.optional(),
  startTime: isoTime.nullable().optional(),
  notes: z.string().optional(),
});
export type ComposerNewClip = z.infer<typeof ComposerNewClipSchema>;

const ComposerClipChangesSchema = z.object({
  title: z.string().optional(),
  start: isoDate.optional(),
  end: isoDate.nullable().optional(),
  effort: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  recurrence: ComposerRecurrenceSchema.nullable().optional(),
  status: ClipStatusSchema.optional(),
  startTime: isoTime.nullable().optional(),
});
export type ComposerClipChanges = z.infer<typeof ComposerClipChangesSchema>;

const ComposerModificationSchema = z.object({
  clipId: z.string().min(1),
  changes: ComposerClipChangesSchema,
});
export type ComposerModification = z.infer<typeof ComposerModificationSchema>;

const ComposerProposalSchema = z.object({
  newTrack: ComposerNewTrackSchema.nullable(),
  newClips: z.array(ComposerNewClipSchema),
  modifications: z.array(ComposerModificationSchema),
  removals: z.array(z.string().min(1)),
});
export type ComposerProposal = z.infer<typeof ComposerProposalSchema>;

const ComposerResponseSchema = z.object({
  message: z.string(),
  questions: z.array(z.string()),
  suggestions: z.array(z.string()),
  proposal: ComposerProposalSchema,
});
export type ComposerResponse = z.infer<typeof ComposerResponseSchema>;

/* -------------------------------------------------------------------------- *
 * Public types
 * -------------------------------------------------------------------------- */

export type ComposerFocus =
  | { kind: "new-track" }
  | { kind: "track"; trackId: string };

export interface ComposerRequest {
  focus: ComposerFocus;
  userMessage: string;
  /** Prior thread for this focus, oldest first (excluding the userMessage). */
  thread: ProviderMessage[];
  /** Read-only roadmap context the Composer is allowed to see. */
  roadmap: Roadmap;
  /** Today as ISO YYYY-MM-DD (lets the model reason relatively). */
  today: string;
  /** Optional per-call model override. */
  model?: string;
}

export interface ComposerResult {
  kind: "ok";
  message: string;
  questions: string[];
  suggestions: string[];
  proposal: ComposerProposal;
  /** Aggregated scope-enforcement notice (e.g. "dropped 1 cross-track clip"). */
  scopeWarning?: string;
  /** Raw assistant text — kept for debugging the validator. */
  raw: string;
}

export interface ComposerError {
  kind: "parse";
  message: string;
  /** Raw assistant text returned by the provider. */
  raw: string;
}

/* -------------------------------------------------------------------------- *
 * Entry point
 * -------------------------------------------------------------------------- */

export async function composeProposal(
  provider: Provider,
  request: ComposerRequest,
): Promise<ComposerResult | ComposerError> {
  const system = buildSystemPrompt(request);
  const messages: ProviderMessage[] = [
    ...request.thread,
    { role: "user", content: request.userMessage },
  ];

  const res = await provider.message({
    system,
    messages,
    model: request.model,
    maxTokens: 2048,
  });

  const parsed = parseComposerResponse(res.content);
  if (parsed.kind === "error") {
    return { kind: "parse", message: parsed.error, raw: res.content };
  }

  const enforced = enforceScope(parsed.value, request);
  return {
    kind: "ok",
    message: enforced.result.message,
    questions: enforced.result.questions,
    suggestions: enforced.result.suggestions.slice(0, 2),
    proposal: enforced.result.proposal,
    scopeWarning: enforced.warning,
    raw: res.content,
  };
}

/* -------------------------------------------------------------------------- *
 * Parser
 * -------------------------------------------------------------------------- */

export type ParseResult =
  | { kind: "ok"; value: ComposerResponse }
  | { kind: "error"; error: string };

export function parseComposerResponse(content: string): ParseResult {
  const jsonStr = extractJsonBlock(content);
  if (!jsonStr) return { kind: "error", error: "No JSON object found in the response." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    return {
      kind: "error",
      error: `JSON parse failed: ${(err as Error).message}`,
    };
  }

  const result = ComposerResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { kind: "error", error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { kind: "ok", value: result.data };
}

function extractJsonBlock(content: string): string | null {
  // Markdown code fence: ```json ... ``` or ``` ... ```
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) return fence[1].trim();
  // Plain JSON: first { to last }
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return content.slice(start, end + 1);
}

/* -------------------------------------------------------------------------- *
 * Scope enforcement
 * -------------------------------------------------------------------------- */

const PER_TURN_CLIP_CAP = 8;
const MAX_SUGGESTIONS = 2;

interface EnforceResult {
  result: ComposerResponse;
  warning?: string;
}

export function enforceScope(
  response: ComposerResponse,
  request: ComposerRequest,
): EnforceResult {
  const warnings: string[] = [];
  const focusedTrackId =
    request.focus.kind === "track" ? request.focus.trackId : null;

  // newTrack is only allowed when focus is "new-track"
  let newTrack = response.proposal.newTrack;
  if (newTrack && request.focus.kind !== "new-track") {
    warnings.push("dropped a proposed new track (focus is on an existing track)");
    newTrack = null;
  }

  // Allowed trackIds for new clips: focused track + the proposed new track's tempId
  const allowedNewClipTrackIds = new Set<string>();
  if (focusedTrackId) allowedNewClipTrackIds.add(focusedTrackId);
  if (newTrack) allowedNewClipTrackIds.add(newTrack.tempId);

  const filteredNewClips = response.proposal.newClips.filter((c) =>
    allowedNewClipTrackIds.has(c.trackId),
  );
  if (filteredNewClips.length < response.proposal.newClips.length) {
    warnings.push(
      `dropped ${response.proposal.newClips.length - filteredNewClips.length} clip(s) referencing other tracks`,
    );
  }

  let newClips = filteredNewClips;
  if (newClips.length > PER_TURN_CLIP_CAP) {
    warnings.push(
      `dropped ${newClips.length - PER_TURN_CLIP_CAP} clip(s) over the per-turn limit of ${PER_TURN_CLIP_CAP}`,
    );
    newClips = newClips.slice(0, PER_TURN_CLIP_CAP);
  }

  // Modifications and removals: only for clips on the focused track
  const focusedClipIds = focusedTrackId
    ? new Set(
        request.roadmap.clips
          .filter((c) => c.trackId === focusedTrackId)
          .map((c) => c.id),
      )
    : new Set<string>();

  const modifications = response.proposal.modifications.filter((m) =>
    focusedClipIds.has(m.clipId),
  );
  if (modifications.length < response.proposal.modifications.length) {
    warnings.push(
      `dropped ${response.proposal.modifications.length - modifications.length} modification(s) outside the focused track`,
    );
  }

  const removals = response.proposal.removals.filter((id) => focusedClipIds.has(id));
  if (removals.length < response.proposal.removals.length) {
    warnings.push(
      `dropped ${response.proposal.removals.length - removals.length} removal(s) outside the focused track`,
    );
  }

  return {
    result: {
      message: response.message,
      questions: response.questions,
      suggestions: response.suggestions.slice(0, MAX_SUGGESTIONS),
      proposal: {
        newTrack,
        newClips,
        modifications,
        removals,
      },
    },
    warning: warnings.length > 0 ? warnings.join("; ") : undefined,
  };
}

/* -------------------------------------------------------------------------- *
 * System prompt
 * -------------------------------------------------------------------------- */

export function buildSystemPrompt(request: ComposerRequest): string {
  return `You are the Lifetracks Composer — a calm planning assistant.

# Hard scope
You operate on ONE track at a time (the "focused track"). You see the full roadmap as read-only context, but you may only propose changes to the focused track. Cross-track ideas become \`suggestions\` — short chips the user can tap to start a new focused thread elsewhere.

# Per-turn limits
- AT MOST 1 new track (only if the focus is "new-track")
- AT MOST ${PER_TURN_CLIP_CAP} new clips on the focused track
- modifications and removals: focused track only
- AT MOST ${MAX_SUGGESTIONS} cross-track suggestions

# Style
Calm, concrete, dated. One or two sentences in \`message\`. A turn that asks clarifying questions should propose ≤ 3 new clips (you're exploring, not committing).

# Capacity
You are given per-month remaining capacity below. Your proposals must not push any month over 1.2× capacity. If your idea would overload, trim it and say so in \`message\`.

# Vocabulary
- "Span"  (kind: "span")  — a stretch of work with start and end dates
- "Event" (kind: "event") — a fixed date (optionally with time-of-day)
- "Stem"  (kind: "stem")  — a recurring habit with cadence (daily / weekly / biweekly / monthly) and an optional count-per-period
- "Flag"  (kind: "flag")  — a milestone marker

# Output
Respond with ONLY a JSON object matching this exact shape (no other text, no markdown code fences, no comments):

{
  "message": "1-2 sentence reply",
  "questions": ["string"],
  "suggestions": ["string"],
  "proposal": {
    "newTrack": null OR { "tempId": "T1", "name": "string", "color": "#rrggbb" },
    "newClips": [
      {
        "trackId": "<focused track id, or tempId of the proposed new track>",
        "kind": "span" | "event" | "stem" | "flag",
        "title": "string",
        "start": "YYYY-MM-DD",
        "end": "YYYY-MM-DD" or null (only for spans),
        "effort": 1..5 (optional, 1=light .. 5=heavy),
        "recurrence": { "freq": "daily"|"weekly"|"biweekly"|"monthly", "until": "YYYY-MM-DD", "count": 1..31 } (only for stems),
        "startTime": "HH:MM" (optional, events only),
        "notes": "string" (optional)
      }
    ],
    "modifications": [
      { "clipId": "existing-clip-id", "changes": { /* any of: title, start, end, effort, notes, status, recurrence, startTime */ } }
    ],
    "removals": ["clip-id"]
  }
}

Always include every top-level field. Use [] for empty arrays and null where appropriate. Do not wrap in markdown.

# Context

TODAY: ${request.today}

FOCUSED TRACK:
${focusedTrackBlock(request)}

OTHER TRACKS (read-only):
${otherTracksBlock(request)}

REMAINING CAPACITY (next 18 months):
${capacityBlock(request)}`;
}

function focusedTrackBlock(req: ComposerRequest): string {
  const focus = req.focus;
  if (focus.kind === "new-track") {
    return `(NEW TRACK — you may propose exactly one new track this turn. Use "T1" as its tempId.)`;
  }
  const track = req.roadmap.tracks.find((t) => t.id === focus.trackId);
  if (!track) return "(focused track not found — proceed cautiously)";
  const clips = req.roadmap.clips.filter((c) => c.trackId === track.id);
  return `
id: ${track.id}
name: ${track.name}
color: ${track.color}
notes: ${track.notes || "(none)"}
clips (${clips.length}):
${clips.map(clipLine).join("\n") || "  (none)"}`.trim();
}

function otherTracksBlock(req: ComposerRequest): string {
  const focus = req.focus;
  const focusedId: string | null = focus.kind === "track" ? focus.trackId : null;
  const others = req.roadmap.tracks
    .filter((t) => t.id !== focusedId)
    .sort((a, b) => a.order - b.order);
  if (others.length === 0) return "(none)";
  return others
    .map((t) => {
      const clips = req.roadmap.clips.filter((c) => c.trackId === t.id);
      return `- ${t.name} (${clips.length} clips)`;
    })
    .join("\n");
}

function clipLine(c: Clip): string {
  const parts: string[] = [`  - [${c.kind}] id=${c.id} "${c.title}" ${c.start}`];
  if (c.end) parts.push(`→ ${c.end}`);
  if (c.recurrence) parts.push(`recurrence=${c.recurrence.freq}×${c.recurrence.count}`);
  if (c.effort !== 3) parts.push(`effort=${c.effort}`);
  if (c.status !== "planned") parts.push(`status=${c.status}`);
  return parts.join(" ");
}

function capacityBlock(req: ComposerRequest): string {
  const result = runSequencer(req.roadmap, req.today);
  const months = result.months.slice(0, 18);
  const lines = months.map((m) => {
    const cap = result.capByMonth.get(m) ?? 1.0;
    const total = result.totalByMonth.get(m) ?? 0;
    const remaining = Math.max(0, cap - total);
    return `  ${fmtMonthLabel(m)}: ${remaining.toFixed(2)}× remaining (cap ${cap.toFixed(2)}, used ${total.toFixed(2)})`;
  });
  return lines.join("\n");
}
