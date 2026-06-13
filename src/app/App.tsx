export function App() {
  return (
    <div className="mx-auto flex h-full max-w-[430px] flex-col">
      <header className="flex items-center justify-between px-5 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
        <h1 className="text-xl font-semibold tracking-tight">Lifetracks</h1>
        <span className="rounded-full bg-ink/5 px-2 py-1 text-xs text-muted">
          Phase 0
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 text-5xl" aria-hidden>
          🎼
        </div>
        <h2 className="text-lg font-medium">Foundation in place.</h2>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Scaffold + pure core ported from v2. The instrument is next.
        </p>
      </main>

      <footer className="px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 text-center text-xs text-muted">
        v0.0.0 · mobile-first at 390px
      </footer>
    </div>
  );
}
