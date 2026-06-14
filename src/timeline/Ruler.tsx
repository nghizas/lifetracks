// Prominent date header above the canvas. The left edge carries a sticky
// "where am I" badge (the current viewing range — month, quarter, year etc.)
// so the user always knows what time period they're staring at, even when
// the ruler's tick labels scroll off-screen.

import { useMemo } from "react";
import { parseDate } from "@/core";
import { dateForScreenX, screenXForDate } from "./coords";
import { generateTicks, scaleForPxPerDay, type RulerScale } from "./ruler-ticks";

interface Props {
  origin: string;
  scrollX: number;
  pxPerDay: number;
  width: number;
  height?: number;
}

function leadLabelFor(
  scale: RulerScale,
  startISO: string,
  endISO: string,
): { primary: string; secondary: string | null } {
  const start = parseDate(startISO);
  const end = parseDate(endISO);

  if (scale === "week") {
    const sameMonth = start.getMonth() === end.getMonth();
    const month = start.toLocaleString(undefined, { month: "long" });
    const range = sameMonth
      ? `${start.getDate()}–${end.getDate()}`
      : `${start.toLocaleString(undefined, { month: "short" })} ${start.getDate()} – ${end.toLocaleString(undefined, { month: "short" })} ${end.getDate()}`;
    return {
      primary: sameMonth ? `${month} ${range}` : range,
      secondary: String(start.getFullYear()),
    };
  }

  if (scale === "month") {
    return {
      primary: start.toLocaleString(undefined, { month: "long" }),
      secondary: String(start.getFullYear()),
    };
  }

  if (scale === "quarter") {
    const q = Math.floor(start.getMonth() / 3) + 1;
    return { primary: `Q${q}`, secondary: String(start.getFullYear()) };
  }

  if (scale === "year") {
    return { primary: String(start.getFullYear()), secondary: null };
  }

  // decade
  return {
    primary: `${start.getFullYear()} — ${end.getFullYear()}`,
    secondary: null,
  };
}

export function Ruler({ origin, scrollX, pxPerDay, width, height = 44 }: Props) {
  const scale = scaleForPxPerDay(pxPerDay);
  const startDate = dateForScreenX(origin, 0, pxPerDay, scrollX);
  const endDate = dateForScreenX(origin, width, pxPerDay, scrollX);
  const ticks = useMemo(
    () => generateTicks(startDate, endDate, scale),
    [startDate, endDate, scale],
  );
  const lead = useMemo(
    () => leadLabelFor(scale, startDate, endDate),
    [scale, startDate, endDate],
  );

  return (
    <div className="relative h-full w-full bg-white">
      {/* Sticky lead badge at the far left — your "where am I" answer */}
      <div
        className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-md bg-white/95 px-2 py-1 shadow-sm ring-1 ring-ink/5"
      >
        {lead.secondary ? (
          <div className="text-[10px] font-bold uppercase leading-none tracking-wider text-muted">
            {lead.secondary}
          </div>
        ) : null}
        <div className="text-[15px] font-bold leading-tight text-ink">
          {lead.primary}
        </div>
      </div>

      <svg width={width} height={height} className="block">
        <line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke="#e5e7eb" />
        {ticks.map((t) => {
          const x = screenXForDate(origin, t.date, pxPerDay, scrollX);
          if (x < -60 || x > width + 60) return null;
          return (
            <g key={t.date} transform={`translate(${x},0)`}>
              <line
                x1={0}
                y1={t.major ? 0 : height - 12}
                x2={0}
                y2={height}
                stroke={t.major ? "#6b7280" : "#d1d5db"}
                strokeWidth={1}
              />
              <text
                x={4}
                y={height - 8}
                fontSize={t.major ? 13 : 11}
                fontWeight={t.major ? 700 : 600}
                fill={t.major ? "#0f1217" : "#374151"}
                style={{ userSelect: "none" }}
              >
                {t.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
