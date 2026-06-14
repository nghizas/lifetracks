// Google-Calendar-style date header. The labels accordion to show the
// subdivisions of the *current* zoom span, not just abstract tick marks:
//
//   WEEK   (≤14 days visible) → each day, "MON / 14"
//   MONTH  (15–60 days)       → each day's number, month-start gets a banner
//   QUARTER(61–200 days)      → each month's name
//   YEAR   (201–700 days)     → each month as a single letter
//   3YR    (701–2000 days)    → each quarter ("Q1 / 2026")
//   5YR    (>2000 days)       → each year
//
// Today's column is tinted at the day-level subdivisions so the playhead
// is anchored visually. A sticky lead badge on the left always names the
// current viewing range, like GCal's "August 2026" or "Aug 14–20".

import { useMemo } from "react";
import { addDays, addMonths, fmtDate, parseDate, todayStr } from "@/core";
import { dateForScreenX, screenXForDate } from "./coords";

interface Props {
  origin: string;
  scrollX: number;
  pxPerDay: number;
  visibleDays: number;
  width: number;
  height?: number;
}

type Subdivision =
  | "day-full" // WEEK zoom
  | "day-number" // MONTH zoom
  | "month-name" // QUARTER zoom
  | "month-letter" // YEAR zoom
  | "quarter" // 3YR
  | "year"; // 5YR

function subdivisionFor(visibleDays: number): Subdivision {
  if (visibleDays <= 14) return "day-full";
  if (visibleDays <= 60) return "day-number";
  if (visibleDays <= 200) return "month-name";
  if (visibleDays <= 700) return "month-letter";
  if (visibleDays <= 2000) return "quarter";
  return "year";
}

interface SubTick {
  date: string;
  primary: string;
  secondary?: string;
  major: boolean;
}

function genTicks(sub: Subdivision, startISO: string, endISO: string): SubTick[] {
  const start = parseDate(startISO);
  const end = parseDate(endISO);
  const out: SubTick[] = [];

  if (sub === "day-full" || sub === "day-number") {
    let cursor = fmtDate(start);
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      const dow = d.toLocaleString(undefined, { weekday: "short" }).toUpperCase();
      const day = String(d.getDate());
      const isMonthStart = d.getDate() === 1;
      if (sub === "day-full") {
        out.push({ date: cursor, primary: day, secondary: dow, major: isMonthStart });
      } else {
        out.push({
          date: cursor,
          primary: day,
          secondary: isMonthStart ? d.toLocaleString(undefined, { month: "short" }).toUpperCase() : undefined,
          major: isMonthStart,
        });
      }
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  if (sub === "month-name" || sub === "month-letter") {
    let cursor = fmtDate(new Date(start.getFullYear(), start.getMonth(), 1));
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      const isYearStart = d.getMonth() === 0;
      const monthShort = d.toLocaleString(undefined, { month: "short" });
      out.push({
        date: cursor,
        primary: sub === "month-name" ? monthShort : monthShort.charAt(0),
        secondary: isYearStart ? String(d.getFullYear()) : undefined,
        major: isYearStart,
      });
      cursor = addMonths(cursor, 1);
    }
    return out;
  }

  if (sub === "quarter") {
    let cursor = fmtDate(new Date(start.getFullYear(), 0, 1));
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      const m = d.getMonth() + 1;
      if (m === 1 || m === 4 || m === 7 || m === 10) {
        const isYearStart = m === 1;
        out.push({
          date: cursor,
          primary: `Q${(m - 1) / 3 + 1}`,
          secondary: isYearStart ? String(d.getFullYear()) : undefined,
          major: isYearStart,
        });
      }
      cursor = addMonths(cursor, 1);
    }
    return out;
  }

  // year
  let y = start.getFullYear();
  while (y <= end.getFullYear() + 1) {
    out.push({ date: `${y}-01-01`, primary: String(y), major: true });
    y++;
  }
  return out;
}

