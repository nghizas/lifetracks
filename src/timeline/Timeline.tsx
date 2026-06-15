// Top-level timeline view. The track-header column was deleted — instead each
// track gets a floating label overlay pinned to its row's top-left, and the
// canvas spans full width. The prominent date header lives above the canvas
// so "where am I in time" is the first thing the user reads.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Clip } from "@/core";
import { addDays, addMonths, daysBetween, fmtDate, occurrences, parseDate, todayStr } from "@/core";
import {
  selectClips,
  selectOrderedTracks,
  useStore,
} from "@/state";
import {
  EventDiamond,
  FlagMarker,
  SpanBar,
  StemBar,
  type ClipBox,
} from "./ClipShapes";
import { CalendarStrip } from "./CalendarStrip";
import { screenXForDate } from "./coords";
import { LANE_HEIGHT, FLAG_LANE_HEIGHT, computeTrackLayouts } from "./layout";
import { Ruler } from "./Ruler";
import { TrackLabelOverlay } from "./TrackLabelOverlay";
import { useTouchPanZoom } from "./useTouchPanZoom";

const RULER_HEIGHT = 56;
const CALENDAR_HEIGHT = 132;
const CONTROLS_HEIGHT = 52;
// Default canvas centering: today at 10% from left so the user looks primarily
// into the future. Matches the strip anchoring today on the far left.
const TODAY_LEFT_FRACTION = 0.1;

interface ZoomLevel {
  label: string;
  /** Number of days the level fills the canvas viewport with. */
  days: number;
}

// "Click WEEK and the canvas shows exactly 1 week, not multiple weeks."
// pxPerDay is derived from canvas width at activation time so the picked
// span fills the viewport precisely.
const ZOOM_LEVELS: ZoomLevel[] = [
  { label: "WEEK", days: 7 },
  { label: "MONTH", days: 30 },
  { label: "QUARTER", days: 91 },
  { label: "YEAR", days: 365 },
  { label: "3YR", days: 1095 },
  { label: "5YR", days: 1825 },
];

function labelForViewport(visibleDays: number): string {
  let best: ZoomLevel = ZOOM_LEVELS[0]!;
  let bestDist = Math.abs(Math.log(visibleDays / best.days));
  for (const lvl of ZOOM_LEVELS) {
    const d = Math.abs(Math.log(visibleDays / lvl.days));
    if (d < bestDist) {
      bestDist = d;
      best = lvl;
    }
  }
  return best.label;
}

/**
 * Clip a list of screen-x positions to the visible viewport (with margin) and
 * thin them so consecutive entries are at least `minGap` pixels apart. Used to
 * keep stem occurrence dots from piling up at zoomed-out scales.
 */
function thinXs(xs: number[], viewportW: number, minGap: number): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (const x of xs) {
    if (x < -10 || x > viewportW + 10) continue;
    if (x - last >= minGap) {
      out.push(x);
      last = x;
    }
  }
  return out;
}

