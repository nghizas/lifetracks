// SVG shape components for each clip kind. Pure presentational; selection
// and click handling go through props so logic stays in Timeline.tsx.
//
// Label policy (post-feedback): every clip carries a visible label —
//   - task/stem with enough width → label inline on the bar
//   - task/stem with little width → label rendered to the right of the bar
//   - event diamond / flag marker → label always to the right of the marker
// Optional emoji prefix (clip.notes interpreted as a single-emoji adornment if
// it starts with one) gives a compact identity when space is tight.

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

const EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

function splitEmoji(s: string): { emoji: string | null; rest: string } {
  const m = s.match(EMOJI_RE);
  if (!m) return { emoji: null, rest: s };
  return { emoji: m[0], rest: s.slice(m[0].length).trimStart() };
}

const LABEL_INLINE_MIN_WIDTH = 36;
const LABEL_RIGHT_PADDING = 6;

export function TaskBar({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const radius = Math.min(6, box.h / 2);
  const { emoji, rest } = splitEmoji(clip.title);
  const inline = box.w >= LABEL_INLINE_MIN_WIDTH;
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
        opacity={clip.status === "done" ? 0.45 : 0.92}
        stroke={selected ? "#0f1217" : "transparent"}
        strokeWidth={selected ? 1.5 : 0}
      />
      {inline ? (
        <text
          x={box.x + 8}
          y={box.y + box.h / 2}
          dominantBaseline="central"
          fontSize={11}
          fontWeight={500}
          fill="white"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {emoji ? `${emoji} ${rest}` : clip.title}
        </text>
      ) : (
        <text
          x={box.x + box.w + LABEL_RIGHT_PADDING}
          y={box.y + box.h / 2}
          dominantBaseline="central"
          fontSize={11}
          fontWeight={500}
          fill="#0f1217"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {emoji ? `${emoji} ${rest}` : clip.title}
        </text>
      )}
      <title>{`${clip.title} · ${clip.start}${clip.end ? ` → ${clip.end}` : ""}`}</title>
    </g>
  );
}

export function StemBar({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const { emoji, rest } = splitEmoji(clip.title);
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
        y1={box.y + box.h / 2 + 5}
        x2={box.x + box.w}
        y2={box.y + box.h / 2 + 5}
        stroke={trackColor}
        strokeWidth={2}
        strokeDasharray="3 5"
        opacity={0.9}
      />
      <text
        x={box.x + 2}
        y={box.y + box.h / 2 - 2}
        fontSize={10}
        fontWeight={500}
        fill={trackColor}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {emoji ? `${emoji} ${rest}` : `↻ ${clip.title}`}
      </text>
      {selected ? (
        <rect
          x={box.x - 2}
          y={box.y + 2}
          width={Math.max(4, box.w + 4)}
          height={box.h - 4}
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
  const cx = box.x;
  const cy = box.y + box.h / 2;
  const r = Math.min(7, box.h / 2 - 2);
  const { emoji, rest } = splitEmoji(clip.title);
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="event"
      aria-label={`Event: ${clip.title}`}
    >
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        fill={trackColor}
        stroke={selected ? "#0f1217" : "white"}
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={cx + r + LABEL_RIGHT_PADDING}
        y={cy}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill="#0f1217"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {emoji ? `${emoji} ${rest}` : `◆ ${clip.title}`}
      </text>
      <title>{`${clip.title} · ${clip.start}`}</title>
    </g>
  );
}

export function FlagMarker({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const x = box.x;
  const top = box.y + 1;
  const bot = box.y + box.h - 1;
  const { emoji, rest } = splitEmoji(clip.title);
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="flag"
      aria-label={`Flag: ${clip.title}`}
    >
      <line x1={x} y1={top} x2={x} y2={bot} stroke={trackColor} strokeWidth={1.5} />
      <polygon
        points={`${x},${top} ${x + 10},${top + 4} ${x},${top + 8}`}
        fill={trackColor}
        stroke={selected ? "#0f1217" : "transparent"}
        strokeWidth={selected ? 1 : 0}
      />
      <text
        x={x + 13}
        y={top + 6}
        fontSize={10}
        fontWeight={500}
        fill={trackColor}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {emoji ? `${emoji} ${rest}` : `⚑ ${clip.title}`}
      </text>
      <title>{clip.title}</title>
    </g>
  );
}
