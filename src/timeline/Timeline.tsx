// Top-level timeline view. Composes track headers + SVG canvas + ruler + minimap.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Clip } from "@/core";
import { addMonths, daysBetween, todayStr } from "@/core";
import {
  selectClips,
  selectOrderedTracks,
  useStore,
} from "@/state";
import {
  EventDiamond,
  FlagMarker,
  StemBar,
  TaskBar,
  type ClipBox,
} from "./ClipShapes";
import { screenXForDate } from "./coords";
import { LANE_HEIGHT, FLAG_LANE_HEIGHT, computeTrackLayouts } from "./layout";
import { Minimap } from "./Minimap";
import { Ruler } from "./Ruler";
import { TrackHeaders } from "./TrackHeaders";
import { useTouchPanZoom } from "./useTouchPanZoom";

const HEADER_WIDTH_MOBILE = 96;
const RULER_HEIGHT = 28;
const MINIMAP_HEIGHT = 24;

export function Timeline() {
  const tracks = useStore(selectOrderedTracks);
  const clips = useStore(selectClips);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const removeTrack = useStore((s) => s.removeTrack);
  const renameTrack = useStore((s) => s.renameTrack);
  const setSelection = useStore((s) => s.setSelection);
  const selection = useStore((s) => s.selection);
  const openSheet = useStore((s) => s.openSheet);
  const horizonYears = useStore((s) => s.roadmap.settings.horizonYears);

  const today = todayStr();
  const origin = useMemo(() => addMonths(today, -60), [today]);
  const horizonEnd = useMemo(
    () => addMonths(today, horizonYears * 12),
    [today, horizonYears],
  );

  const layout = useMemo(() => computeTrackLayouts(tracks, clips), [tracks, clips]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(390 - HEADER_WIDTH_MOBILE);
  const [verticalScroll, setVerticalScroll] = useState(0);

  // Track canvas width with ResizeObserver
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setCanvasWidth(rect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center on today on first mount with non-default view
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || canvasWidth <= 0) return;
    centeredRef.current = true;
    // Default: today appears at 25% from the left.
    const targetScroll = daysBetween(origin, today) * view.pxPerDay - canvasWidth * 0.25;
    setView({ scrollX: targetScroll });
    // We only want this to run once, so deliberately omit `view` from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth]);

  useTouchPanZoom(canvasRef, view, setView, {
    getCanvasLeft: () => canvasRef.current?.getBoundingClientRect().left ?? 0,
  });

  // Per-clip bounding boxes for SVG rendering.
  const boxes = useMemo(() => {
    const out: { clip: Clip; box: ClipBox; color: string }[] = [];
    const trackColor = new Map(tracks.map((t) => [t.id, t.color]));
    for (const c of clips) {
      const lay = layout.layouts.get(c.trackId);
      if (!lay) continue;
      const color = trackColor.get(c.trackId) ?? "#5b8def";

      const sx = (d: string) => screenXForDate(origin, d, view.pxPerDay, view.scrollX);

      if (lay.collapsed) {
        const x = sx(c.start);
        const endIso =
          c.kind === "task"
            ? c.end ?? c.start
            : c.kind === "stem"
              ? c.recurrence?.until ?? c.start
              : c.start;
        const w =
          c.kind === "task" || c.kind === "stem"
            ? Math.max(2, sx(endIso) - x)
            : 4;
        out.push({
          clip: c,
          color,
          box: { x, y: lay.yStart + 4, w, h: lay.height - 8 },
        });
        continue;
      }

      if (c.kind === "flag") {
        if (lay.flagLaneY === null) continue;
        out.push({
          clip: c,
          color,
          box: { x: sx(c.start), y: lay.flagLaneY, w: 8, h: FLAG_LANE_HEIGHT },
        });
        continue;
      }

      if (c.kind === "stem") {
        const sub = lay.stemAssignments.get(c.id) ?? 0;
        const y = lay.stemLaneStartY + sub * LANE_HEIGHT;
        const x = sx(c.start);
        const w = Math.max(
          8,
          sx(c.recurrence?.until ?? addMonths(c.start, 6)) - x,
        );
        out.push({ clip: c, color, box: { x, y, w, h: LANE_HEIGHT } });
        continue;
      }

      // task or event share the goal/event sub-lane stack. Event disruption
      // zones render as their own background rects below (see `eventZones`);
      // here we just give the diamond a position-only box.
      const sub = lay.taskAssignments.get(c.id) ?? 0;
      const y = lay.taskLaneStartY + sub * LANE_HEIGHT;
      if (c.kind === "task") {
        const x = sx(c.start);
        const w = Math.max(8, sx(c.end ?? c.start) - x);
        out.push({ clip: c, color, box: { x, y, w, h: LANE_HEIGHT } });
      } else {
        out.push({
          clip: c,
          color,
          box: { x: sx(c.start), y, w: 0, h: LANE_HEIGHT },
        });
      }
    }
    return out;
  }, [clips, layout, origin, view.pxPerDay, view.scrollX, tracks]);

  // Pre-compute event disruption zones as their own rects so we don't fight
  // the per-clip box layout.
  const eventZones = useMemo(() => {
    const zones: { id: string; x: number; y: number; w: number; color: string }[] = [];
    const trackColor = new Map(tracks.map((t) => [t.id, t.color]));
    const sx = (d: string) => screenXForDate(origin, d, view.pxPerDay, view.scrollX);
    for (const c of clips) {
      if (c.kind !== "event" || !c.disruption) continue;
      const lay = layout.layouts.get(c.trackId);
      if (!lay || lay.collapsed) continue;
      const sub = lay.taskAssignments.get(c.id) ?? 0;
      const y = lay.taskLaneStartY + sub * LANE_HEIGHT;
      const zStart = addMonths(c.start, -c.disruption.monthsBefore);
      const zEnd = addMonths(c.start, c.disruption.monthsAfter);
      const x = sx(zStart);
      const w = sx(zEnd) - x;
      zones.push({
        id: c.id,
        x,
        y,
        w,
        color: trackColor.get(c.trackId) ?? "#5b8def",
      });
    }
    return zones;
  }, [clips, layout, origin, view.pxPerDay, view.scrollX, tracks]);

  const todayX = screenXForDate(origin, today, view.pxPerDay, view.scrollX);

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <div
          className="overflow-hidden border-r border-ink/5"
          style={{ width: HEADER_WIDTH_MOBILE }}
        >
          <div
            className="relative"
            style={{
              transform: `translateY(${-verticalScroll}px)`,
              willChange: "transform",
            }}
          >
            <TrackHeaders
              tracks={tracks}
              layout={layout}
              width={HEADER_WIDTH_MOBILE}
              onRemoveTrack={(id) => {
                if (window.confirm("Delete this track and its clips?")) removeTrack(id);
              }}
              onRenameTrack={renameTrack}
              onAddClipToTrack={(id) =>
                openSheet({ kind: "new-clip", defaults: { trackId: id } })
              }
            />
          </div>
        </div>

        <div
          ref={canvasRef}
          className="relative flex-1 touch-none overflow-y-auto overscroll-contain"
          onScroll={(e) => setVerticalScroll((e.target as HTMLDivElement).scrollTop)}
        >
          {tracks.length === 0 ? (
            <EmptyTimelineHint />
          ) : (
            <svg
              width={canvasWidth}
              height={Math.max(layout.totalHeight, 200)}
              style={{ display: "block" }}
            >
              {/* Track separator lines */}
              {tracks.map((t) => {
                const lay = layout.layouts.get(t.id);
                if (!lay) return null;
                return (
                  <line
                    key={`sep-${t.id}`}
                    x1={0}
                    y1={lay.yStart + lay.height - 0.5}
                    x2={canvasWidth}
                    y2={lay.yStart + lay.height - 0.5}
                    stroke="#f1f5f9"
                  />
                );
              })}
              {/* Event disruption zones (behind clips) */}
              {eventZones.map((z) => (
                <rect
                  key={`zone-${z.id}`}
                  x={z.x}
                  y={z.y + 2}
                  width={Math.max(0, z.w)}
                  height={LANE_HEIGHT - 4}
                  fill={z.color}
                  opacity={0.1}
                  rx={4}
                />
              ))}
              {/* Clips */}
              {boxes.map(({ clip, box, color }) => {
                const isSelected =
                  selection?.kind === "clip" && selection.id === clip.id;
                const onClick = () => {
                  setSelection({ kind: "clip", id: clip.id });
                  openSheet({ kind: "edit-clip", clipId: clip.id });
                };
                switch (clip.kind) {
                  case "task":
                    return (
                      <TaskBar
                        key={clip.id}
                        clip={clip}
                        trackColor={color}
                        box={box}
                        selected={isSelected}
                        onClick={onClick}
                      />
                    );
                  case "stem":
                    return (
                      <StemBar
                        key={clip.id}
                        clip={clip}
                        trackColor={color}
                        box={box}
                        selected={isSelected}
                        onClick={onClick}
                      />
                    );
                  case "event":
                    return (
                      <EventDiamond
                        key={clip.id}
                        clip={clip}
                        trackColor={color}
                        box={box}
                        selected={isSelected}
                        onClick={onClick}
                      />
                    );
                  case "flag":
                    return (
                      <FlagMarker
                        key={clip.id}
                        clip={clip}
                        trackColor={color}
                        box={box}
                        selected={isSelected}
                        onClick={onClick}
                      />
                    );
                }
              })}
              {/* Playhead */}
              {todayX >= 0 && todayX <= canvasWidth ? (
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={layout.totalHeight}
                  stroke="#e11d48"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              ) : null}
            </svg>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 border-t border-ink/5"
        style={{ height: RULER_HEIGHT }}
      >
        <div style={{ width: HEADER_WIDTH_MOBILE }} />
        <Ruler
          origin={origin}
          scrollX={view.scrollX}
          pxPerDay={view.pxPerDay}
          width={canvasWidth}
          height={RULER_HEIGHT}
        />
      </div>

      <div
        className="flex shrink-0 border-t border-ink/5"
        style={{ height: MINIMAP_HEIGHT }}
      >
        <div
          style={{ width: HEADER_WIDTH_MOBILE }}
          className="flex items-center justify-center text-[10px] text-muted"
        >
          {Math.round(view.pxPerDay * 30)}px/mo
        </div>
        <Minimap
          origin={origin}
          horizonEnd={horizonEnd}
          clips={clips}
          trackColorByClip={(c) => {
            const t = tracks.find((tr) => tr.id === c.trackId);
            return t?.color ?? "#5b8def";
          }}
          view={view}
          setView={setView}
          width={canvasWidth}
          viewportPxWidth={canvasWidth}
          height={MINIMAP_HEIGHT}
        />
      </div>
    </div>
  );
}

function EmptyTimelineHint() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-muted">
      <div className="mb-2 text-3xl" aria-hidden>
        🎼
      </div>
      <div className="max-w-[16rem]">
        No tracks yet. Tap <strong>+ Track</strong> above to start composing.
      </div>
    </div>
  );
}

