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
import {
  type Command,
  type HistoryEntry,
  applyCommand,
} from "./commands";
import { makeClip, makeTrack } from "./factories";

const MAX_HISTORY = 100;

export interface ViewState {
  scrollX: number;
  pxPerDay: number;
}

export interface Selection {
  kind: "track" | "clip";
  id: string;
}

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

  addClip: (input: {
    trackId: string;
    kind: ClipKind;
    title: string;
    start: string;
    end?: string | null;
    effort?: number;
  }) => Clip;
  removeClip: (clipId: string) => void;
  patchClip: (clipId: string, changes: Partial<Omit<Clip, "id">>) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // View / selection (non-undoable)
  setView: (v: Partial<ViewState>) => void;
  setSelection: (s: Selection | null) => void;
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
    view: { scrollX: 0, pxPerDay: 4 },
    selection: null,
    history: { undo: [], redo: [] },

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

    setView(v) {
      set((s) => ({ view: { ...s.view, ...v } }));
    },

    setSelection(selection) {
      set({ selection });
    },
  };
});

/** Selector helpers (stable references for React subscribers). */
export const selectTracks = (s: LifetracksStore): Track[] => s.roadmap.tracks;
export const selectClips = (s: LifetracksStore): Clip[] => s.roadmap.clips;
export const selectOrderedTracks = (s: LifetracksStore): Track[] =>
  s.roadmap.tracks.slice().sort((a, b) => a.order - b.order);
