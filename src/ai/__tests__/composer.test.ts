import { describe, it, expect, vi } from "vitest";
import {
  type Roadmap,
  ClipSchema,
  RoadmapSchema,
  SettingsSchema,
  TrackSchema,
} from "@/core";
import type { Provider, ProviderResponse } from "../types";
import {
  composeProposal,
  enforceScope,
  parseComposerResponse,
  buildSystemPrompt,
} from "../composer";

const NOW = "2026-06-13";

function track(id: string, name = id, order = 0) {
  return TrackSchema.parse({
    id,
    name,
    color: "#5b8def",
    order,
    updatedAt: NOW,
  });
}

function span(id: string, trackId: string, start = "2026-07-01", end = "2026-08-01") {
  return ClipSchema.parse({
    id,
    trackId,
    kind: "span",
    title: id,
    start,
    end,
    updatedAt: NOW,
  });
}

function roadmap(partial: Partial<Roadmap> = {}): Roadmap {
  return RoadmapSchema.parse({
    version: 3,
    settings: SettingsSchema.parse({}),
    tracks: [],
    clips: [],
    ...partial,
  });
}

function fakeProvider(content: string): Provider {
  return {
    name: "Fake",
    async message(): Promise<ProviderResponse> {
      return { content, model: "fake-model" };
    },
  };
}

const validJson = JSON.stringify({
  message: "Proposing one span on Career.",
  questions: [],
  suggestions: [],
  proposal: {
    newTrack: null,
    newClips: [
      {
        trackId: "t-career",
        kind: "span",
        title: "Promo packet",
        start: "2026-07-01",
        end: "2026-12-01",
        effort: 4,
      },
    ],
    modifications: [],
    removals: [],
  },
});

describe("parseComposerResponse", () => {
  it("parses a plain JSON response", () => {
    const r = parseComposerResponse(validJson);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.proposal.newClips).toHaveLength(1);
    }
  });

  it("parses JSON inside a markdown code fence", () => {
    const r = parseComposerResponse("Here you go:\n```json\n" + validJson + "\n```");
    expect(r.kind).toBe("ok");
  });

  it("parses JSON with prose around it (uses first { ... last })", () => {
    const r = parseComposerResponse(`Sure! ${validJson} let me know.`);
    expect(r.kind).toBe("ok");
  });

  it("returns error when no JSON object can be found", () => {
    const r = parseComposerResponse("I cannot help with this.");
    expect(r.kind).toBe("error");
  });

  it("returns error when JSON shape fails validation", () => {
    const r = parseComposerResponse(`{ "message": "hi" }`);
    expect(r.kind).toBe("error");
  });
});

describe("enforceScope", () => {
  it("drops new-clips that reference tracks other than the focused track", () => {
    const r = enforceScope(
      {
        message: "x",
        questions: [],
        suggestions: [],
        proposal: {
          newTrack: null,
          newClips: [
            { trackId: "t-career", kind: "span", title: "good", start: "2026-07-01" },
            { trackId: "t-health", kind: "span", title: "bad", start: "2026-07-01" },
          ],
          modifications: [],
          removals: [],
        },
      },
      {
        focus: { kind: "track", trackId: "t-career" },
        userMessage: "",
        thread: [],
        roadmap: roadmap({ tracks: [track("t-career"), track("t-health", "Health", 1)] }),
        today: NOW,
      },
    );
    expect(r.result.proposal.newClips).toHaveLength(1);
    expect(r.result.proposal.newClips[0]!.trackId).toBe("t-career");
    expect(r.warning).toContain("referencing other tracks");
  });

  it("caps newClips at 8 per turn", () => {
    const tooMany = Array.from({ length: 11 }).map((_, i) => ({
      trackId: "t-career",
      kind: "span" as const,
      title: `c${i}`,
      start: "2026-07-01",
    }));
    const r = enforceScope(
      {
        message: "x",
        questions: [],
        suggestions: [],
        proposal: { newTrack: null, newClips: tooMany, modifications: [], removals: [] },
      },
      {
        focus: { kind: "track", trackId: "t-career" },
        userMessage: "",
        thread: [],
        roadmap: roadmap({ tracks: [track("t-career")] }),
        today: NOW,
      },
    );
    expect(r.result.proposal.newClips).toHaveLength(8);
    expect(r.warning).toContain("per-turn limit");
  });

  it("drops modifications/removals outside the focused track", () => {
    const careerClip = span("c-1", "t-career");
    const healthClip = span("c-2", "t-health");
    const r = enforceScope(
      {
        message: "x",
        questions: [],
        suggestions: [],
        proposal: {
          newTrack: null,
          newClips: [],
          modifications: [
            { clipId: "c-1", changes: { title: "ok" } },
            { clipId: "c-2", changes: { title: "bad" } },
          ],
          removals: ["c-2"],
        },
      },
      {
        focus: { kind: "track", trackId: "t-career" },
        userMessage: "",
        thread: [],
        roadmap: roadmap({
          tracks: [track("t-career"), track("t-health", "Health", 1)],
          clips: [careerClip, healthClip],
        }),
        today: NOW,
      },
    );
    expect(r.result.proposal.modifications).toHaveLength(1);
    expect(r.result.proposal.modifications[0]!.clipId).toBe("c-1");
    expect(r.result.proposal.removals).toEqual([]);
    expect(r.warning).toContain("modification");
    expect(r.warning).toContain("removal");
  });

  it("drops newTrack when focus is an existing track", () => {
    const r = enforceScope(
      {
        message: "x",
        questions: [],
        suggestions: [],
        proposal: {
          newTrack: { tempId: "T1", name: "Surprise", color: "#5b8def" },
          newClips: [],
          modifications: [],
          removals: [],
        },
      },
      {
        focus: { kind: "track", trackId: "t-career" },
        userMessage: "",
        thread: [],
        roadmap: roadmap({ tracks: [track("t-career")] }),
        today: NOW,
      },
    );
    expect(r.result.proposal.newTrack).toBeNull();
    expect(r.warning).toContain("new track");
  });

  it("allows newClips on a proposed new track's tempId when focus is new-track", () => {
    const r = enforceScope(
      {
        message: "x",
        questions: [],
        suggestions: [],
        proposal: {
          newTrack: { tempId: "T1", name: "Health", color: "#e07a5f" },
          newClips: [
            { trackId: "T1", kind: "span", title: "ok", start: "2026-07-01" },
            { trackId: "t-other", kind: "span", title: "bad", start: "2026-07-01" },
          ],
          modifications: [],
          removals: [],
        },
      },
      {
        focus: { kind: "new-track" },
        userMessage: "",
        thread: [],
        roadmap: roadmap(),
        today: NOW,
      },
    );
    expect(r.result.proposal.newClips).toHaveLength(1);
    expect(r.result.proposal.newClips[0]!.trackId).toBe("T1");
    expect(r.warning).toContain("referencing other tracks");
  });

  it("caps suggestions at 2", () => {
    const r = enforceScope(
      {
        message: "x",
        questions: [],
        suggestions: ["a", "b", "c", "d"],
        proposal: { newTrack: null, newClips: [], modifications: [], removals: [] },
      },
      {
        focus: { kind: "track", trackId: "t-career" },
        userMessage: "",
        thread: [],
        roadmap: roadmap({ tracks: [track("t-career")] }),
        today: NOW,
      },
    );
    expect(r.result.suggestions).toHaveLength(2);
    expect(r.result.suggestions).toEqual(["a", "b"]);
  });
});

