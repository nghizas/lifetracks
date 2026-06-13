import { useEffect, useState } from "react";
import { PALETTE, useStore } from "@/state";
import { Field, Sheet, inputClass } from "./Sheet";

export function NewTrackSheet() {
  const sheet = useStore((s) => s.sheet);
  const open = sheet?.kind === "new-track";
  const closeSheet = useStore((s) => s.closeSheet);
  const addTrack = useStore((s) => s.addTrack);

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]!);

  useEffect(() => {
    if (open) {
      setName("");
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]!);
    }
  }, [open]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addTrack({ name: trimmed, color });
    closeSheet();
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title="New track"
      rightAction={
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      }
    >
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Career, Health, Fatherhood…"
          className={inputClass}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
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
    </Sheet>
  );
}
