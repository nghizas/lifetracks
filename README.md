# Lifetracks

A multitrack timeline for your life — composed by hand, accelerated by a track-scoped AI Composer, kept honest by a deterministic sequencer.

> *They're coaches without a canvas; Lifetracks is a canvas with a coach.*

## Repo layout

| Path | What's in it |
|---|---|
| `plan/lifetracks-v3-spec.md` | Product & architecture spec — read this first |
| `plan/lifetracks-build-ops.md` | Build strategy: PWA-first, mobile-from-day-one, deploy on day one |
| `design/` | HTML mockups (iPhone home, landscape arrangement, sheets, settings, templates) |
| `reference/v2-prototype.html` | The v2 single-file prototype. Phase 0 ports its sequencer + recurrence math into `src/core/` |
| `src/` | The v3 app (Vite + React + TS, strict) — created in Phase 0 |

## Stack (target)

Vite + React 18 + TypeScript (strict) · Zustand · zod · Tailwind · Dexie (IndexedDB) · vitest + Playwright · static deploy (Vercel/Netlify) with PWA shell in Phase 3.

## Phases

- **Phase 0** — scaffold, port pure core from v2, schema + v2-import migration, tests green
- **Phase 1** — the instrument: timeline canvas, manual creation, conflicts, balance meter (mobile-first, 390px)
- **Phase 2** — the Composer: track-scoped AI proposals with ghost workflow
- **Phase 3** — living with it: PWA install, notifications, .ics export, polish
- **Phase 4** — wheels: accounts, sync, server-side AI proxy

## Working agreement

`npm run check` (typecheck + lint + vitest) must pass before any commit. Each phase ends at a review gate.
