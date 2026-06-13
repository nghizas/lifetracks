// SVG shape components for each clip kind. Pure presentational; selection
// and click handling go through props so logic stays in Timeline.tsx.

import type { Clip } from "@/core";

export interface ClipBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BaseProps {
  clip: Clip;
  trackColor: string;
  box: ClipBox;
  selected?: boolean;
  onClick?: (e: React.PointerEvent<SVGElement>) => void;
}

export function TaskBar({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const radius = Math.min(6, box.h / 2);
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="task"
      aria-label={`Task: ${clip.title}`}
    >
      <rect
        x={box.x}
        y={box.y + 2}
        width={Math.max(2, box.w)}
        height={box.h - 4}
        rx={radius}
        ry={radius}
        fill={trackColor}
        opacity={clip.status === "done" ? 0.45 : 0.9}
        stroke={selected ? "#0f1217" : "transparent"}
        strokeWidth={selected ? 1.5 : 0}
      />
      {box.w > 50 ? (
        <text
          x={box.x + 8}
          y={box.y + box.h / 2}
          dominantBaseline="central"
          fontSize={11}
          fill="white"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {clip.title}
        </text>
      ) : null}
      <title>{`${clip.title} · ${clip.start}${clip.end ? ` → ${clip.end}` : ""}`}</title>
    </g>
  );
}

export function StemBar({ clip, trackColor, box, selected, onClick }: BaseProps) {
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="stem"
      aria-label={`Stem: ${clip.title}`}
    >
      <line
        x1={box.x}
        y1={box.y + box.h / 2}
        x2={box.x + box.w}
        y2={box.y + box.h / 2}
        stroke={trackColor}
        strokeWidth={2}
        strokeDasharray="2 4"
        opacity={0.85}
      />
      {box.w > 50 ? (
        <text
          x={box.x + 4}
          y={box.y + box.h / 2 - 6}
          fontSize={10}
          fill={trackColor}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {clip.title}
        </text>
      ) : null}
      {selected ? (
        <rect
          x={box.x}
          y={box.y + 4}
          width={Math.max(2, box.w)}
          height={box.h - 8}
          fill="none"
          stroke="#0f1217"
          strokeWidth={1.5}
          rx={3}
        />
      ) : null}
      <title>{`${clip.title} (stem)`}</title>
    </g>
  );
}

export function EventDiamond({ clip, trackColor, box, selected, onClick }: BaseProps) {
  // box.x = disruption-zone start; we draw the zone, then the diamond at the start date proper.
  const cx = box.x;
  const cy = box.y + box.h / 2;
  const r = Math.min(7, box.h / 2 - 2);
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="event"
      aria-label={`Event: ${clip.title}`}
    >
      {clip.disruption && box.w > 0 ? (
        <rect
          x={box.x}
          y={box.y + 2}
          width={box.w}
          height={box.h - 4}
          fill={trackColor}
          opacity={0.12}
          rx={4}
        />
      ) : null}
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        fill={trackColor}
        stroke={selected ? "#0f1217" : "white"}
        strokeWidth={selected ? 2 : 1}
      />
      <title>{`${clip.title} · ${clip.start}`}</title>
    </g>
  );
}

export function FlagMarker({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const x = box.x;
  const top = box.y + 1;
  const bot = box.y + box.h - 1;
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="flag"
      aria-label={`Flag: ${clip.title}`}
    >
      <line x1={x} y1={top} x2={x} y2={bot} stroke={trackColor} strokeWidth={1} />
      <polygon
        points={`${x},${top} ${x + 8},${top + 3} ${x},${top + 6}`}
        fill={trackColor}
        stroke={selected ? "#0f1217" : "transparent"}
        strokeWidth={selected ? 1 : 0}
      />
      <title>{clip.title}</title>
    </g>
  );
}
