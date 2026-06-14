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
  const reorderTracks = useStore((s) => s.reorderTracks);
  const orderedTracks = useStore(selectOrderedTracks);

  const track = useMemo(
    () => (trackId ? orderedTracks.find((t) => t.id === trackId) ?? null : null),
    [trackId, orderedTracks],
  );

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]!);
  const [notes, setNotes] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!open || !track) return;
    setName(track.name);
    setColor(track.color);
    setNotes(track.notes);
    setCollapsed(track.collapsed);
  }, [open, track]);

  if (!open || !track) {
    return <Sheet open={false} onClose={closeSheet}>{null}</Sheet>;
  }

  const position = orderedTracks.findIndex((t) => t.id === track.id);
  const canMoveUp = position > 0;
  const canMoveDown = position >= 0 && position < orderedTracks.length - 1;

  function save() {
    if (!track) return;
    const t = name.trim();
    if (!t) return;
    patchTrack(track.id, { name: t, color, notes, collapsed });
    closeSheet();
  }

  function moveUp() {
    if (!canMoveUp) return;
    const swapped = orderedTracks.slice();
    const tmp = swapped[position - 1]!;
    swapped[position - 1] = swapped[position]!;
    swapped[position] = tmp;
    reorderTracks(swapped.map((t) => t.id));
  }

  function moveDown() {
    if (!canMoveDown) return;
    const swapped = orderedTracks.slice();
    const tmp = swapped[position + 1]!;
    swapped[position + 1] = swapped[position]!;
    swapped[position] = tmp;
    reorderTracks(swapped.map((t) => t.id));
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

      <Field label="Position">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">
            {position + 1} of {orderedTracks.length}
          </span>
          <button
            type="button"
            onClick={moveUp}
            disabled={!canMoveUp}
            className="ml-auto h-9 rounded-md border border-ink/15 px-3 text-[12px] font-semibold disabled:opacity-30"
          >
            ↑ Move up
          </button>
          <button
            type="button"
            onClick={moveDown}
            disabled={!canMoveDown}
            className="h-9 rounded-md border border-ink/15 px-3 text-[12px] font-semibold disabled:opacity-30"
          >
            ↓ Move down
          </button>
        </div>
      </Field>

      <Field label="Display">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-ink/10 p-3">
          <input
            type="checkbox"
            checked={collapsed}
            onChange={(e) => setCollapsed(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">
            <span className="font-medium">Collapse</span>
            <span className="ml-1 text-[11px] text-muted">
              hide clips, show just the label row
            </span>
          </span>
        </label>
      </Field>

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
