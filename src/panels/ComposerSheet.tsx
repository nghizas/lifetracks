// Composer chat sheet. Focus selector at top (new track + existing tracks),
// thread bubbles, an input row, and a read-only preview of the latest
// proposal. Slice 2d adds the ghost-on-canvas + accept/reject flow; for now
// the proposal preview is informational.

import { useEffect, useRef, useState } from "react";
import {
  AnthropicProvider,
  type ComposerFocus,
  type ComposerResult,
  composeProposal,
  focusKey,
  getAnthropicKey,
  hasAnthropicKey,
} from "@/ai";
import { todayStr } from "@/core";
import { selectOrderedTracks, useStore } from "@/state";
import { ProposalDeck } from "./ProposalDeck";
import { Sheet, inputClass } from "./Sheet";

export function ComposerSheet() {
  const sheet = useStore((s) => s.sheet);
  const open = sheet?.kind === "composer";
  const initialFocus = sheet?.kind === "composer" ? sheet.focus : null;
  const closeSheet = useStore((s) => s.closeSheet);
  const tracks = useStore(selectOrderedTracks);

  const [focus, setFocus] = useState<ComposerFocus>({ kind: "new-track" });

  useEffect(() => {
    if (open && initialFocus) setFocus(initialFocus);
  }, [open, initialFocus]);

  const focusedTrack =
    focus.kind === "track"
      ? tracks.find((t) => t.id === focus.trackId) ?? null
      : null;

  const title = focus.kind === "new-track" ? "Composer · New track" : `Composer · ${focusedTrack?.name ?? ""}`;

  return (
    <Sheet open={open} onClose={closeSheet} title={title}>
      <ComposerBody focus={focus} setFocus={setFocus} />
    </Sheet>
  );
}

// Stable empty array — Zustand selectors that return `?? []` on every call
// would otherwise trigger an infinite render loop (the inline literal is a
// fresh reference each time).
const EMPTY_THREAD: { role: "user" | "assistant"; content: string }[] = [];

function ComposerBody({
  focus,
  setFocus,
}: {
  focus: ComposerFocus;
  setFocus: (f: ComposerFocus) => void;
}) {
  const tracks = useStore(selectOrderedTracks);
  const roadmap = useStore((s) => s.roadmap);
  const thread = useStore((s) => s.composerThreads[focusKey(focus)] ?? EMPTY_THREAD);
  const appendMessage = useStore((s) => s.appendComposerMessage);
  const resetThread = useStore((s) => s.resetComposerThread);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ComposerResult | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length, lastResult]);

  // Reset transient state when the focus changes (each focus has its own thread)
  useEffect(() => {
    setLastResult(null);
    setError(null);
    setInput("");
  }, [focus.kind === "track" ? focus.trackId : "__new-track__"]);

  const focusedTrack =
    focus.kind === "track"
      ? tracks.find((t) => t.id === focus.trackId) ?? null
      : null;

  const hasKey = hasAnthropicKey();

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (!hasKey) {
      setError("Add your Anthropic API key in Settings first.");
      return;
    }

    setError(null);
    setInput("");
    appendMessage(focusKey(focus), { role: "user", content: trimmed });
    setLoading(true);
    try {
      const key = getAnthropicKey();
      if (!key) throw new Error("Missing API key");
      const provider = new AnthropicProvider({ apiKey: key });
      const result = await composeProposal(provider, {
        focus,
        userMessage: trimmed,
        thread,
        roadmap,
        today: todayStr(),
      });
      if (result.kind === "parse") {
        setError(`Couldn't parse the response: ${result.message}`);
        appendMessage(focusKey(focus), {
          role: "assistant",
          content: result.raw.slice(0, 500),
        });
        return;
      }
      appendMessage(focusKey(focus), { role: "assistant", content: result.message });
      setLastResult(result);
      // Surface the proposal as ghosts on the canvas + per-item accept UI
      if (hasProposal(result)) {
        useStore.getState().setCurrentProposal({
          focus,
          proposal: result.proposal,
          scopeWarning: result.scopeWarning,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Focus selector */}
      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1">
        <FocusChip
          active={focus.kind === "new-track"}
          onClick={() => setFocus({ kind: "new-track" })}
          color="#111827"
        >
          + New track
        </FocusChip>
        {tracks.map((t) => (
          <FocusChip
            key={t.id}
            active={focus.kind === "track" && focus.trackId === t.id}
            onClick={() => setFocus({ kind: "track", trackId: t.id })}
            color={t.color}
          >
            {t.name}
          </FocusChip>
        ))}
      </div>

      {/* No-key empty state */}
      {!hasKey ? (
        <div className="rounded-md border border-dashed border-ink/15 p-4 text-center text-sm text-muted">
          Add your Anthropic API key in <strong>⋯ Settings</strong> to use the
          Composer. Your key stays on this device.
        </div>
      ) : (
        <>
          {/* Thread */}
          <div
            ref={scrollRef}
            className="max-h-[50vh] min-h-[10rem] space-y-2 overflow-y-auto rounded-md bg-ink/[0.02] p-3"
            style={{ touchAction: "pan-y" }}
          >
            {thread.length === 0 && !loading ? (
              <p className="py-4 text-center text-[13px] text-muted">
                {focus.kind === "new-track"
                  ? "Tell me one thing you're working toward."
                  : `What's on your mind for ${focusedTrack?.name}?`}
              </p>
            ) : null}
            {thread.map((m, i) => (
              <Bubble key={i} role={m.role}>
                {m.content}
              </Bubble>
            ))}
            {loading ? <Bubble role="assistant">Thinking…</Bubble> : null}
          </div>

          {/* Live proposal — per-item accept / reject */}
          <ProposalDeck />

          {lastResult?.scopeWarning ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
              {lastResult.scopeWarning}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-overload/30 bg-overload/5 p-2 text-[11px] text-overload">
              {error}
            </div>
          ) : null}

          {/* Input row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type a message…"
              className={inputClass}
              autoFocus
              disabled={loading}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || loading}
              className="rounded-full bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-30"
            >
              Send
            </button>
          </div>

          {thread.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear the conversation for this focus?")) {
                  resetThread(focusKey(focus));
                  setLastResult(null);
                  setError(null);
                }
              }}
              className="self-start text-[11px] text-muted underline"
            >
              Clear conversation
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function FocusChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium ${
        active ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink"
      }`}
    >
      <span
        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
        style={{ background: color }}
      />
      {children}
    </button>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  return (
    <div className={role === "user" ? "text-right" : "text-left"}>
      <div
        className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] ${
          role === "user" ? "bg-ink text-white" : "bg-white ring-1 ring-ink/5"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function hasProposal(r: ComposerResult): boolean {
  const p = r.proposal;
  return (
    p.newTrack !== null ||
    p.newClips.length > 0 ||
    p.modifications.length > 0 ||
    p.removals.length > 0
  );
}
