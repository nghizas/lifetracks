// CalendarStrip — the GarageBand wide-composer-style "notes" view at the
// bottom of the screen. Today is anchored to the far-left; the strip shows
// roughly one period of future context, with each track rendered as its own
// thin row containing miniaturised clip bars (proportional, color-coded).
//
// Tap or drag to scrub. Tapping inside the viewport rectangle preserves the
// finger-to-rectangle offset so the rect doesn't snap-jump under the finger.

import { useCallback, useMemo, useRef } from "react";
import type { Clip, Track } from "@/core";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtDate,
  occurrences,
  parseDate,
  todayStr,
} from "@/core";
import type { ViewState } from "@/state";

// Row layout. Total = ROW_GUTTER + ROW_YEAR + ROW_MONTH + tracks region + bottom pill.
const ROW_GUTTER = 2;
const ROW_YEAR = 20;
const ROW_MONTH = 20;
const ROW_TODAY_LABEL = 18;
// A small left-buffer of "past" so the today line + pill don't get clipped at x=0.
const PAST_BUFFER_DAYS = 7;

interface Props {
  origin: string;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  /** Width of the canvas above (used to compute "what's currently visible"). */
  canvasWidth: number;
  tracks: readonly Track[];
  clips: readonly Clip[];
  width: number;
  height?: number;
}

