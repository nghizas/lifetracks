// Accordion ruler — labels and gridlines at the appropriate scale.

import { useMemo } from "react";
import { dateForScreenX, screenXForDate } from "./coords";
import { generateTicks, scaleForPxPerDay } from "./ruler-ticks";

interface Props {
  origin: string;
  scrollX: number;
  pxPerDay: number;
  width: number;
  height?: number;
}

export function Ruler({ origin, scrollX, pxPerDay, width, height = 28 }: Props) {
  const ticks = useMemo(() => {
    const start = dateForScreenX(origin, 0, pxPerDay, scrollX);
    const end = dateForScreenX(origin, width, pxPerDay, scrollX);
    return generateTicks(start, end, scaleForPxPerDay(pxPerDay));
  }, [origin, scrollX, pxPerDay, width]);

  return (
    <svg width={width} height={height} className="block">
      <rect width={width} height={height} fill="#fafafa" />
      <line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke="#e5e7eb" />
      {ticks.map((t) => {
        const x = screenXForDate(origin, t.date, pxPerDay, scrollX);
        if (x < -40 || x > width + 40) return null;
        return (
          <g key={t.date} transform={`translate(${x},0)`}>
            <line
              x1={0}
              y1={t.major ? 0 : height - 8}
              x2={0}
              y2={height}
              stroke={t.major ? "#9ca3af" : "#e5e7eb"}
              strokeWidth={1}
            />
            <text
              x={4}
              y={height - 10}
              fontSize={t.major ? 11 : 10}
              fontWeight={t.major ? 600 : 400}
              fill={t.major ? "#0f1217" : "#6b7280"}
              style={{ userSelect: "none" }}
            >
              {t.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