describe("buildSystemPrompt", () => {
  it("includes the focused-new-track marker when focus is new-track", () => {
    const prompt = buildSystemPrompt({
      focus: { kind: "new-track" },
      userMessage: "",
      thread: [],
      roadmap: roadmap(),
      today: NOW,
    });
    expect(prompt).toContain("NEW TRACK");
    expect(prompt).toContain("T1");
  });

  it("includes existing clip ids for the focused track and per-month capacity", () => {
    const prompt = buildSystemPrompt({
      focus: { kind: "track", trackId: "t-career" },
      userMessage: "",
      thread: [],
      roadmap: roadmap({
        tracks: [track("t-career", "Career")],
        clips: [span("c-promo", "t-career")],
      }),
      today: NOW,
    });
    expect(prompt).toContain("Career");
    expect(prompt).toContain("c-promo");
    expect(prompt).toContain("REMAINING CAPACITY");
  });
});

describe("composeProposal", () => {
  it("returns a validated, scope-enforced result on the happy path", async () => {
    const provider = fakeProvider(validJson);
    const result = await composeProposal(provider, {
      focus: { kind: "track", trackId: "t-career" },
      userMessage: "Help me with promo",
      thread: [],
      roadmap: roadmap({ tracks: [track("t-career", "Career")] }),
      today: NOW,
    });
    expect("kind" in result && result.kind === "parse").toBe(false);
    if (!("kind" in result)) {
      expect(result.proposal.newClips).toHaveLength(1);
      expect(result.scopeWarning).toBeUndefined();
    }
  });

  it("returns a ComposerError when the response shape is invalid", async () => {
    const provider = fakeProvider(`{"message":"hi"}`);
    const result = await composeProposal(provider, {
      focus: { kind: "track", trackId: "t-career" },
      userMessage: "x",
      thread: [],
      roadmap: roadmap({ tracks: [track("t-career", "Career")] }),
      today: NOW,
    });
    expect("kind" in result && result.kind === "parse").toBe(true);
  });

  it("sends the system prompt + thread + user message to the provider", async () => {
    const spy = vi.fn(async () => ({ content: validJson, model: "fake" }));
    const provider: Provider = { name: "Fake", message: spy };
    await composeProposal(provider, {
      focus: { kind: "track", trackId: "t-career" },
      userMessage: "Help me",
      thread: [{ role: "user", content: "earlier" }, { role: "assistant", content: "OK." }],
      roadmap: roadmap({ tracks: [track("t-career", "Career")] }),
      today: NOW,
    });
    expect(spy).toHaveBeenCalledOnce();
    const calls = spy.mock.calls as unknown as Array<
      [{ system: string; messages: { role: string; content: string }[] }]
    >;
    const arg = calls[0]![0];
    expect(arg.system).toContain("Lifetracks Composer");
    expect(arg.messages).toHaveLength(3);
    expect(arg.messages[arg.messages.length - 1]).toEqual({
      role: "user",
      content: "Help me",
    });
  });
});
