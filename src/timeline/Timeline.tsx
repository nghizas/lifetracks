// Top-level timeline view. Composes track headers + SVG canvas + ruler + a
// bottom control row (Today + zoom −/+) + fat purple minimap.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Clip } from "@/core";
import { addDays, addMonths, daysBetween, fmtDate, parseDate, todayStr } from "@/core";
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
import {
  clampPxPerDay,
  screenXForDate,
} from "./coords";
import { LANE_HEIGHT, FLAG_LANE_HEIGHT, computeTrackLayouts } from "./layout";
import { Minimap } from "./Minimap";
import { Ruler } from "./Ruler";
import { TrackHeaders } from "./TrackHeaders";
import { useTouchPanZoom } from "./useTouchPanZoom";

const RULER_HEIGHT = 36;
const MINIMAP_HEIGHT = 80;
const CONTROLS_HEIGHT = 48;
const HEADER_MIN = 80;
const HEADER_MAX = 240;
const DIVIDER_WIDTH = 6;
const ZOOM_FACTOR = 1.6;

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

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(300);
  const [canvasHeight, setCanvasHeight] = useState(400);
  const [verticalScroll, setVerticalScroll] = useState(0);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setCanvasWidth(rect.width);
        setCanvasHeight(rect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Jumps the viewport so today sits ~25% from the left.
  const jumpToToday = () => {
    const targetScroll = daysBetween(origin, today) * view.pxPerDay - canvasWidth * 0.25;
    setView({ scrollX: targetScroll });
  };

  const zoomAtCenter = (factor: number) => {
    const anchorScreenX = canvasWidth / 2;
    const anchorWorld = anchorScreenX + view.scrollX;
    const newPxPerDay = clampPxPerDay(view.pxPerDay * factor);
    const scale = newPxPerDay / view.pxPerDay;
    setView({
      pxPerDay: newPxPerDay,
      scrollX: anchorWorld * scale - anchorScreenX,
    });
  };

  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || canvasWidth <= 0) return;
    centeredRef.current = true;
    const targetScroll = daysBetween(origin, today) * view.pxPerDay - canvasWidth * 0.25;
    setView({ scrollX: targetScroll });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth]);

  useTouchPanZoom(canvasRef, view, setView, {
    getCanvasLeft: () => canvasRef.current?.getBoundingClientRect().left ?? 0,
  });

  const monthLines = useMemo(() => {
    const startDate = addDays(origin, Math.floor(view.scrollX / view.pxPerDay) - 31);
    const endDate = addDays(
      origin,
      Math.ceil((view.scrollX + canvasWidth) / view.pxPerDay) + 31,
    );
    const lines: { date: string; x: number; isYearStart: boolean }[] = [];
    let cursor = fmtDate(
      new Date(parseDate(startDate).getFullYear(), parseDate(startDate).getMonth(), 1),
    );
    while (parseDate(cursor) <= parseDate(endDate)) {
      const x = screenXForDate(origin, cursor, view.pxPerDay, view.scrollX);
      lines.push({
        date: cursor,
        x,
        isYearStart: parseDate(cursor).getMonth() === 0,
      });
      cursor = addMonths(cursor, 1);
    }
    return lines;
  }, [origin, view.scrollX, view.pxPerDay, canvasWidth]);

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
        const w = c.kind === "task" || c.kind === "stem" ? Math.max(2, sx(endIso) - x) : 4;
        out.push({ clip: c, color, box: { x, y: lay.yStart + 4, w, h: lay.height - 8 } });
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
        const w = Math.max(8, sx(c.recurrence?.until ?? addMonths(c.start, 6)) - x);
        out.push({ clip: c, color, box: { x, y, w, h: LANE_HEIGHT } });
        continue;
      }

      const sub = lay.taskAssignments.get(c.id) ?? 0;
      const y = lay.taskLaneStartY + sub * LANE_HEIGHT;
      if (c.kind === "task") {
        const x = sx(c.start);
        const w = Math.max(8, sx(c.end ?? c.start) - x);
        out.push({ clip: c, color, box: { x, y, w, h: LANE_HEIGHT } });
      } else {
        out.push({ clip: c, color, box: { x: sx(c.start), y, w: 0, h: LANE_HEIGHT } });
      }
    }
    return out;
  }, [clips, layout, origin, view.pxPerDay, view.scrollX, tracks]);

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
      zones.push({ id: c.id, x, y, w, color: trackColor.get(c.trackId) ?? "#5b8def" });
    }
    return zones;
  }, [clips, layout, origin, view.pxPerDay, view.scrollX, tracks]);

  const todayX = screenXForDate(origin, today, view.pxPerDay, view.scrollX);
  const svgHeight = Math.max(layout.totalHeight, canvasHeight);

  function onDividerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = view.headerWidth;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      setView({ headerWidth: Math.max(HEADER_MIN, Math.min(HEADER_MAX, startW + dx)) });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const zoomLabel = labelForZoom(view.pxPerDay);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <div
          className="overflow-hidden border-r border-ink/5"
          style={{ width: view.headerWidth }}
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
              width={view.headerWidth}
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
          onPointerDown={onDividerPointerDown}
          aria-label="Resize track header column"
          role="separator"
          className="shrink-0 cursor-col-resize touch-none"
          style={{ width: DIVIDER_WIDTH, background: "transparent" }}
          title="Drag to resize"
        >
          <div className="mx-auto h-full w-px bg-ink/10" />
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
              height={svgHeight}
              style={{ display: "block" }}
            >
              {monthLines.map((m) => (
                <line
                  key={`grid-${m.date}`}
                  x1={m.x}
                  y1={0}
                  x2={m.x}
                  y2={svgHeight}
                  stroke={m.isYearStart ? "#d1d5db" : "#f3f4f6"}
                  strokeWidth={m.isYearStart ? 1 : 1}
                  pointerEvents="none"
                />
              ))}
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
              {eventZones.map((z) => (
                <rect
                  key={`zone-${z.id}`}
                  x={z.x}
                  y={z.y + 2}
                  width={Math.max(0, z.w)}
                  height={LANE_HEIGHT - 4}
                  fill={z.color}
                  opacity={0.12}
                  rx={4}
                />
              ))}
              {boxes.map(({ clip, box, color }) => {
                const isSelected =
                  selection?.kind === "clip" && selection.id === clip.id;
                const onClick = () => {
                  setSelection({ kind: "clip", id: clip.id });
                  openSheet({ kind: "edit-clip", clipId: clip.id });
                };
                switch (clip.kind) {
                  case "task":
                    return <TaskBar key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} />;
                  case "stem":
                    return <StemBar key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} />;
                  case "event":
                    return <EventDiamond key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} />;
                  case "flag":
                    return <FlagMarker key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} />;
                }
              })}
              {todayX >= -20 && todayX <= canvasWidth + 20 ? (
                <g pointerEvents="none">
                  <line
                    x1={todayX}
                    y1={0}
                    x2={todayX}
                    y2={svgHeight}
                    stroke="#e11d48"
                    strokeWidth={2}
                  />
                  <rect x={todayX - 24} y={2} width={48} height={18} rx={9} fill="#e11d48" />
                  <text x={todayX} y={11} dominantBaseline="central" textAnchor="middle" fontSize={11} fontWeight={700} fill="white">
                    today
                  </text>
                </g>
              ) : null}
            </svg>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 border-t border-ink/5"
        style={{ height: RULER_HEIGHT }}
      >
        <div
          style={{ width: view.headerWidth + DIVIDER_WIDTH }}
          className="flex items-center justify-center bg-white text-[11px] font-medium text-muted"
        >
          {zoomLabel}
        </div>
        <Ruler
          origin={origin}
          scrollX={view.scrollX}
          pxPerDay={view.pxPerDay}
          width={canvasWidth}
          height={RULER_HEIGHT}
        />
      </div>

      {/* Bottom thumb-reach control row */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-t border-ink/5 bg-white px-3"
        style={{ height: CONTROLS_HEIGHT }}
      >
        <button
          type="button"
          onClick={jumpToToday}
          className="grid h-11 min-w-[5.5rem] place-items-center rounded-full bg-playhead px-4 text-[14px] font-semibold text-white"
          aria-label="Jump to today"
        >
          ↻ Today
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => zoomAtCenter(1 / ZOOM_FACTOR)}
            className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white text-[20px] leading-none"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomAtCenter(ZOOM_FACTOR)}
            className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 bg-white text-[20px] leading-none"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Fat purple minimap */}
      <div className="flex shrink-0 border-t border-ink/5" style={{ height: MINIMAP_HEIGHT }}>
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
          width={canvasWidth + view.headerWidth + DIVIDER_WIDTH}
          viewportPxWidth={canvasWidth}
          height={MINIMAP_HEIGHT}
        />
      </div>
    </div>
  );
}

function labelForZoom(p: number): string {
  if (p < 0.6) return "decade";
  if (p < 2) return "year";
  if (p < 8) return "quarter";
  if (p < 22) return "month";
  return "week";
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
