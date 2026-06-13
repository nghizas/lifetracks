// Commands are the unit of undoable change. Every store action computes a
// `forward` command and its `inverse`, applies forward, and pushes the pair
// onto the undo stack. Undo applies the stored inverse; redo applies the
// stored forward. Inverses are pre-computed at the action layer so the action
// can capture state it needs (e.g. the clips cascaded by deleteTrack).

import type { Clip, Roadmap, Track } from "@/core";

export type Command =
  | { type: "addTrack"; track: Track }
  | { type: "removeTrack"; trackId: string }
  | { type: "patchTrack"; trackId: string; after: Partial<Omit<Track, "id">> }
  | { type: "reorderTracks"; orders: { id: string; order: number }[] }
  | { type: "addClip"; clip: Clip }
  | { type: "removeClip"; clipId: string }
  | {
      type: "patchClip";
      clipId: string;
      after: Partial<Omit<Clip, "id">>;
    }
  | { type: "batch"; cmds: Command[] };

export function applyCommand(roadmap: Roadmap, cmd: Command, now: string): Roadmap {
  switch (cmd.type) {
    case "addTrack":
      if (roadmap.tracks.some((t) => t.id === cmd.track.id)) return roadmap;
      return { ...roadmap, tracks: [...roadmap.tracks, cmd.track] };

    case "removeTrack":
      return {
        ...roadmap,
        tracks: roadmap.tracks.filter((t) => t.id !== cmd.trackId),
      };

    case "patchTrack": {
      const tracks = roadmap.tracks.map((t) =>
        t.id === cmd.trackId ? { ...t, ...cmd.after, updatedAt: now } : t,
      );
      return { ...roadmap, tracks };
    }

    case "reorderTracks": {
      const next = new Map(cmd.orders.map((o) => [o.id, o.order]));
      const tracks = roadmap.tracks.map((t) => {
        const n = next.get(t.id);
        return n === undefined || n === t.order ? t : { ...t, order: n, updatedAt: now };
      });
      return { ...roadmap, tracks };
    }

    case "addClip":
      if (roadmap.clips.some((c) => c.id === cmd.clip.id)) return roadmap;
      return { ...roadmap, clips: [...roadmap.clips, cmd.clip] };

    case "removeClip":
      return {
        ...roadmap,
        clips: roadmap.clips.filter((c) => c.id !== cmd.clipId),
      };

    case "patchClip": {
      const clips = roadmap.clips.map((c) =>
        c.id === cmd.clipId ? { ...c, ...cmd.after, updatedAt: now } : c,
      );
      return { ...roadmap, clips };
    }

    case "batch": {
      let r = roadmap;
      for (const sub of cmd.cmds) r = applyCommand(r, sub, now);
      return r;
    }
  }
}

export interface HistoryEntry {
  forward: Command;
  inverse: Command;
}
