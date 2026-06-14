import { useEffect, useState } from "react";
import { type ClipKind, type RecurrenceFreq, addMonths, todayStr } from "@/core";
import { selectOrderedTracks, useStore } from "@/state";
import { Field, Sheet, inputClass } from "./Sheet";

const KINDS: { value: ClipKind; label: string; hint: string }[] = [
  { value: "task", label: "Span", hint: "a stretch of work" },
  { value: "event", label: "Event", hint: "a fixed date" },
  { value: "stem", label: "Stem", hint: "a recurring habit" },
  { value: "flag", label: "Flag", hint: "a milestone" },
];

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

export function NewClipSheet() {
  const sheet = useStore((s) => s.sheet);
  const open = sheet?.kind === "new-clip";
  const defaults = sheet?.kind === "new-clip" ? sheet.defaults : undefined;
  const closeSheet = useStore((s) => s.closeSheet);
  const addClip = useStore((s) => s.addClip);
  const patchClip = useStore((s) => s.patchClip);
  const tracks = useStore(selectOrderedTracks);

  const [kind, setKind] = useState<ClipKind>("task");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState(addMonths(todayStr(), 2));
  const [trackId, setTrackId] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [cadence, setCadence] = useState<RecurrenceFreq>("weekly");
  const [count, setCount] = useState<number>(1);
  const [until, setUntil] = useState<string>(addMonths(todayStr(), 6));

  useEffect(() => {
    if (!open) return;
    const fallbackTrack = tracks[0]?.id ?? "";
    const initialStart = defaults?.start ?? todayStr();
    setKind("task");
    setTitle("");
    setStart(initialStart);
    setEnd(addMonths(initialStart, 2));
    setTrackId(defaults?.trackId ?? fallbackTrack);
    setStartTime("");
    setCadence("weekly");
    setCount(1);
    setUntil(addMonths(initialStart, 6));
  }, [open, defaults, tracks]);

  // Re-default until-date when start moves, but only if user hasn't tweaked.
  useEffect(() => {
    if (kind === "stem") {
      setUntil(addMonths(start, 6));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  function submit() {
    const t = title.trim();
    if (!t || !trackId) return;
    const created = addClip({
      trackId,
      kind,
      title: t,
      start,
      end: kind === "task" ? end : null,
      recurrence:
        kind === "stem" ? { freq: cadence, until, interval: 1, count } : undefined,
    });
    if (kind === "event" && startTime) {
      patchClip(created.id, { startTime });
    }
    closeSheet();
  }

  if (tracks.length === 0) {
    return (
      <Sheet open={open} onClose={closeSheet} title="New clip">
        <p className="text-sm text-muted">
          Add a track first — clips live inside tracks.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title="New clip"
      rightAction={
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || !trackId}
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      }
    >
      <Field label="Kind">
        <div className="grid grid-cols-4 gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`flex flex-col items-center rounded-md border px-1.5 py-2 text-[11px] ${
                kind === k.value
                  ? "border-ink bg-ink text-white"
                  : "border-ink/15 bg-white text-ink"
              }`}
            >
              <span className="font-semibold">{k.label}</span>
              <span className={kind === k.value ? "text-white/70" : "text-muted"}>
                {k.hint}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "stem" ? "Sunday calls home" : "What's it called?"}
          className={inputClass}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
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
            if (kind === "task") setEnd(addMonths(e.target.value, 2));
          }}
          className={inputClass}
        />
      </Field>

      {kind === "task" ? (
        <Field label="End">
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            min={start}
            className={inputClass}
          />
        </Field>
      ) : null}

      {kind === "stem" ? (
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

      {kind === "event" ? (
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
    </Sheet>
  );
}