export function CalendarStrip({
  origin,
  view,
  setView,
  canvasWidth,
  tracks,
  clips,
  width,
  height = 132,
}: Props) {
  const today = todayStr();
  const todayDayIdx = daysBetween(origin, today);

  // Show future-forward context proportional to the canvas. Strip range is
  // 4× the canvas range, clamped 14 days .. 10 years. So WEEK zoom on the
  // canvas (7 days) gives a 28-day strip; MONTH (30) gives ~4 months; YEAR
  // (365) gives ~4 years — the strip is always one "level up" of context.
  const canvasViewportDays = canvasWidth / view.pxPerDay;
  const desiredStripDays = Math.max(14, Math.min(3650, canvasViewportDays * 4));
  const stripStartDays = todayDayIdx - PAST_BUFFER_DAYS;
  const stripEndDays = stripStartDays + desiredStripDays;
  const stripPxPerDay = width / desiredStripDays;
  const stripStartDate = addDays(origin, Math.floor(stripStartDays));
  const stripEndDate = addDays(origin, Math.ceil(stripEndDays));

  const sxForDays = useCallback(
    (days: number) => (days - stripStartDays) * stripPxPerDay,
    [stripStartDays, stripPxPerDay],
  );
  const sxForDate = useCallback(
    (date: string) => sxForDays(daysBetween(origin, date)),
    [origin, sxForDays],
  );

  const yearLabels = useMemo(() => {
    const out: { year: number; x: number }[] = [];
    let y = parseDate(stripStartDate).getFullYear();
    const endY = parseDate(stripEndDate).getFullYear();
    while (y <= endY) {
      out.push({ year: y, x: sxForDate(`${y}-01-01`) });
      y++;
    }
    return out;
  }, [stripStartDate, stripEndDate, sxForDate]);

  const monthEntries = useMemo(() => {
    const out: {
      date: string;
      label: string;
      letter: string;
      x: number;
      w: number;
      isYearStart: boolean;
    }[] = [];
    const startD = parseDate(stripStartDate);
    let cursor = fmtDate(new Date(startD.getFullYear(), startD.getMonth(), 1));
    while (parseDate(cursor) <= parseDate(stripEndDate)) {
      const next = addMonths(cursor, 1);
      const d = parseDate(cursor);
      const label = d.toLocaleString(undefined, { month: "short" });
      out.push({
        date: cursor,
        label,
        letter: label.charAt(0),
        x: sxForDate(cursor),
        w: sxForDate(next) - sxForDate(cursor),
        isYearStart: d.getMonth() === 0,
      });
      cursor = next;
    }
    return out;
  }, [stripStartDate, stripEndDate, sxForDate]);

  // Track rows fill the area below the label headers, above the today-pill row.
  const tracksTop = ROW_GUTTER + ROW_YEAR + ROW_MONTH;
  const tracksBottom = height - ROW_TODAY_LABEL;
  const tracksHeight = Math.max(8, tracksBottom - tracksTop);
  // Respect mute / solo: solo'd tracks are the only visible ones; otherwise
  // muted tracks are hidden entirely from the strip. Heights divide up the
  // remaining space evenly so a single visible track fills the strip.
  const orderedTracks = useMemo(
    () => tracks.slice().sort((a, b) => a.order - b.order),
    [tracks],
  );
  const anySoloed = orderedTracks.some((t) => t.soloed);
  const visibleTracks = useMemo(
    () =>
      anySoloed
        ? orderedTracks.filter((t) => t.soloed)
        : orderedTracks.filter((t) => !t.muted),
    [orderedTracks, anySoloed],
  );
  const rowHeight = visibleTracks.length > 0 ? tracksHeight / visibleTracks.length : 0;
  const trackIndex = useMemo(() => {
    const m = new Map<string, number>();
    visibleTracks.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [visibleTracks]);

  // Pre-render every clip with the same shape language as the canvas above:
  // span = rounded pill, event = diamond, stem = dotted row, flag = mark.
  const clipShapes = useMemo(() => {
    interface Span {
      key: string;
      kind: "task";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }
    interface Stem {
      key: string;
      kind: "stem";
      occurrenceXs: number[];
      y: number;
      color: string;
    }
    interface Event {
      key: string;
      kind: "event";
      cx: number;
      cy: number;
      r: number;
      color: string;
    }
    interface Flag {
      key: string;
      kind: "flag";
      x: number;
      y: number;
      h: number;
      color: string;
    }
    const out: (Span | Stem | Event | Flag)[] = [];
    for (const c of clips) {
      const ti = trackIndex.get(c.trackId);
      if (ti === undefined) continue;
      const track = visibleTracks[ti]!;
      const yTop = tracksTop + ti * rowHeight + 2;
      const yH = Math.max(3, rowHeight - 4);
      const xStart = sxForDate(c.start);
      switch (c.kind) {
        case "task": {
          const xEnd = sxForDate(c.end ?? c.start);
          const w = Math.max(3, xEnd - xStart);
          out.push({
            key: c.id,
            kind: "task",
            x: xStart,
            y: yTop,
            w,
            h: yH,
            color: track.color,
          });
          break;
        }
        case "stem": {
          if (!c.recurrence) break;
          const dates = occurrences(c.start, c.recurrence, c.recurrence.until);
          const xs: number[] = [];
          let last = -Infinity;
          for (const d of dates) {
            const x = sxForDate(d);
            if (x < -4 || x > width + 4) continue;
            if (x - last >= 4) {
              xs.push(x);
              last = x;
            }
          }
          out.push({
            key: c.id,
            kind: "stem",
            occurrenceXs: xs,
            y: yTop + yH / 2,
            color: track.color,
          });
          break;
        }
        case "event": {
          out.push({
            key: c.id,
            kind: "event",
            cx: xStart,
            cy: yTop + yH / 2,
            r: Math.min(4, yH / 2 - 0.5),
            color: track.color,
          });
          break;
        }
        case "flag": {
          out.push({
            key: c.id,
            kind: "flag",
            x: xStart,
            y: yTop,
            h: yH,
            color: track.color,
          });
          break;
        }
      }
    }
    return out;
  }, [clips, visibleTracks, trackIndex, sxForDate, rowHeight, tracksTop, width]);

  const todayX = sxForDate(today);

  // Viewport rectangle
  const canvasStartDays = view.scrollX / view.pxPerDay;
  const canvasEndDays = canvasStartDays + canvasViewportDays;
  const vpX1 = sxForDays(canvasStartDays);
  const vpX2 = sxForDays(canvasEndDays);

  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const dragOffsetFromCenter = useRef(0);

  const setCanvasCenter = useCallback(
    (centerLocalX: number) => {
      const targetDays = stripStartDays + centerLocalX / stripPxPerDay;
      const newScrollX = targetDays * view.pxPerDay - canvasWidth / 2;
      setView({ scrollX: newScrollX });
    },
    [stripStartDays, stripPxPerDay, view.pxPerDay, canvasWidth, setView],
  );

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    ref.current?.setPointerCapture(e.pointerId);
    dragging.current = true;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    if (localX >= vpX1 && localX <= vpX2) {
      dragOffsetFromCenter.current = localX - (vpX1 + vpX2) / 2;
    } else {
      dragOffsetFromCenter.current = 0;
      setCanvasCenter(localX);
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    setCanvasCenter(localX - dragOffsetFromCenter.current);
  }

  function onPointerEnd(e: React.PointerEvent<SVGSVGElement>) {
    dragging.current = false;
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  // Accordion: hide month labels when too narrow.
  const monthLabelMode: "full" | "letter" | "none" = (() => {
    const minW = monthEntries.reduce((acc, m) => Math.min(acc, m.w), Infinity);
    if (minW >= 22) return "full";
    if (minW >= 7) return "letter";
    return "none";
  })();

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className="block touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <rect width={width} height={height} fill="#fafafa" />

      {/* Month boundary gridlines */}
      {monthEntries.map((m) => (
        <line
          key={`grid-${m.date}`}
          x1={m.x}
          y1={ROW_GUTTER + ROW_YEAR}
          x2={m.x}
          y2={tracksBottom}
          stroke={m.isYearStart ? "#9ca3af" : "#e5e7eb"}
          strokeWidth={1}
          pointerEvents="none"
        />
      ))}

      {/* Year labels */}
      {yearLabels.map((y) => (
        <text
          key={`year-${y.year}`}
          x={Math.max(4, y.x + 4)}
          y={ROW_GUTTER + ROW_YEAR / 2}
          dominantBaseline="central"
          fontSize={13}
          fontWeight={700}
          fill="#0f1217"
          pointerEvents="none"
        >
          {y.year}
        </text>
      ))}

      {/* Month labels */}
      {monthLabelMode !== "none" &&
        monthEntries.map((m) => (
          <text
            key={`mlabel-${m.date}`}
            x={m.x + (monthLabelMode === "full" ? 4 : Math.max(2, m.w / 2 - 3))}
            y={ROW_GUTTER + ROW_YEAR + ROW_MONTH / 2}
            dominantBaseline="central"
            textAnchor={monthLabelMode === "letter" ? "middle" : "start"}
            fontSize={monthLabelMode === "full" ? 11 : 9}
            fontWeight={600}
            fill="#4b5563"
            pointerEvents="none"
          >
            {monthLabelMode === "full" ? m.label : m.letter}
          </text>
        ))}

      {/* Track separator lines */}
      {visibleTracks.map((_, i) => {
        if (i === 0) return null;
        const y = tracksTop + i * rowHeight;
        return (
          <line
            key={`tsep-${i}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke="#f1f5f9"
            pointerEvents="none"
          />
        );
      })}

      {/* Mini clip shapes — same shape language as the canvas above */}
      {clipShapes.map((s) => {
        if (s.kind === "stem") {
          return (
            <g key={s.key} pointerEvents="none">
              {s.occurrenceXs.map((x, i) => (
                <circle key={i} cx={x} cy={s.y} r={1.6} fill={s.color} opacity={0.9} />
              ))}
            </g>
          );
        }
        if (s.kind === "event") {
          const { cx, cy, r, color } = s;
          return (
            <polygon
              key={s.key}
              points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
              fill={color}
              opacity={0.95}
              pointerEvents="none"
            />
          );
        }
        if (s.kind === "flag") {
          return (
            <g key={s.key} pointerEvents="none">
              <line x1={s.x} y1={s.y} x2={s.x} y2={s.y + s.h} stroke={s.color} strokeWidth={1.5} />
              <polygon
                points={`${s.x},${s.y} ${s.x + 5},${s.y + 2} ${s.x},${s.y + 4}`}
                fill={s.color}
              />
            </g>
          );
        }
        // span
        return (
          <rect
            key={s.key}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={Math.min(2, s.h / 2)}
            fill={s.color}
            opacity={0.9}
            pointerEvents="none"
          />
        );
      })}

      {/* Viewport rectangle */}
      <rect
        x={Math.max(0, vpX1)}
        y={tracksTop - 2}
        width={Math.max(0, Math.min(width, vpX2) - Math.max(0, vpX1))}
        height={tracksBottom - tracksTop + 4}
        fill="#7c3aed"
        fillOpacity={0.10}
        stroke="#6d28d9"
        strokeWidth={1.5}
        rx={6}
        pointerEvents="none"
      />

      {/* Today line + pill */}
      {todayX >= -8 && todayX <= width + 8 ? (
        <g pointerEvents="none">
          <line x1={todayX} y1={0} x2={todayX} y2={tracksBottom} stroke="#e11d48" strokeWidth={2} />
          <rect
            x={todayX - 24}
            y={height - ROW_TODAY_LABEL + 1}
            width={48}
            height={ROW_TODAY_LABEL - 2}
            rx={8}
            fill="#e11d48"
          />
          <text
            x={todayX}
            y={height - ROW_TODAY_LABEL / 2}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="white"
          >
            today
          </text>
        </g>
      ) : null}
    </svg>
  );
}
