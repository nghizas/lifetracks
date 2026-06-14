// SVG shape components for each clip kind.
//
// Post-feedback label policy (no more overlapping labels on the canvas):
//   - task: title rendered INSIDE the bar, truncated to fit; if too narrow,
//     no label at all (tap the clip to read the sheet)
//   - stem: small title above the dashed line, only when there's room
//   - event: NO label (the disruption zone + colored diamond are the identity)
//   - flag: NO label (tap to read)
// An optional single-emoji prefix on `clip.title` is kept as a compact glyph.

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

const CHAR_PX = 6.4; // approx avg width of an 11px sans-serif glyph
function truncateToFit(s: string, widthPx: number): string {
  if (widthPx <= 0) return "";
  const maxChars = Math.floor(widthPx / CHAR_PX);
  if (maxChars >= s.length) return s;
  if (maxChars < 3) return "";
  return s.slice(0, maxChars - 1) + "…";
}

export function TaskBar({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const radius = Math.min(6, box.h / 2);
  const { emoji, rest } = splitEmoji(clip.title);
  const labelSrc = emoji ? `${emoji} ${rest}` : clip.title;
  const innerWidth = box.w - 16;
  const label = innerWidth >= 24 ? truncateToFit(labelSrc, innerWidth) : "";
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
      {label ? (
        <text
          x={box.x + 8}
          y={box.y + box.h / 2}
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
          fill="white"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {label}
        </text>
      ) : null}
      <title>{`${clip.title} · ${clip.start}${clip.end ? ` → ${clip.end}` : ""}`}</title>
    </g>
  );
}

export function StemBar({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const { emoji, rest } = splitEmoji(clip.title);
  const labelSrc = emoji ? `${emoji} ${rest}` : `↻ ${clip.title}`;
  const innerWidth = box.w - 4;
  const label = innerWidth >= 32 ? truncateToFit(labelSrc, innerWidth) : "";
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
      {label ? (
        <text
          x={box.x + 2}
          y={box.y + box.h / 2 - 2}
          fontSize={10}
          fontWeight={500}
          fill={trackColor}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {label}
        </text>
      ) : null}
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
  // No outside label — the zone + diamond are the identity. Tap to read details.
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
  // No label — tap the flag to read. Visually a small flag sprite only.
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
      <line x1={x} y1={top} x2={x} y2={bot} stroke={trackColor} strokeWidth={1.5} />
      <polygon
        points={`${x},${top} ${x + 10},${top + 4} ${x},${top + 8}`}
        fill={trackColor}
        stroke={selected ? "#0f1217" : "transparent"}
        strokeWidth={selected ? 1 : 0}
      />
      <title>{clip.title}</title>
    </g>
  );
}
