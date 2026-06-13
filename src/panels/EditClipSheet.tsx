import { useEffect, useState } from "react";
import type { ClipKind, ClipStatus } from "@/core";
import { addMonths } from "@/core";
import { selectOrderedTracks, useStore } from "@/state";
import { Field, Sheet, inputClass } from "./Sheet";

const KIND_LABEL: Record<ClipKind, string> = {
  task: "Task",
  event: "Event",
  stem: "Stem",
  flag: "Flag",
};

const STATUSES: ClipStatus[] = ["planned", "active", "done", "skipped"];

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
  const [effort, setEffort] = useState(3);
  const [status, setStatus] = useState<ClipStatus>("planned");

  useEffect(() => {
    if (!open || !clip) return;
    setTitle(clip.title);
    setStart(clip.start);
    setEnd(clip.end);
    setTrackId(clip.trackId);
    setEffort(clip.effort);
    setStatus(clip.status);
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
      end: clip.kind === "task" ? end ?? start : clip.end,
      trackId,
      effort,
      status,
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
            if (clip.kind === "task" && end && end < e.target.value) {
              setEnd(addMonths(e.target.value, 2));
            }
          }}
          className={inputClass}
        />
      </Field>

      {clip.kind === "task" ? (
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

      <Field label={`Effort · ${effort}`}>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={effort}
          onChange={(e) => setEffort(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>1 light</span>
          <span>5 heavy</span>
        </div>
      </Field>

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
