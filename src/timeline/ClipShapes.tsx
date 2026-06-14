// SVG shape components for each clip kind. Visual rules (post-feedback):
//
//   - Span  (kind="task"): rounded pill bar. Minimum visible width so a
//     one-day span still reads as a span, never collapses into a marker.
//     Label inside, truncated to fit; hidden when too narrow (tap to read).
//   - Stem  (kind="stem"): a thin colored baseline plus a row of filled
//     circles at each recurrence date. The caller supplies the visible
//     occurrence x-positions (already thinned for the current zoom).
//   - Event (kind="event"): diamond marker. The disruption zone (if any)
//     is drawn behind the diamond by the parent renderer. No label.
//   - Flag  (kind="flag"): small flag pictogram. No label.

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

interface StemBarProps extends BaseProps {
  /** Already-thinned screen x-positions where occurrence dots should render. */
  occurrenceXs?: readonly number[];
}

const EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
function splitEmoji(s: string): { emoji: string | null; rest: string } {
  const m = s.match(EMOJI_RE);
  if (!m) return { emoji: null, rest: s };
  return { emoji: m[0], rest: s.slice(m[0].length).trimStart() };
}

const CHAR_PX = 6.4;
function truncateToFit(s: string, widthPx: number): string {
  if (widthPx <= 0) return "";
  const maxChars = Math.floor(widthPx / CHAR_PX);
  if (maxChars >= s.length) return s;
  if (maxChars < 3) return "";
  return s.slice(0, maxChars - 1) + "…";
}

// A one-day span renders ~10px wide so it still reads as a pill (post-feedback:
// "a little span should still look like a span, never an event marker").
const SPAN_MIN_WIDTH = 10;

export function TaskBar({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const w = Math.max(SPAN_MIN_WIDTH, box.w);
  const radius = Math.min(6, box.h / 2);
  const { emoji, rest } = splitEmoji(clip.title);
  const labelSrc = emoji ? `${emoji} ${rest}` : clip.title;
  const innerWidth = w - 16;
  const label = innerWidth >= 24 ? truncateToFit(labelSrc, innerWidth) : "";
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="task"
      aria-label={`Span: ${clip.title}`}
    >
      <rect
        x={box.x}
        y={box.y + 2}
        width={w}
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

export function StemBar({
  clip,
  trackColor,
  box,
  selected,
  onClick,
  occurrenceXs = [],
}: StemBarProps) {
  const { emoji, rest } = splitEmoji(clip.title);
  const labelSrc = emoji ? `${emoji} ${rest}` : clip.title;
  const innerWidth = box.w - 4;
  const label = innerWidth >= 28 ? truncateToFit(labelSrc, innerWidth) : "";
  const baselineY = box.y + box.h - 7;
  return (
    <g
      onPointerUp={onClick}
      style={{ cursor: "pointer" }}
      data-clip-id={clip.id}
      data-clip-kind="stem"
      aria-label={`Stem: ${clip.title}`}
    >
      {/* Quiet baseline so the rhythm has a visual track, not just floating dots */}
      <line
        x1={box.x}
        y1={baselineY}
        x2={box.x + box.w}
        y2={baselineY}
        stroke={trackColor}
        strokeWidth={1}
        opacity={0.25}
      />
      {/* Occurrence dots — one per recurrence (thinned to fit by the caller) */}
      {occurrenceXs.map((x, i) => (
        <circle
          key={i}
          cx={x}
          cy={baselineY}
          r={3}
          fill={trackColor}
          opacity={clip.status === "done" ? 0.45 : 0.9}
        />
      ))}
      {label ? (
        <text
          x={box.x + 2}
          y={box.y + box.h / 2 - 4}
          fontSize={10}
          fontWeight={600}
          fill={trackColor}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          ↻ {label}
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
      <title>{`${clip.title} (stem · ${clip.recurrence?.freq ?? "weekly"})`}</title>
    </g>
  );
}

export function EventDiamond({ clip, trackColor, box, selected, onClick }: BaseProps) {
  const cx = box.x;
  const cy = box.y + box.h / 2;
  const r = Math.min(8, box.h / 2 - 1);
  const timeSuffix = clip.startTime ? ` ${clip.startTime}` : "";
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
      <title>{`${clip.title} · ${clip.start}${timeSuffix}`}</title>
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
