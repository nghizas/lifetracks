import { useEffect, useMemo, useState } from "react";
import { PALETTE, selectOrderedTracks, useStore } from "@/state";
import { Field, Sheet, inputClass } from "./Sheet";

export function EditTrackSheet() {
  const sheet = useStore((s) => s.sheet);
  const open = sheet?.kind === "edit-track";
  const trackId = sheet?.kind === "edit-track" ? sheet.trackId : null;
  const closeSheet = useStore((s) => s.closeSheet);
  const patchTrack = useStore((s) => s.patchTrack);
  const removeTrack = useStore((s) => s.removeTrack);
  const orderedTracks = useStore(selectOrderedTracks);

  const track = useMemo(
    () => (trackId ? orderedTracks.find((t) => t.id === trackId) ?? null : null),
    [trackId, orderedTracks],
  );

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]!);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !track) return;
    setName(track.name);
    setColor(track.color);
    setNotes(track.notes);
  }, [open, track]);

  if (!open || !track) {
    return <Sheet open={false} onClose={closeSheet}>{null}</Sheet>;
  }

  function save() {
    if (!track) return;
    const t = name.trim();
    if (!t) return;
    patchTrack(track.id, { name: t, color, notes });
    closeSheet();
  }

  function del() {
    if (!track) return;
    if (window.confirm(`Delete "${track.name}" and its clips?`)) {
      removeTrack(track.id);
      closeSheet();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title="Edit track"
      rightAction={
        <button
          type="button"
          onClick={save}
          disabled={!name.trim()}
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
      }
    >
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full border-2 ${
                color === c ? "border-ink" : "border-transparent"
              }`}
              style={{ background: c }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      </Field>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything you want to remember about this track…"
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </Field>

      <div className="rounded-md bg-ink/[0.03] px-3 py-2 text-[11px] text-muted">
        Long-press a track name on the canvas to drag and reorder.
      </div>

      <button
        type="button"
        onClick={del}
        className="mt-2 w-full rounded-md border border-overload/30 px-3 py-2 text-sm text-overload"
      >
        Delete track and its clips
      </button>
    </Sheet>
  );
}