export function Timeline() {
  const tracks = useStore(selectOrderedTracks);
  const clips = useStore(selectClips);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const toggleMute = useStore((s) => s.toggleMute);
  const toggleSolo = useStore((s) => s.toggleSolo);
  const setSelection = useStore((s) => s.setSelection);
  const selection = useStore((s) => s.selection);
  const openSheet = useStore((s) => s.openSheet);

  const today = todayStr();
  const origin = useMemo(() => addMonths(today, -60), [today]);

  const layout = useMemo(() => computeTrackLayouts(tracks, clips), [tracks, clips]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(390);
  const [canvasHeight, setCanvasHeight] = useState(400);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);

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

  const jumpToToday = () => {
    const targetScroll =
      daysBetween(origin, today) * view.pxPerDay - canvasWidth * TODAY_LEFT_FRACTION;
    setView({ scrollX: targetScroll });
  };

  const setZoomToDays = (days: number) => {
    const pxPerDay = canvasWidth / days;
    const targetScroll = daysBetween(origin, today) * pxPerDay - canvasWidth * TODAY_LEFT_FRACTION;
    setView({ pxPerDay, scrollX: targetScroll });
    setZoomMenuOpen(false);
  };

  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || canvasWidth <= 0) return;
    centeredRef.current = true;
    const targetScroll = daysBetween(origin, today) * view.pxPerDay - canvasWidth * TODAY_LEFT_FRACTION;
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

  const anySoloed = tracks.some((t) => t.soloed);

  const boxes = useMemo(() => {
    const out: {
      clip: Clip;
      box: ClipBox;
      color: string;
      dim: boolean;
      occurrenceXs?: number[];
    }[] = [];
    const trackMeta = new Map(tracks.map((t) => [t.id, t]));
    for (const c of clips) {
      const lay = layout.layouts.get(c.trackId);
      const t = trackMeta.get(c.trackId);
      if (!lay || !t) continue;
      const color = t.color;
      const dim = anySoloed ? !t.soloed : t.muted;
      const sx = (d: string) => screenXForDate(origin, d, view.pxPerDay, view.scrollX);

      if (lay.collapsed) {
        const x = sx(c.start);
        const endIso =
          c.kind === "span"
            ? c.end ?? c.start
            : c.kind === "stem"
              ? c.recurrence?.until ?? c.start
              : c.start;
        const w = c.kind === "span" || c.kind === "stem" ? Math.max(2, sx(endIso) - x) : 4;
        out.push({ clip: c, color, dim, box: { x, y: lay.yStart + 4, w, h: lay.height - 8 } });
        continue;
      }

      if (c.kind === "flag") {
        if (lay.flagLaneY === null) continue;
        out.push({
          clip: c,
          color,
          dim,
          box: { x: sx(c.start), y: lay.flagLaneY, w: 8, h: FLAG_LANE_HEIGHT },
        });
        continue;
      }

      if (c.kind === "stem") {
        const sub = lay.stemAssignments.get(c.id) ?? 0;
        const y = lay.stemLaneStartY + sub * LANE_HEIGHT;
        const x = sx(c.start);
        const w = Math.max(8, sx(c.recurrence?.until ?? addMonths(c.start, 6)) - x);
        const occurrenceXs = c.recurrence
          ? thinXs(
              occurrences(c.start, c.recurrence, c.recurrence.until).map((d) => sx(d)),
              canvasWidth,
              8,
            )
          : undefined;
        out.push({ clip: c, color, dim, box: { x, y, w, h: LANE_HEIGHT }, occurrenceXs });
        continue;
      }

      const sub = lay.spanAssignments.get(c.id) ?? 0;
      const y = lay.spanLaneStartY + sub * LANE_HEIGHT;
      if (c.kind === "span") {
        const x = sx(c.start);
        const w = Math.max(8, sx(c.end ?? c.start) - x);
        out.push({ clip: c, color, dim, box: { x, y, w, h: LANE_HEIGHT } });
      } else {
        out.push({ clip: c, color, dim, box: { x: sx(c.start), y, w: 0, h: LANE_HEIGHT } });
      }
    }
    return out;
  }, [clips, layout, origin, view.pxPerDay, view.scrollX, tracks, anySoloed, canvasWidth]);

  const todayX = screenXForDate(origin, today, view.pxPerDay, view.scrollX);
  const svgHeight = Math.max(layout.totalHeight, canvasHeight);
  const visibleDays = canvasWidth / view.pxPerDay;
  const zoomLabel = labelForViewport(visibleDays);

  return (
    <div className="flex h-full flex-col">
      {/* Prominent date header — answers "where am I" */}
      <div
        className="shrink-0 border-b border-ink/5"
        style={{ height: RULER_HEIGHT }}
      >
        <Ruler
          origin={origin}
          scrollX={view.scrollX}
          pxPerDay={view.pxPerDay}
          visibleDays={visibleDays}
          width={canvasWidth}
          height={RULER_HEIGHT}
        />
      </div>

      {/* Full-width canvas with floating track-label overlays */}
      <div
        ref={canvasRef}
        className="relative flex-1 touch-none overflow-y-auto overscroll-contain"
      >
        {tracks.length === 0 ? (
          <EmptyTimelineHint />
        ) : (
          <>
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
                  strokeWidth={1}
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
              {boxes.map(({ clip, box, color, dim, occurrenceXs }) => {
                const isSelected =
                  selection?.kind === "clip" && selection.id === clip.id;
                const onClick = () => {
                  setSelection({ kind: "clip", id: clip.id });
                  openSheet({ kind: "edit-clip", clipId: clip.id });
                };
                const group = (() => {
                  switch (clip.kind) {
                    case "span":
                      return <SpanBar key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} />;
                    case "stem":
                      return <StemBar key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} occurrenceXs={occurrenceXs} />;
                    case "event":
                      return <EventDiamond key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} />;
                    case "flag":
                      return <FlagMarker key={clip.id} clip={clip} trackColor={color} box={box} selected={isSelected} onClick={onClick} />;
                  }
                })();
                if (dim) {
                  return (
                    <g key={clip.id} opacity={0.25}>
                      {group}
                    </g>
                  );
                }
                return group;
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
                </g>
              ) : null}
            </svg>

            <TrackLabelOverlay
              tracks={tracks}
              layout={layout}
              canvasRef={canvasRef}
              onEditTrack={(id) => openSheet({ kind: "edit-track", trackId: id })}
              onAddClipToTrack={(id) =>
                openSheet({ kind: "new-clip", defaults: { trackId: id } })
              }
              onToggleMute={toggleMute}
              onToggleSolo={toggleSolo}
            />
          </>
        )}
      </div>

      {/* Thumb-reach controls */}
      <div
        className="relative flex shrink-0 items-center justify-between gap-2 border-t border-ink/5 bg-white px-3"
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setZoomMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={zoomMenuOpen}
            className="grid h-11 min-w-[6rem] place-items-center rounded-full border border-ink/15 bg-white px-4 text-[13px] font-semibold"
          >
            {zoomLabel} ▾
          </button>
          {zoomMenuOpen ? (
            <div
              role="menu"
              className="absolute bottom-full right-0 mb-2 w-32 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-xl"
            >
              {ZOOM_LEVELS.map((lvl) => {
                const active = zoomLabel === lvl.label;
                return (
                  <button
                    key={lvl.label}
                    type="button"
                    onClick={() => setZoomToDays(lvl.days)}
                    className={`block w-full px-4 py-2.5 text-left text-[13px] font-semibold ${
                      active ? "bg-ink text-white" : "text-ink hover:bg-ink/5"
                    }`}
                  >
                    {lvl.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 border-t border-ink/5" style={{ height: CALENDAR_HEIGHT }}>
        <CalendarStrip
          origin={origin}
          view={view}
          setView={setView}
          canvasWidth={canvasWidth}
          tracks={tracks}
          clips={clips}
          width={canvasWidth}
          height={CALENDAR_HEIGHT}
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
