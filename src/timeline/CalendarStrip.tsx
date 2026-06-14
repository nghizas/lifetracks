// CalendarStrip — the differentiator. A fat accordion calendar at the bottom
// that reads like a real calendar (years, months, week-start dates, density
// per track), shows today prominently, and serves as the primary navigation
// surface for the canvas above.
//
// Behaviour:
//   - The strip's pxPerDay is derived from the canvas's pxPerDay so the strip
//     always shows roughly 4× the canvas range, clamped between 6 months and
//     3 years of context. Zoom the canvas, the strip accordions to match.
//   - Labels accordion too: at tight scales the day numbers vanish, then the
//     month names compact to a single letter, until only year labels remain.
//   - Tap outside the viewport rectangle: jump canvas center to that date.
//   - Tap or drag the rectangle: scrub the canvas, preserving the
//     finger-to-rectangle offset (so dragging doesn't snap-jump).

import { useCallback, useMemo, useRef } from "react";
import type { Clip } from "@/core";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtDate,
  parseDate,
  todayStr,
} from "@/core";
import type { ViewState } from "@/state";

const ROW_GUTTER = 4;
const ROW_YEAR = 22;
const ROW_MONTH = 26;
const ROW_DAY = 22;
const ROW_DENSITY = 22;
const ROW_TODAY_LABEL = 16;

interface Props {
  origin: string;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  /** Width of the canvas above (used to compute "what's currently visible"). */
  canvasWidth: number;
  clips: readonly Clip[];
  trackColorByClip: (c: Clip) => string;
  width: number;
  height?: number;
}

