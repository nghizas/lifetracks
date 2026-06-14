// Per-track Y layout. Each track reserves a small "label row" at the top for
// the floating tag (track name + M/S/+ buttons) so clips never visually
// overlap the label.
//
// Within a track:
//   1. label row (always)
//   2. (optional) thin flag row
//   3. stack of task/event sub-lanes (greedy interval packing)
//   4. stack of stem sub-lanes (greedy interval packing)
// Heights grow to fit so no two clips ever visually overlap.
// Pure — no React. Driven by core's `packIntoLanes`.

import { type Clip, type Track, packIntoLanes } from "@/core";

export const LANE_HEIGHT = 28;
export const FLAG_LANE_HEIGHT = 14;
export const LABEL_ROW_HEIGHT = 26;
export const COLLAPSED_TRACK_HEIGHT = LABEL_ROW_HEIGHT;
export const MIN_TRACK_HEIGHT = LABEL_ROW_HEIGHT + LANE_HEIGHT;

export interface TrackLayout {
  yStart: number;
  height: number;
  collapsed: boolean;
  flagLaneY: number | null;
  taskLaneStartY: number;
  taskLaneCount: number;
  taskAssignments: Map<string, number>;
  stemLaneStartY: number;
  stemLaneCount: number;
  stemAssignments: Map<string, number>;
}

export interface LayoutResult {
  layouts: Map<string, TrackLayout>;
  totalHeight: number;
}

export function computeTrackLayouts(
  orderedTracks: readonly Track[],
  clips: readonly Clip[],
): LayoutResult {
  const layouts = new Map<string, TrackLayout>();
  let y = 0;

  for (const track of orderedTracks) {
    const trackClips = clips.filter((c) => c.trackId === track.id);
    const flags = trackClips.filter((c) => c.kind === "flag");
    const taskEvent = trackClips.filter((c) => c.kind === "task" || c.kind === "event");
    const stems = trackClips.filter((c) => c.kind === "stem");

    if (track.collapsed) {
      layouts.set(track.id, {
        yStart: y,
        height: COLLAPSED_TRACK_HEIGHT,
        collapsed: true,
        flagLaneY: null,
        taskLaneStartY: y + LABEL_ROW_HEIGHT,
        taskLaneCount: 0,
        taskAssignments: new Map(),
        stemLaneStartY: y + LABEL_ROW_HEIGHT,
        stemLaneCount: 0,
        stemAssignments: new Map(),
      });
      y += COLLAPSED_TRACK_HEIGHT;
      continue;
    }

    // Reserve the label row at the top of every track.
    let inner = LABEL_ROW_HEIGHT;
    let flagLaneY: number | null = null;
    if (flags.length > 0) {
      flagLaneY = y + inner;
      inner += FLAG_LANE_HEIGHT;
    }

    const taskPack = packIntoLanes(taskEvent);
    const taskLaneStartY = y + inner;
    const taskLaneCount = Math.max(taskEvent.length > 0 ? 1 : 0, taskPack.laneCount);
    inner += taskLaneCount * LANE_HEIGHT;

    const stemPack = packIntoLanes(stems);
    const stemLaneStartY = y + inner;
    const stemLaneCount = stemPack.laneCount;
    inner += stemLaneCount * LANE_HEIGHT;

    const height = Math.max(MIN_TRACK_HEIGHT, inner);
    layouts.set(track.id, {
      yStart: y,
      height,
      collapsed: false,
      flagLaneY,
      taskLaneStartY,
      taskLaneCount,
      taskAssignments: taskPack.assignments,
      stemLaneStartY,
      stemLaneCount,
      stemAssignments: stemPack.assignments,
    });
    y += height;
  }

  return { layouts, totalHeight: y };
}
