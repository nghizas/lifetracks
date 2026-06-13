import { useStore } from "@/state";

export function EmptyState() {
  const openSheet = useStore((s) => s.openSheet);
  const loadSample = useStore((s) => s.loadSample);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="mb-3 text-4xl" aria-hidden>
        🎼
      </div>
      <h2 className="text-base font-semibold">Three ways to start</h2>
      <p className="mt-1 max-w-[280px] text-center text-xs text-muted">
        Compose your roadmap by hand, with the Composer, or from a starter life.
      </p>

      <div className="mt-5 w-full max-w-[300px] space-y-2">
        <button
          type="button"
          disabled
          className="block w-full rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3 text-left opacity-50"
        >
          <div className="text-sm font-medium">Tell the Composer one thing</div>
          <div className="text-[11px] text-muted">arrives in Phase 2</div>
        </button>

        <button
          type="button"
          onClick={() => openSheet({ kind: "new-track" })}
          className="block w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-left"
        >
          <div className="text-sm font-medium">Add a track manually</div>
          <div className="text-[11px] text-muted">Career, Health, anything</div>
        </button>

        <button
          type="button"
          onClick={loadSample}
          className="block w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-left"
        >
          <div className="text-sm font-medium">Load a sample life</div>
          <div className="text-[11px] text-muted">Explore an example, then clear or keep</div>
        </button>
      </div>
    </div>
  );
}
