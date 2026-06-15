// The accept/reject UI for the currently pending Composer proposal. Reads
// `currentProposal` from the store; rendered inline by ComposerSheet.

import { useStore } from "@/state";

export function ProposalDeck() {
  const proposal = useStore((s) => s.currentProposal);
  const accept = useStore((s) => s.acceptProposalItem);
  const reject = useStore((s) => s.rejectProposalItem);
  const acceptAll = useStore((s) => s.acceptAllProposal);
  const clear = useStore((s) => s.setCurrentProposal);

  if (!proposal) return null;
  const { newTrack, newClips, modifications, removals } = proposal.proposal;
  const total =
    (newTrack ? 1 : 0) + newClips.length + modifications.length + removals.length;
  if (total === 0) return null;

  return (
    <div className="rounded-md border border-violet-300 bg-violet-50/60 p-3 text-[12px]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-violet-800">
          Proposed · {total} item{total === 1 ? "" : "s"}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold text-white"
          >
            ✓ Accept all
          </button>
          <button
            type="button"
            onClick={() => clear(null)}
            className="rounded-full border border-ink/15 px-3 py-1 text-[11px] font-semibold"
          >
            ✕ Reject all
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {newTrack ? (
          <Item
            label={
              <>
                <span className="font-semibold">New track:</span> {newTrack.name}{" "}
                <span
                  className="ml-1 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: newTrack.color }}
                />
              </>
            }
            onAccept={() => accept({ kind: "newTrack" })}
            onReject={() => reject({ kind: "newTrack" })}
          />
        ) : null}

        {newClips.map((c, i) => (
          <Item
            key={`new-${i}`}
            label={
              <>
                <span className="rounded-sm bg-ink/10 px-1 font-mono text-[10px] uppercase">
                  {c.kind}
                </span>{" "}
                <span className="font-semibold">{c.title}</span>{" "}
                <span className="text-muted">
                  {c.start}
                  {c.end ? ` → ${c.end}` : ""}
                  {c.recurrence ? ` · ${c.recurrence.freq}` : ""}
                </span>
              </>
            }
            onAccept={() => accept({ kind: "newClip", index: i })}
            onReject={() => reject({ kind: "newClip", index: i })}
          />
        ))}

        {modifications.map((m, i) => (
          <Item
            key={`mod-${i}`}
            label={
              <>
                <span className="font-semibold">Modify</span>{" "}
                <span className="font-mono text-[10px]">{m.clipId}</span>:{" "}
                <span className="text-muted">{Object.keys(m.changes).join(", ")}</span>
              </>
            }
            onAccept={() => accept({ kind: "modification", index: i })}
            onReject={() => reject({ kind: "modification", index: i })}
          />
        ))}

        {removals.map((id, i) => (
          <Item
            key={`rm-${i}`}
            label={
              <>
                <span className="font-semibold">Remove</span>{" "}
                <span className="font-mono text-[10px]">{id}</span>
              </>
            }
            onAccept={() => accept({ kind: "removal", index: i })}
            onReject={() => reject({ kind: "removal", index: i })}
          />
        ))}
      </ul>
    </div>
  );
}

function Item({
  label,
  onAccept,
  onReject,
}: {
  label: React.ReactNode;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 ring-1 ring-ink/5">
      <div className="min-w-0 flex-1 truncate">{label}</div>
      <button
        type="button"
        onClick={onAccept}
        aria-label="Accept"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-[14px] font-bold text-white"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onReject}
        aria-label="Reject"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/15 text-[14px] font-bold text-muted"
      >
        ✕
      </button>
    </li>
  );
}
