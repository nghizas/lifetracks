import { useMemo } from "react";
import type { Conflict } from "@/core";
import { runSequencer, todayStr } from "@/core";
import { useStore } from "@/state";
import { Sheet } from "./Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConflictsSheet({ open, onClose }: Props) {
  const roadmap = useStore((s) => s.roadmap);
  const today = todayStr();
  const result = useMemo(() => runSequencer(roadmap, today), [roadmap, today]);

  const sorted = useMemo(() => sortConflicts(result.conflicts), [result.conflicts]);

  return (
    <Sheet open={open} onClose={onClose} title="Conflicts">
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Nothing's wrong. Carry on.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((c, i) => (
            <li
              key={i}
              className={`rounded-lg border p-3 text-sm ${
                c.severity === "overload"
                  ? "border-overload/30 bg-overload/5"
                  : c.severity === "snug"
                    ? "border-snug/40 bg-snug/10"
                    : "border-ink/10 bg-ink/[0.02]"
              }`}
            >
              <div className="font-medium">{labelForKind(c)}</div>
              <div className="mt-0.5 text-[13px] leading-snug text-ink">{c.msg}</div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function labelForKind(c: Conflict): string {
  switch (c.kind) {
    case "overload":
      return c.severity === "overload" ? "Over capacity" : "Snug capacity";
    case "transition":
      return "Transition collision";
    case "deadline":
      return "Deadline risk";
    case "silent":
      return "Silent track";
    case "cycle":
      return "Dependency cycle";
  }
}

function sortConflicts(cs: readonly Conflict[]): Conflict[] {
  const rank: Record<Conflict["kind"], number> = {
    overload: 0,
    cycle: 1,
    transition: 2,
    deadline: 3,
    silent: 4,
  };
  const sev: Record<Conflict["severity"], number> = {
    overload: 0,
    snug: 1,
    info: 2,
  };
  return cs
    .slice()
    .sort((a, b) => sev[a.severity] - sev[b.severity] || rank[a.kind] - rank[b.kind]);
}
