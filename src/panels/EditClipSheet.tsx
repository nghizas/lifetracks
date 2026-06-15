import { useEffect, useState } from "react";
import type { ClipKind, ClipStatus, RecurrenceFreq } from "@/core";
import { addMonths } from "@/core";
import { selectOrderedTracks, useStore } from "@/state";
import { Field, Sheet, inputClass } from "./Sheet";

const KIND_LABEL: Record<ClipKind, string> = {
  span: "Span",
  event: "Event",
  stem: "Stem",
  flag: "Flag",
};

const STATUSES: ClipStatus[] = ["planned", "active", "done", "skipped"];

const CADENCES: { value: RecurrenceFreq; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

function cadenceSummary(freq: RecurrenceFreq, count: number): string {
  const period =
    freq === "daily"
      ? "day"
      : freq === "weekly"
        ? "week"
        : freq === "biweekly"
          ? "2 weeks"
          : "month";
  if (count === 1) return `Once per ${period}`;
  return `${count} times per ${period}`;
}

export function EditClipSheet() {
  const sheet = useStore((s) => s.sheet);
  const open = sheet?.kind === "edit-clip";
  const clipId = sheet?.kind === "edit-clip" ? sheet.clipId : null;
  const closeSheet = useStore((s) => s.closeSheet);
  const patchClip = useStore((s) => s.patchClip);
  const removeClip = useStore((s) => s.removeClip);
  const clip = useStore((s) =>
    clipId ? s.roadmap.clips.find((c) => c.id === clipId) ?? null : null,
  );
  const tracks = useStore(selectOrderedTracks);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState<string | null>(null);
  const [trackId, setTrackId] = useState("");
  const [status, setStatus] = useState<ClipStatus>("planned");
  const [startTime, setStartTime] = useState<string>("");
  const [cadence, setCadence] = useState<RecurrenceFreq>("weekly");
  const [count, setCount] = useState<number>(1);
  const [until, setUntil] = useState<string>("");

  useEffect(() => {
    if (!open || !clip) return;
    setTitle(clip.title);
    setStart(clip.start);
    setEnd(clip.end);
    setTrackId(clip.trackId);
    setStatus(clip.status);
    setStartTime(clip.startTime ?? "");
    setCadence(clip.recurrence?.freq ?? "weekly");
    setCount(clip.recurrence?.count ?? 1);
    setUntil(clip.recurrence?.until ?? addMonths(clip.start, 6));
  }, [open, clip]);

  if (!open || !clip) {
    return <Sheet open={false} onClose={closeSheet}>{null}</Sheet>;
  }

  function save() {
    if (!clip) return;
    const t = title.trim();
    if (!t) return;
    patchClip(clip.id, {
      title: t,
      start,
      end: clip.kind === "span" ? end ?? start : clip.end,
      trackId,
      status,
      startTime: clip.kind === "event" ? (startTime || null) : clip.startTime,
      recurrence:
        clip.kind === "stem"
          ? {
              freq: cadence,
              until,
              interval: clip.recurrence?.interval ?? 1,
              count,
            }
          : clip.recurrence,
    });
    closeSheet();
  }

  function del() {
    if (!clip) return;
    if (window.confirm("Delete this clip?")) {
      removeClip(clip.id);
      closeSheet();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={`Edit ${KIND_LABEL[clip.kind].toLowerCase()}`}
      rightAction={
        <button
          type="button"
          onClick={save}
          disabled={!title.trim()}
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
      }
    >
      <Field label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Track">
        <select
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
          className={inputClass}
        >
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Start">
        <input
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            if (clip.kind === "span" && end && end < e.target.value) {
              setEnd(addMonths(e.target.value, 2));
            }
          }}
          className={inputClass}
        />
      </Field>

      {clip.kind === "span" ? (
        <Field label="End">
          <input
            type="date"
            value={end ?? ""}
            onChange={(e) => setEnd(e.target.value || null)}
            min={start}
            className={inputClass}
          />
        </Field>
      ) : null}

      {clip.kind === "stem" ? (
        <>
          <Field label="Cadence">
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as RecurrenceFreq)}
              className={inputClass}
            >
              {CADENCES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Times per period">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCount(Math.max(1, count - 1))}
                disabled={count <= 1}
                className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-[20px] leading-none disabled:opacity-30"
                aria-label="Decrease"
              >
                −
              </button>
              <div className="min-w-[3rem] text-center text-[24px] font-bold tabular-nums">
                {count}
              </div>
              <button
                type="button"
                onClick={() => setCount(Math.min(31, count + 1))}
                disabled={count >= 31}
                className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-[20px] leading-none disabled:opacity-30"
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <div className="mt-2 text-center text-[12px] text-muted">
              {cadenceSummary(cadence, count)}
            </div>
          </Field>
          <Field label="Until">
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              min={start}
              className={inputClass}
            />
          </Field>
        </>
      ) : null}

      {clip.kind === "event" ? (
        <Field label="Time (optional)">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
          <div className="mt-1 text-[11px] text-muted">
            Leave blank for an all-day event.
          </div>
        </Field>
      ) : null}

      <Field label="Status">
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs ${
                status === s
                  ? "border-ink bg-ink text-white"
                  : "border-ink/15 text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      <button
        type="button"
        onClick={del}
        className="mt-2 w-full rounded-md border border-overload/30 px-3 py-2 text-sm text-overload"
      >
        Delete clip
      </button>
    </Sheet>
  );
}