export function CalendarStrip({
  origin,
  view,
  setView,
  canvasWidth,
  clips,
  trackColorByClip,
  width,
  height = 124,
}: Props) {
  // The strip shows 4× the canvas range by default, clamped to a sensible
  // window so it never collapses into a single month or sprawls past 3 years.
  const canvasViewportDays = canvasWidth / view.pxPerDay;
  const desiredStripDays = Math.max(180, Math.min(1095, canvasViewportDays * 4));
  const stripPxPerDay = width / desiredStripDays;

  const canvasCenterDays = (view.scrollX + canvasWidth / 2) / view.pxPerDay;
  const stripStartDays = canvasCenterDays - width / 2 / stripPxPerDay;
  const stripEndDays = stripStartDays + width / stripPxPerDay;
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

  const dayNumbers = useMemo(() => {
    if (stripPxPerDay < 1.2) return []; // too tight — skip day row entirely
    const out: { date: string; day: number; x: number; isMonthStart: boolean }[] = [];
    const startD = parseDate(stripStartDate);
    const dow = startD.getDay();
    const offset = dow === 0 ? 1 : (1 - dow + 7) % 7;
    let cursor = addDays(stripStartDate, offset);
    while (parseDate(cursor) <= parseDate(stripEndDate)) {
      const d = parseDate(cursor);
      out.push({
        date: cursor,
        day: d.getDate(),
        x: sxForDate(cursor),
        isMonthStart: d.getDate() <= 7,
      });
      cursor = addDays(cursor, 7);
    }
    return out;
  }, [stripStartDate, stripEndDate, sxForDate, stripPxPerDay]);

  const densityMarks = useMemo(() => {
    const out: { x: number; color: string }[] = [];
    for (const c of clips) {
      const x = sxForDate(c.start);
      if (x >= -2 && x <= width + 2) out.push({ x, color: trackColorByClip(c) });
    }
    return out;
  }, [clips, sxForDate, width, trackColorByClip]);

  const today = todayStr();
  const todayX = sxForDate(today);

  const canvasStartDays = view.scrollX / view.pxPerDay;
  const canvasEndDays = canvasStartDays + canvasViewportDays;
  const vpX1 = sxForDays(canvasStartDays);
  const vpX2 = sxForDays(canvasEndDays);

  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  // When dragging inside the viewport rect, preserve the finger-to-center
  // offset so the rect doesn't snap-jump under the finger.
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

  const yYear = ROW_GUTTER;
  const yMonth = yYear + ROW_YEAR;
  const yDay = yMonth + ROW_MONTH;
  const yDensity = yDay + (dayNumbers.length > 0 ? ROW_DAY : 0);
  const usableHeight = height - ROW_TODAY_LABEL;

  // What month does each label fit? compact ("J" only) if narrow.
  const monthLabelMode: "full" | "letter" | "none" = (() => {
    const minW = monthEntries.reduce((acc, m) => Math.min(acc, m.w), Infinity);
    if (minW >= 22) return "full";
    if (minW >= 8) return "letter";
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
      <rect width={width} height={height} fill="#fcfcfd" />

      {/* Month boundary gridlines — year boundaries darker */}
      {monthEntries.map((m) => (
        <line
          key={`grid-${m.date}`}
          x1={m.x}
          y1={yMonth}
          x2={m.x}
          y2={usableHeight}
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
          y={yYear + ROW_YEAR / 2}
          dominantBaseline="central"
          fontSize={14}
          fontWeight={700}
          fill="#0f1217"
          pointerEvents="none"
        >
          {y.year}
        </text>
      ))}

      {/* Month labels (accordion: full / single-letter / hidden) */}
      {monthLabelMode !== "none" &&
        monthEntries.map((m) => (
          <text
            key={`mlabel-${m.date}`}
            x={m.x + (monthLabelMode === "full" ? 4 : Math.max(2, m.w / 2 - 3))}
            y={yMonth + ROW_MONTH / 2}
            dominantBaseline="central"
            textAnchor={monthLabelMode === "letter" ? "middle" : "start"}
            fontSize={monthLabelMode === "full" ? 12 : 10}
            fontWeight={600}
            fill="#374151"
            pointerEvents="none"
          >
            {monthLabelMode === "full" ? m.label : m.letter}
          </text>
        ))}

      {/* Day numbers (Mondays only, skipped when too cramped) */}
      {dayNumbers.map((d) => (
        <text
          key={`day-${d.date}`}
          x={d.x + 2}
          y={yDay + ROW_DAY / 2}
          dominantBaseline="central"
          fontSize={10}
          fontWeight={d.isMonthStart ? 700 : 500}
          fill={d.isMonthStart ? "#111827" : "#6b7280"}
          pointerEvents="none"
        >
          {d.day}
        </text>
      ))}

      {/* Density: clip starts colored by track */}
      {densityMarks.map((d, i) => (
        <line
          key={i}
          x1={d.x}
          y1={yDensity + 2}
          x2={d.x}
          y2={yDensity + ROW_DENSITY - 2}
          stroke={d.color}
          strokeWidth={2.5}
          opacity={0.85}
          pointerEvents="none"
        />
      ))}

      {/* Viewport rectangle — the user's "where am I on the canvas" affordance */}
      <rect
        x={Math.max(0, vpX1)}
        y={ROW_GUTTER}
        width={Math.max(0, Math.min(width, vpX2) - Math.max(0, vpX1))}
        height={usableHeight - ROW_GUTTER}
        fill="#7c3aed"
        fillOpacity={0.10}
        stroke="#6d28d9"
        strokeWidth={1.5}
        rx={8}
        pointerEvents="none"
      />
      <circle cx={vpX1 + 4} cy={usableHeight / 2 + ROW_GUTTER} r={2.5} fill="#6d28d9" pointerEvents="none" />
      <circle cx={vpX2 - 4} cy={usableHeight / 2 + ROW_GUTTER} r={2.5} fill="#6d28d9" pointerEvents="none" />

      {/* Today line + pill at the bottom */}
      {todayX >= -10 && todayX <= width + 10 ? (
        <g pointerEvents="none">
          <line x1={todayX} y1={0} x2={todayX} y2={usableHeight} stroke="#e11d48" strokeWidth={2} />
          <rect x={todayX - 24} y={height - ROW_TODAY_LABEL + 1} width={48} height={ROW_TODAY_LABEL - 2} rx={7} fill="#e11d48" />
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
