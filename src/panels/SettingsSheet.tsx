// Settings / data sheet. Phase 1 surface: export / import JSON, view tunables,
// reset everything. Phase 2 surface: BYOK API key for the Composer.

import { useEffect, useRef, useState } from "react";
import { todayStr } from "@/core";
import { useStore } from "@/state";
import { getActiveAdapter } from "@/storage";
import {
  AnthropicProvider,
  ProviderError,
  clearAnthropicKey,
  getAnthropicKey,
  looksLikeAnthropicKey,
  maskKey,
  setAnthropicKey,
} from "@/ai";
import { Field, Sheet, inputClass } from "./Sheet";

type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; model: string }
  | { kind: "error"; message: string };

export function SettingsSheet() {
  const sheet = useStore((s) => s.sheet);
  const open = sheet?.kind === "settings";
  const closeSheet = useStore((s) => s.closeSheet);
  const hydrate = useStore((s) => s.hydrate);
  const settings = useStore((s) => s.roadmap.settings);

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [keyDraft, setKeyDraft] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    setSavedKey(getAnthropicKey());
    setKeyDraft("");
    setTest({ kind: "idle" });
    setStatus(null);
  }, [open]);

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
    if (!window.confirm("Delete all tracks and clips? This cannot be undone (the export above is your safety net)."))
      return;
    hydrate({
      version: 3,
      settings,
      tracks: [],
      clips: [],
    });
    setStatus("Cleared.");
  }

  function saveKey() {
    const t = keyDraft.trim();
    if (!t) return;
    setAnthropicKey(t);
    setSavedKey(getAnthropicKey());
    setKeyDraft("");
    setTest({ kind: "idle" });
  }

  function removeKey() {
    if (!window.confirm("Remove the saved API key from this device?")) return;
    clearAnthropicKey();
    setSavedKey(null);
    setTest({ kind: "idle" });
  }

  async function testKey() {
    const key = keyDraft.trim() || savedKey;
    if (!key) return;
    setTest({ kind: "running" });
    try {
      const provider = new AnthropicProvider({ apiKey: key });
      const res = await provider.message({
        system: "Reply with exactly the word OK.",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 16,
      });
      setTest({ kind: "ok", model: res.model });
    } catch (err) {
      const msg =
        err instanceof ProviderError ? err.message : (err as Error).message;
      setTest({ kind: "error", message: msg });
    }
  }

  return (
    <Sheet open={open} onClose={closeSheet} title="Settings">
      <Field label="Composer (BYOK)">
        <div className="space-y-2 text-sm">
          {savedKey ? (
            <div className="rounded-md border border-ink/10 bg-ink/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[12px] font-medium">Key saved</div>
                  <div className="font-mono text-[11px] text-muted">
                    {maskKey(savedKey)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeKey}
                  className="rounded-md border border-overload/30 px-2 py-1 text-[11px] text-overload"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-ink/15 p-3 text-[11px] text-muted">
              No key yet — Composer features stay disabled until you paste one.
            </div>
          )}

          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="sk-ant-…"
            className={inputClass}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveKey}
              disabled={!keyDraft.trim() || !looksLikeAnthropicKey(keyDraft)}
              className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-30"
            >
              Save key
            </button>
            <button
              type="button"
              onClick={testKey}
              disabled={(!keyDraft.trim() && !savedKey) || test.kind === "running"}
              className="rounded-md border border-ink/15 px-3 py-1.5 text-[12px] font-semibold disabled:opacity-30"
            >
              {test.kind === "running" ? "Testing…" : "Test connection"}
            </button>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="ml-auto self-center text-[11px] text-muted underline"
            >
              Get a key ↗
            </a>
          </div>

          {test.kind === "ok" ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
              ✓ Connected — model: <span className="font-mono">{test.model}</span>
            </div>
          ) : test.kind === "error" ? (
            <div className="rounded-md border border-overload/30 bg-overload/5 p-2 text-[11px] text-overload">
              {test.message}
            </div>
          ) : null}

          <div className="pt-1 text-[10px] leading-snug text-muted">
            Your key is stored on this device only. It travels to Anthropic when
            you message the Composer; it never reaches the Lifetracks server.
          </div>
        </div>
      </Field>

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
    </Sheet>
  );
}