function leadLabelFor(
  sub: Subdivision,
  startISO: string,
  endISO: string,
): { primary: string; secondary: string | null } {
  const start = parseDate(startISO);
  const end = parseDate(endISO);
  if (sub === "day-full") {
    const month = start.toLocaleString(undefined, { month: "short" });
    const sameMonth = start.getMonth() === end.getMonth();
    return {
      primary: sameMonth
        ? `${month} ${start.getDate()}–${end.getDate()}`
        : `${month} ${start.getDate()} – ${end.toLocaleString(undefined, { month: "short" })} ${end.getDate()}`,
      secondary: String(start.getFullYear()),
    };
  }
  if (sub === "day-number") {
    return {
      primary: start.toLocaleString(undefined, { month: "long" }),
      secondary: String(start.getFullYear()),
    };
  }
  if (sub === "month-name") {
    const q = Math.floor(start.getMonth() / 3) + 1;
    return { primary: `Q${q}`, secondary: String(start.getFullYear()) };
  }
  if (sub === "month-letter") {
    return { primary: String(start.getFullYear()), secondary: null };
  }
  return {
    primary: `${start.getFullYear()} — ${end.getFullYear()}`,
    secondary: null,
  };
}

export function Ruler({
  origin,
  scrollX,
  pxPerDay,
  visibleDays,
  width,
  height = 56,
}: Props) {
  const sub = subdivisionFor(visibleDays);
  const startDate = dateForScreenX(origin, 0, pxPerDay, scrollX);
  const endDate = dateForScreenX(origin, width, pxPerDay, scrollX);

  const ticks = useMemo(
    () => genTicks(sub, startDate, endDate),
    [sub, startDate, endDate],
  );
  const lead = useMemo(
    () => leadLabelFor(sub, startDate, endDate),
    [sub, startDate, endDate],
  );

  const today = todayStr();
  const todayX = screenXForDate(origin, today, pxPerDay, scrollX);
  const showTodayHighlight = sub === "day-full" || sub === "day-number";

  return (
    <div className="relative h-full w-full bg-white">
      <div
        className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-md bg-white/95 px-2 py-1 shadow-sm ring-1 ring-ink/10"
      >
        {lead.secondary ? (
          <div className="text-[10px] font-bold uppercase leading-none tracking-wider text-muted">
            {lead.secondary}
          </div>
        ) : null}
        <div className="text-[14px] font-bold leading-tight text-ink">
          {lead.primary}
        </div>
      </div>

      <svg width={width} height={height} className="block">
        {/* Today column highlight (only at day-level subdivisions) */}
        {showTodayHighlight && pxPerDay > 0 ? (
          <rect
            x={todayX}
            y={0}
            width={pxPerDay}
            height={height}
            fill="#fef3c7"
            opacity={0.5}
          />
        ) : null}

        {/* Baseline */}
        <line
          x1={0}
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
          stroke="#e5e7eb"
        />

        {ticks.map((t) => {
          const x = screenXForDate(origin, t.date, pxPerDay, scrollX);
          if (x < -80 || x > width + 80) return null;
          const isToday = t.date === today;
          const fillPrimary = isToday ? "#e11d48" : t.major ? "#0f1217" : "#374151";
          const fillSecondary = isToday ? "#e11d48" : "#6b7280";
          return (
            <g key={t.date} transform={`translate(${x}, 0)`}>
              <line
                x1={0}
                y1={t.major ? 0 : height - 14}
                x2={0}
                y2={height}
                stroke={t.major ? "#9ca3af" : "#e5e7eb"}
                strokeWidth={1}
              />
              {t.secondary ? (
                <text
                  x={4}
                  y={16}
                  fontSize={10}
                  fontWeight={700}
                  fill={fillSecondary}
                  style={{ userSelect: "none" }}
                >
                  {t.secondary}
                </text>
              ) : null}
              <text
                x={4}
                y={t.secondary ? height - 10 : height / 2 + 5}
                fontSize={t.major ? 14 : 13}
                fontWeight={t.major ? 700 : 600}
                fill={fillPrimary}
                style={{ userSelect: "none" }}
              >
                {t.primary}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
