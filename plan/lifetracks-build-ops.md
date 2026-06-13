# Lifetracks — Build Operations Plan

Companion to `lifetracks-v3-spec.md` and the design mockups. The short version: the web app built on the computer IS the mobile app. PWA first, Capacitor only when forced.

## The strategy
- Build with Claude Code on the computer (your strong environment) — Vite + React + TS per the spec.
- Develop **mobile-sized from day one**: viewport locked to 390px (devtools device mode or a phone-width dev frame). Desktop/landscape comes along free.
- No native rewrite, ever. The escalation path is: web app → installable PWA → Capacitor wrapper (same codebase in a native shell) → app stores.

## Order of operations
1. Init repo; drop in `lifetracks-v3-spec.md`, this file, and the mockup screenshots (`/design` folder).
2. Claude Code: "Read the spec, execute Phase 0, stop for review." (Scaffold, pure core ported from v2 HTML, schema + migrations, tests green.)
3. **Wire the deploy pipeline immediately** — Vercel/Netlify on day one, even while the app is empty. Every commit = a URL.
4. Open that URL on the iPhone, **Add to Home Screen** — instant "app" with an icon, no Xcode, no store.
5. Phase 1 — but build the **timeline canvas first**: it's the riskiest piece (touch-drag on a zoomable SVG). Get it under your thumb on the real phone before building anything else. If the canvas feels good, everything downstream is easy mode.
6. The loop: Claude Code builds on the computer → push → 30 seconds later you're thumbing it on the couch. Real UX decisions happen on the phone, not in devtools.

## Test on the real phone EARLY (week 1–2, not month 3)
- **Long-press drag vs. Safari scroll** — the "tap inspects, long-press moves" rule needs `touch-action` discipline on the canvas.
- **Pinch zoom on the timeline** vs. the browser's own page pinch — must capture and prevent default on the canvas.
- **Safari storage eviction** — call `navigator.storage.persist()` at startup; keep export-backup prominent (iOS can purge IndexedDB from rarely-used sites).
- Thumb reach, touch targets ≥44px, bottom-sheet feel.

## When to go native (and only then)
- Trigger 1: App Store distribution/discovery matters.
- Trigger 2: bulletproof push notifications (installed-PWA web push on iOS exists but is the rougher road).
- Response: wrap the same codebase in **Capacitor** — days of work, not a rewrite. React Native / Swift = maintaining a second app forever, no payoff for a timeline-canvas product.

## Reminders
- Phase-gated reviews: have Claude Code stop after each phase; you steer, it builds.
- `npm run check` (typecheck + lint + vitest) green before any commit; Playwright smoke tests per Phase-1 flow.
- Phase 1 acceptance: never-seen-it user builds a 3-track roadmap by hand in <3 minutes, nothing visually overlaps — **and it passes at 390px with touch.**
- Soft-launch monetization: Free + BYOK only, no billing infra; let a month of real Composer usage set the Plus cap and price.
