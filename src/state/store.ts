// Zustand store: the only source of truth React reads from. All mutations
// flow through `executeCommand`, which pushes a forward/inverse pair onto
// history. View, selection, and history live alongside the roadmap but
// only roadmap mutations are undoable.

import { create } from "zustand";
import {
  type Clip,
  type ClipKind,
  type Roadmap,
  type Track,
  RoadmapSchema,
  SettingsSchema,
  todayStr,
} from "@/core";
import type { ComposerFocus, ComposerProposal } from "@/ai";
import {
  type Command,
  type HistoryEntry,
  applyCommand,
} from "./commands";
import { makeClip, makeTrack } from "./factories";
import { buildSampleLife } from "./seeds";

const MAX_HISTORY = 100;

export interface ViewState {
  scrollX: number;
  pxPerDay: number;
}

export interface Selection {
  kind: "track" | "clip";
  id: string;
}

export type SheetState =
  | { kind: "new-track" }
  | { kind: "new-clip"; defaults?: { trackId?: string; start?: string } }
  | { kind: "edit-clip"; clipId: string }
  | { kind: "edit-track"; trackId: string }
  | { kind: "composer"; focus: { kind: "new-track" } | { kind: "track"; trackId: string } }
  | { kind: "settings" }
  | null;

interface ComposerMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PendingProposal {
  focus: ComposerFocus;
  proposal: ComposerProposal;
  /** When the newTrack has been materialised, this holds its real track id. */
  resolvedNewTrackId?: string;
  /** The tempId of the newTrack at the time it was materialised — used to keep
      resolving subsequent newClips that still reference the old tempId even
      after `proposal.newTrack` is cleared from the proposal. */
  resolvedNewTrackTempId?: string;
  scopeWarning?: string;
}

export type ProposalItemRef =
  | { kind: "newTrack" }
  | { kind: "newClip"; index: number }
  | { kind: "modification"; index: number }
  | { kind: "removal"; index: number };

export interface LifetracksStore {
  // Persisted
  roadmap: Roadmap;

  // Ephemeral
  ready: boolean;
  view: ViewState;
  selection: Selection | null;
  history: { undo: HistoryEntry[]; redo: HistoryEntry[] };

  // Hydration (called once on boot from persistence)
  hydrate: (roadmap: Roadmap) => void;

  // Mutations (each produces a history entry)
  addTrack: (input: { name: string; color?: string }) => Track;
  removeTrack: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  reorderTracks: (orderedIds: string[]) => void;
  patchTrack: (trackId: string, changes: Partial<Omit<Track, "id">>) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;

  addClip: (input: {
    trackId: string;
    kind: ClipKind;
    title: string;
    start: string;
    end?: string | null;
    effort?: number;
    recurrence?: {
      freq: "daily" | "weekly" | "biweekly" | "monthly";
      until: string;
      interval?: number;
      count?: number;
    };
  }) => Clip;
  removeClip: (clipId: string) => void;
  patchClip: (clipId: string, changes: Partial<Omit<Clip, "id">>) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Insert a curated sample roadmap (undoable). */
  loadSample: () => void;

  // View / selection / sheet (non-undoable)
  setView: (v: Partial<ViewState>) => void;
  setSelection: (s: Selection | null) => void;
  sheet: SheetState;
  openSheet: (s: NonNullable<SheetState>) => void;
  closeSheet: () => void;

  // Composer per-focus threads (ephemeral; lost on refresh — Phase 4 will persist)
  composerThreads: Record<string, ComposerMessage[]>;
  appendComposerMessage: (focusKey: string, message: ComposerMessage) => void;
  resetComposerThread: (focusKey: string) => void;

  // Pending Composer proposal (rendered as ghosts on the canvas)
  currentProposal: PendingProposal | null;
  setCurrentProposal: (p: PendingProposal | null) => void;
  acceptProposalItem: (item: ProposalItemRef) => void;
  rejectProposalItem: (item: ProposalItemRef) => void;
  acceptAllProposal: () => void;
}

