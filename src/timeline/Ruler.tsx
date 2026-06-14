// Google-Calendar-style date header. Two stacked rows:
//   1. A slim header row that names the current viewing range
//      ("AUGUST 2026", "Q3 2026", "2026 — 2028") — never floats, always sits
//      above the tick row.
//   2. A tick row that shows the subdivisions of the current zoom span.
//
// Subdivision rules (uniform tick text styling at each zoom — only gridlines
// vary by `major`):
//
//   WEEK   (≤14 days) → each day, two-line "MON / 14"
//   MONTH  (15–60)    → every 7 days from the 1st (1, 8, 15, 22, 29)
//   QUARTER(61–200)   → each month name "Jul Aug Sep"
//   YEAR   (201–700)  → each month as a number 1–12
//   3YR    (701–2000) → each quarter "Q1 Q2 Q3 Q4" (uniform)
//   5YR    (>2000)    → each year "2026 2027 …" (uniform)
//
// Today's column is tinted at day-level subdivisions.

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
  | "day-full"
  | "day-number"
  | "month-name"
  | "month-number"
  | "quarter"
  | "year";

function subdivisionFor(visibleDays: number): Subdivision {
  if (visibleDays <= 14) return "day-full";
  if (visibleDays <= 60) return "day-number";
  if (visibleDays <= 200) return "month-name";
  if (visibleDays <= 700) return "month-number";
  if (visibleDays <= 2000) return "quarter";
  return "year";
}

interface SubTick {
  date: string;
  primary: string;
  secondary?: string;
  /** Controls gridline darkness only (text styling is uniform per subdivision). */
  major: boolean;
}

function genTicks(sub: Subdivision, startISO: string, endISO: string): SubTick[] {
  const start = parseDate(startISO);
  const end = parseDate(endISO);
  const out: SubTick[] = [];

  if (sub === "day-full") {
    // every day
    let cursor = fmtDate(start);
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      out.push({
        date: cursor,
        primary: String(d.getDate()),
        secondary: d.toLocaleString(undefined, { weekday: "short" }).toUpperCase(),
        major: d.getDate() === 1,
      });
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  if (sub === "day-number") {
    // every 7 days from the 1st of each month: 1, 8, 15, 22, 29
    let cursor = fmtDate(start);
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      const day = d.getDate();
      if (day === 1 || day === 8 || day === 15 || day === 22 || day === 29) {
        out.push({
          date: cursor,
          primary: String(day),
          major: day === 1,
        });
      }
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  if (sub === "month-name") {
    let cursor = fmtDate(new Date(start.getFullYear(), start.getMonth(), 1));
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      out.push({
        date: cursor,
        primary: d.toLocaleString(undefined, { month: "short" }),
        major: d.getMonth() === 0,
      });
      cursor = addMonths(cursor, 1);
    }
    return out;
  }

  if (sub === "month-number") {
    let cursor = fmtDate(new Date(start.getFullYear(), start.getMonth(), 1));
    while (parseDate(cursor) <= end) {
      const d = parseDate(cursor);
      out.push({
        date: cursor,
        primary: String(d.getMonth() + 1),
        major: d.getMonth() === 0,
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
        out.push({
          date: cursor,
          primary: `Q${(m - 1) / 3 + 1}`,
          major: m === 1,
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
): string {
  const start = parseDate(startISO);
  const end = parseDate(endISO);

  if (sub === "day-full") {
    const month = start.toLocaleString(undefined, { month: "short" }).toUpperCase();
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
      : `${month} ${start.getDate()} – ${end.toLocaleString(undefined, { month: "short" }).toUpperCase()} ${end.getDate()}, ${start.getFullYear()}`;
  }
  if (sub === "day-number") {
    return `${start.toLocaleString(undefined, { month: "long" }).toUpperCase()} ${start.getFullYear()}`;
  }
  if (sub === "month-name") {
    const q = Math.floor(start.getMonth() / 3) + 1;
    return `Q${q} ${start.getFullYear()}`;
  }
  if (sub === "month-number") {
    return String(start.getFullYear());
  }
  return `${start.getFullYear()} — ${end.getFullYear()}`;
}

const HEADER_ROW_HEIGHT = 22;

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
  const tickRowHeight = height - HEADER_ROW_HEIGHT;
  const twoLine = sub === "day-full";

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header row — fixed above the tick row, left-aligned */}
      <div
        className="flex shrink-0 items-center border-b border-ink/10 bg-ink/[0.02] px-3"
        style={{ height: HEADER_ROW_HEIGHT }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink">
          {lead}
        </span>
      </div>

      {/* Tick row — subdivisions of the current zoom span */}
      <svg
        width={width}
        height={tickRowHeight}
        className="block"
      >
        {showTodayHighlight && pxPerDay > 0 ? (
          <rect
            x={todayX}
            y={0}
            width={pxPerDay}
            height={tickRowHeight}
            fill="#fef3c7"
            opacity={0.55}
          />
        ) : null}

        <line
          x1={0}
          y1={tickRowHeight - 0.5}
          x2={width}
          y2={tickRowHeight - 0.5}
          stroke="#e5e7eb"
        />

        {ticks.map((t) => {
          const x = screenXForDate(origin, t.date, pxPerDay, scrollX);
          if (x < -80 || x > width + 80) return null;
          const isToday = t.date === today;
          return (
            <g key={t.date} transform={`translate(${x}, 0)`}>
              <line
                x1={0}
                y1={t.major ? 0 : tickRowHeight - 12}
                x2={0}
                y2={tickRowHeight}
                stroke={t.major ? "#9ca3af" : "#e5e7eb"}
                strokeWidth={1}
              />
              {twoLine && t.secondary ? (
                <>
                  <text
                    x={4}
                    y={11}
                    fontSize={10}
                    fontWeight={700}
                    fill={isToday ? "#e11d48" : "#6b7280"}
                    style={{ userSelect: "none" }}
                  >
                    {t.secondary}
                  </text>
                  <text
                    x={4}
                    y={26}
                    fontSize={14}
                    fontWeight={700}
                    fill={isToday ? "#e11d48" : "#0f1217"}
                    style={{ userSelect: "none" }}
                  >
                    {t.primary}
                  </text>
                </>
              ) : (
                <text
                  x={4}
                  y={tickRowHeight / 2 + 5}
                  fontSize={13}
                  fontWeight={600}
                  fill={isToday ? "#e11d48" : "#0f1217"}
                  style={{ userSelect: "none" }}
                >
                  {t.primary}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
