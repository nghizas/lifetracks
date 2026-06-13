// Settings / data sheet. Phase 1 surface: export/import JSON, view tunables,
// reset everything. Composer / model-picker arrive in Phase 2.

import { useRef, useState } from "react";
import { todayStr } from "@/core";
import { useStore } from "@/state";
import { getActiveAdapter } from "@/storage";
import { Field, Sheet, inputClass } from "./Sheet";

export function SettingsSheet() {
  const sheet = useStore((s) => s.sheet);
  const open = sheet?.kind === "settings";
  const closeSheet = useStore((s) => s.closeSheet);
  const hydrate = useStore((s) => s.hydrate);
  const settings = useStore((s) => s.roadmap.settings);

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onExport() {
    const adapter = getActiveAdapter();
    const json = await adapter.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifetracks-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Exported.");
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const adapter = getActiveAdapter();
      const roadmap = await adapter.importJSON(text);
      hydrate(roadmap);
      setStatus(`Imported ${roadmap.tracks.length} tracks, ${roadmap.clips.length} clips.`);
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onReset() {
    if (!window.confirm("Delete all tracks and clips? This cannot be undone (the export above is your safety net).")) return;
    hydrate({
      version: 3,
      settings,
      tracks: [],
      clips: [],
    });
    setStatus("Cleared.");
  }

  return (
    <Sheet open={open} onClose={closeSheet} title="Settings">
      <Field label="Data">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onExport}
            className="block w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-left text-sm"
          >
            <div className="font-medium">Export JSON</div>
            <div className="text-[11px] text-muted">Downloads a backup file</div>
          </button>
          <label className="block cursor-pointer rounded-md border border-ink/15 bg-white px-3 py-2 text-sm">
            <div className="font-medium">Import JSON</div>
            <div className="text-[11px] text-muted">
              v2 exports auto-migrate to v3
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImport}
            />
          </label>
          <button
            type="button"
            onClick={onReset}
            className="block w-full rounded-md border border-overload/30 px-3 py-2 text-left text-sm text-overload"
          >
            Reset everything
          </button>
          {status ? (
            <div className="text-[11px] text-muted">{status}</div>
          ) : null}
        </div>
      </Field>

      <Field label="Tunables (read-only for now)">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-ink/10 p-2">
            <div className="text-muted">Horizon</div>
            <div className="font-medium">{settings.horizonYears}y</div>
          </div>
          <div className="rounded-md border border-ink/10 p-2">
            <div className="text-muted">Monthly capacity</div>
            <div className="font-medium">{settings.monthlyCapacity}×</div>
          </div>
          <div className="rounded-md border border-ink/10 p-2">
            <div className="text-muted">Look-ahead</div>
            <div className="font-medium">{settings.lookaheadDays}d</div>
          </div>
        </div>
      </Field>

      <input className={inputClass} type="hidden" defaultValue="" aria-hidden />
    </Sheet>
  );
}