const EMPTY_ROADMAP: Roadmap = RoadmapSchema.parse({
  version: 3,
  settings: SettingsSchema.parse({}),
  tracks: [],
  clips: [],
});

export const useStore = create<LifetracksStore>((set, get) => {
  function executeCommand(forward: Command, inverse: Command): void {
    set((s) => ({
      roadmap: applyCommand(s.roadmap, forward, todayStr()),
      history: {
        undo: [...s.history.undo, { forward, inverse }].slice(-MAX_HISTORY),
        redo: [],
      },
    }));
  }

  return {
    roadmap: EMPTY_ROADMAP,
    ready: false,
    view: { scrollX: 0, pxPerDay: 10 },
    selection: null,
    sheet: null,
    history: { undo: [], redo: [] },
    composerThreads: {},
    currentProposal: null,

    hydrate(roadmap) {
      set({ roadmap, ready: true, history: { undo: [], redo: [] } });
    },

    addTrack(input) {
      // Newest-on-top per spec: new tracks get order = 0, others shift down.
      const now = todayStr();
      const existing = get().roadmap.tracks;
      const track = makeTrack(
        { name: input.name, color: input.color, order: 0 },
        now,
      );
      const reorder: Command = {
        type: "reorderTracks",
        orders: existing.map((t) => ({ id: t.id, order: t.order + 1 })),
      };
      const reorderBack: Command = {
        type: "reorderTracks",
        orders: existing.map((t) => ({ id: t.id, order: t.order })),
      };
      const forward: Command = {
        type: "batch",
        cmds: [reorder, { type: "addTrack", track }],
      };
      const inverse: Command = {
        type: "batch",
        cmds: [{ type: "removeTrack", trackId: track.id }, reorderBack],
      };
      executeCommand(forward, inverse);
      return track;
    },

    removeTrack(trackId) {
      const { roadmap } = get();
      const track = roadmap.tracks.find((t) => t.id === trackId);
      if (!track) return;
      const clips = roadmap.clips.filter((c) => c.trackId === trackId);
      const forward: Command = {
        type: "batch",
        cmds: [
          ...clips.map<Command>((c) => ({ type: "removeClip", clipId: c.id })),
          { type: "removeTrack", trackId },
        ],
      };
      const inverse: Command = {
        type: "batch",
        cmds: [
          { type: "addTrack", track },
          ...clips.map<Command>((c) => ({ type: "addClip", clip: c })),
        ],
      };
      executeCommand(forward, inverse);
    },

    renameTrack(trackId, name) {
      const before = get().roadmap.tracks.find((t) => t.id === trackId);
      if (!before || before.name === name) return;
      executeCommand(
        { type: "patchTrack", trackId, after: { name } },
        { type: "patchTrack", trackId, after: { name: before.name } },
      );
    },

    reorderTracks(orderedIds) {
      const before = get().roadmap.tracks;
      const beforeOrders = before.map((t) => ({ id: t.id, order: t.order }));
      const afterOrders = orderedIds.map((id, i) => ({ id, order: i }));
      executeCommand(
        { type: "reorderTracks", orders: afterOrders },
        { type: "reorderTracks", orders: beforeOrders },
      );
    },

    patchTrack(trackId, changes) {
      const before = get().roadmap.tracks.find((t) => t.id === trackId);
      if (!before) return;
      const beforeSubset: Partial<Omit<Track, "id">> = {};
      for (const k of Object.keys(changes) as (keyof Track)[]) {
        if (k === "id") continue;
        (beforeSubset as Record<string, unknown>)[k] = (before as Record<string, unknown>)[k];
      }
      executeCommand(
        { type: "patchTrack", trackId, after: changes },
        { type: "patchTrack", trackId, after: beforeSubset },
      );
    },

    toggleMute(trackId) {
      const before = get().roadmap.tracks.find((t) => t.id === trackId);
      if (!before) return;
      executeCommand(
        { type: "patchTrack", trackId, after: { muted: !before.muted } },
        { type: "patchTrack", trackId, after: { muted: before.muted } },
      );
    },

    toggleSolo(trackId) {
      const before = get().roadmap.tracks.find((t) => t.id === trackId);
      if (!before) return;
      executeCommand(
        { type: "patchTrack", trackId, after: { soloed: !before.soloed } },
        { type: "patchTrack", trackId, after: { soloed: before.soloed } },
      );
    },

    addClip(input) {
      const clip = makeClip(input, todayStr());
      executeCommand(
        { type: "addClip", clip },
        { type: "removeClip", clipId: clip.id },
      );
      return clip;
    },

    removeClip(clipId) {
      const clip = get().roadmap.clips.find((c) => c.id === clipId);
      if (!clip) return;
      executeCommand(
        { type: "removeClip", clipId },
        { type: "addClip", clip },
      );
    },

    patchClip(clipId, changes) {
      const before = get().roadmap.clips.find((c) => c.id === clipId);
      if (!before) return;
      const beforeSubset: Partial<Omit<Clip, "id">> = {};
      for (const k of Object.keys(changes) as (keyof Clip)[]) {
        if (k === "id") continue;
        // Capture only the fields actually being changed for a minimal inverse.
        (beforeSubset as Record<string, unknown>)[k] = (before as Record<string, unknown>)[k];
      }
      executeCommand(
        { type: "patchClip", clipId, after: changes },
        { type: "patchClip", clipId, after: beforeSubset },
      );
    },

    undo() {
      const { history } = get();
      const entry = history.undo.at(-1);
      if (!entry) return;
      set((s) => ({
        roadmap: applyCommand(s.roadmap, entry.inverse, todayStr()),
        history: {
          undo: s.history.undo.slice(0, -1),
          redo: [...s.history.redo, entry],
        },
      }));
    },

    redo() {
      const { history } = get();
      const entry = history.redo.at(-1);
      if (!entry) return;
      set((s) => ({
        roadmap: applyCommand(s.roadmap, entry.forward, todayStr()),
        history: {
          undo: [...s.history.undo, entry],
          redo: s.history.redo.slice(0, -1),
        },
      }));
    },

    canUndo() {
      return get().history.undo.length > 0;
    },

    canRedo() {
      return get().history.redo.length > 0;
    },

    loadSample() {
      const seed = buildSampleLife(todayStr());
      const forward: Command = {
        type: "batch",
        cmds: [
          ...seed.tracks.map<Command>((t) => ({ type: "addTrack", track: t })),
          ...seed.clips.map<Command>((c) => ({ type: "addClip", clip: c })),
        ],
      };
      const inverse: Command = {
        type: "batch",
        cmds: [
          ...seed.clips.map<Command>((c) => ({ type: "removeClip", clipId: c.id })),
          ...seed.tracks.map<Command>((t) => ({ type: "removeTrack", trackId: t.id })),
        ],
      };
      executeCommand(forward, inverse);
    },

    setView(v) {
      set((s) => ({ view: { ...s.view, ...v } }));
    },

    setSelection(selection) {
      set({ selection });
    },

    openSheet(sheet) {
      set({ sheet });
    },

    closeSheet() {
      set({ sheet: null });
    },

    appendComposerMessage(focusKey, message) {
      set((s) => {
        const prev = s.composerThreads[focusKey] ?? [];
        return {
          composerThreads: {
            ...s.composerThreads,
            [focusKey]: [...prev, message].slice(-50),
          },
        };
      });
    },

    resetComposerThread(focusKey) {
      set((s) => {
        const next = { ...s.composerThreads };
        delete next[focusKey];
        return { composerThreads: next };
      });
    },

    setCurrentProposal(p) {
      set({ currentProposal: p });
    },

    acceptProposalItem(item) {
      const proposal = get().currentProposal;
      if (!proposal) return;
      const store = get();

      // Re-reads currentProposal so we don't clobber state set in this call
      // (resolveTrackId stamps `resolvedNewTrackId` on the store; the closure
      // `proposal` is now stale).
      const removeItemFromProposal = (mutator: (p: ComposerProposal) => ComposerProposal): void => {
        const fresh = get().currentProposal;
        if (!fresh) return;
        const next = mutator(fresh.proposal);
        const empty =
          next.newTrack === null &&
          next.newClips.length === 0 &&
          next.modifications.length === 0 &&
          next.removals.length === 0;
        set({
          currentProposal: empty ? null : { ...fresh, proposal: next },
        });
      };

      // Resolve the actual track id for a given trackRef (real id or tempId).
      // Once the newTrack has been materialised, subsequent newClips may still
      // reference the original tempId — we map them via resolvedNewTrackTempId.
      const resolveTrackId = (refId: string): string | null => {
        const fresh = get().currentProposal;
        if (fresh?.resolvedNewTrackId && refId === fresh.resolvedNewTrackTempId) {
          return fresh.resolvedNewTrackId;
        }
        if (fresh?.proposal.newTrack && refId === fresh.proposal.newTrack.tempId) {
          if (fresh.resolvedNewTrackId) return fresh.resolvedNewTrackId;
          const tempId = fresh.proposal.newTrack.tempId;
          const created = store.addTrack({
            name: fresh.proposal.newTrack.name,
            color: fresh.proposal.newTrack.color,
          });
          set((s) =>
            s.currentProposal
              ? {
                  currentProposal: {
                    ...s.currentProposal,
                    resolvedNewTrackId: created.id,
                    resolvedNewTrackTempId: tempId,
                  },
                }
              : {},
          );
          return created.id;
        }
        if (store.roadmap.tracks.some((t) => t.id === refId)) return refId;
        return null;
      };

      switch (item.kind) {
        case "newTrack": {
          if (!proposal.proposal.newTrack) return;
          // Materialise via resolveTrackId — and clear the newTrack field
          resolveTrackId(proposal.proposal.newTrack.tempId);
          removeItemFromProposal((p) => ({ ...p, newTrack: null }));
          return;
        }
        case "newClip": {
          const clip = proposal.proposal.newClips[item.index];
          if (!clip) return;
          const trackId = resolveTrackId(clip.trackId);
          if (!trackId) {
            console.warn("Couldn't resolve trackId for proposed clip:", clip);
            return;
          }
          store.addClip({
            trackId,
            kind: clip.kind,
            title: clip.title,
            start: clip.start,
            end: clip.end ?? null,
            effort: clip.effort,
            recurrence: clip.recurrence
              ? {
                  freq: clip.recurrence.freq,
                  until: clip.recurrence.until,
                  interval: clip.recurrence.interval ?? 1,
                  count: clip.recurrence.count ?? 1,
                }
              : undefined,
          });
          removeItemFromProposal((p) => ({
            ...p,
            newClips: p.newClips.filter((_, i) => i !== item.index),
          }));
          return;
        }
        case "modification": {
          const mod = proposal.proposal.modifications[item.index];
          if (!mod) return;
          // Fill in defaults on a partial recurrence so the patch matches
          // the strict Clip schema.
          const changes: Partial<Omit<Clip, "id">> = {
            title: mod.changes.title,
            start: mod.changes.start,
            end: mod.changes.end,
            effort: mod.changes.effort,
            notes: mod.changes.notes,
            status: mod.changes.status,
            startTime: mod.changes.startTime,
            recurrence:
              mod.changes.recurrence === null
                ? null
                : mod.changes.recurrence
                  ? {
                      freq: mod.changes.recurrence.freq,
                      until: mod.changes.recurrence.until,
                      interval: mod.changes.recurrence.interval ?? 1,
                      count: mod.changes.recurrence.count ?? 1,
                    }
                  : undefined,
          };
          // Strip undefineds so patchClip only sees real changes.
          for (const k of Object.keys(changes) as (keyof typeof changes)[]) {
            if (changes[k] === undefined) delete changes[k];
          }
          store.patchClip(mod.clipId, changes);
          removeItemFromProposal((p) => ({
            ...p,
            modifications: p.modifications.filter((_, i) => i !== item.index),
          }));
          return;
        }
        case "removal": {
          const clipId = proposal.proposal.removals[item.index];
          if (!clipId) return;
          store.removeClip(clipId);
          removeItemFromProposal((p) => ({
            ...p,
            removals: p.removals.filter((_, i) => i !== item.index),
          }));
          return;
        }
      }
    },

    rejectProposalItem(item) {
      const proposal = get().currentProposal;
      if (!proposal) return;

      const removeItemFromProposal = (mutator: (p: ComposerProposal) => ComposerProposal): void => {
        const fresh = get().currentProposal;
        if (!fresh) return;
        const next = mutator(fresh.proposal);
        const empty =
          next.newTrack === null &&
          next.newClips.length === 0 &&
          next.modifications.length === 0 &&
          next.removals.length === 0;
        set({
          currentProposal: empty ? null : { ...fresh, proposal: next },
        });
      };

      switch (item.kind) {
        case "newTrack": {
          // Dropping a new track also drops any clips that referenced its tempId.
          const tempId = proposal.proposal.newTrack?.tempId;
          removeItemFromProposal((p) => ({
            ...p,
            newTrack: null,
            newClips: tempId
              ? p.newClips.filter((c) => c.trackId !== tempId)
              : p.newClips,
          }));
          return;
        }
        case "newClip": {
          removeItemFromProposal((p) => ({
            ...p,
            newClips: p.newClips.filter((_, i) => i !== item.index),
          }));
          return;
        }
        case "modification": {
          removeItemFromProposal((p) => ({
            ...p,
            modifications: p.modifications.filter((_, i) => i !== item.index),
          }));
          return;
        }
        case "removal": {
          removeItemFromProposal((p) => ({
            ...p,
            removals: p.removals.filter((_, i) => i !== item.index),
          }));
          return;
        }
      }
    },

    acceptAllProposal() {
      const proposal = get().currentProposal;
      if (!proposal) return;
      // Snapshot counts up front. Each accept shifts the corresponding
      // array, so we always accept index 0 of the remaining items.
      const { newTrack, newClips, modifications, removals } = proposal.proposal;
      if (newTrack) get().acceptProposalItem({ kind: "newTrack" });
      for (let i = 0; i < newClips.length; i++) get().acceptProposalItem({ kind: "newClip", index: 0 });
      for (let i = 0; i < modifications.length; i++) get().acceptProposalItem({ kind: "modification", index: 0 });
      for (let i = 0; i < removals.length; i++) get().acceptProposalItem({ kind: "removal", index: 0 });
    },
  };
});

/** Selector helpers (stable references for React subscribers). */
export const selectTracks = (s: LifetracksStore): Track[] => s.roadmap.tracks;
export const selectClips = (s: LifetracksStore): Clip[] => s.roadmap.clips;

// Memoised sort: returns the same array reference as long as the input
// array is the same reference. Without this, every render of any component
// using `selectOrderedTracks` would produce a new array and Zustand's
// `getSnapshot` would detect an infinite loop (React 18 useSyncExternalStore).
const orderedCache = new WeakMap<readonly Track[], Track[]>();
export function selectOrderedTracks(s: LifetracksStore): Track[] {
  const raw = s.roadmap.tracks;
  let sorted = orderedCache.get(raw);
  if (!sorted) {
    sorted = raw.slice().sort((a, b) => a.order - b.order);
    orderedCache.set(raw, sorted);
  }
  return sorted;
}
