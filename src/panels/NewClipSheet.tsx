import { useEffect, useState } from "react";
import { type ClipKind, addMonths, todayStr } from "@/core";
import { selectOrderedTracks, useStore } from "@/state";
import { Field, Sheet, inputClass } from "./Sheet";

const KINDS: { value: ClipKind; label: string; hint: string }[] = [
  { value: "task", label: "Span", hint: "a stretch of work" },
  { value: "event", label: "Event", hint: "a fixed date" },
  { value: "stem", label: "Stem", hint: "a recurring habit" },
  { value: "flag", label: "Flag", hint: "a milestone" },
];

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
  }, [open, defaults, tracks]);

  function submit() {
    const t = title.trim();
    if (!t || !trackId) return;
    const created = addClip({
      trackId,
      kind,
      title: t,
      start,
      end: kind === "task" ? end : null,
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
