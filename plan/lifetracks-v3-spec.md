# Lifetracks v3 — Product & Architecture Specification

From prototype to product. v2 (single HTML file) proved the concept: a multitrack timeline for your life, composed conversationally with AI, with a deterministic sequencer keeping you honest about capacity. v3 is a proper application built for intuitiveness first — people should *want* to come here to plan their lives.

## Product principles

1. **Calm over complete.** Show less, mean more. Density problems are design failures, not user failures.
2. **Manual is first-class.** Adding a track or clip by hand must take under five seconds. The AI is an accelerant, never a requirement.
3. **The AI works small.** One track at a time. Concrete, dated, editable proposals. The human always holds the pen.
4. **Local-first, sync-ready.** Your life plan lives on your device and works offline; accounts and sync arrive later without a rewrite.
5. **The DAW metaphor stays under the hood** — tracks, clips, playhead, solo/mute — but the surface language is human.

## Vocabulary (user-facing)

| Term | Meaning | Timeline rendering |
|---|---|---|
| **Track** | A life domain (Fatherhood, Career, Health) | A horizontal lane group, color-coded |
| **Event** | A fixed moment (due date, wedding, move) — may carry a disruption zone | Diamond marker + shaded zone |
| **Task** | A span of effortful work toward something (train for marathon, learn system design) | Rounded bar, draggable/resizable |
| **Stem** | A recurring habit that grows over time (Sunday calls home, 3x/week exercise) | Baseline with notches |
| **Flag** | A milestone within or alongside a Task | Small flag marker |
| **Playhead** | The now-line | Red vertical line, always visible |

Internal `kind` values: `event | task | stem | flag`. (Migration maps v2 `goal→task`, `recurring→stem`, `milestone→flag`.)

## UX specification

### Timeline
- **Track order: newest on top.** New tracks insert at the top of the stack; drag track headers to reorder. Order persists.
- **Sub-lane stacking** within tracks (interval-graph greedy): overlapping clips never draw on top of each other; track height grows to fit. Flags get a thin dedicated lane when present.
- **Level-of-detail rendering:** labels truncate or hide when clips are too narrow; flags within ~24px cluster into a `⚑ 4` badge that zooms on click; full titles on hover. No two labels may ever overlap.
- **Accordion ruler** along the bottom edge of the canvas: decade → year → quarter → month → week, gridlines densify with zoom. Zoom anchors at cursor (pinch / ctrl-scroll / toolbar buttons).
- **Minimap scrollbar** docked at the very bottom: a slim strip rendering the entire planning horizon with clip density as faint colored marks and the current viewport as a draggable, resizable window. This is the primary horizontal navigation (plus drag-to-pan on the canvas and shift-scroll).
- **Playhead** always rendered; `space` jumps the viewport to now. Up Next strip shows ≤ 3 imminent clips + overflow count.
- **Balance meter** (toggleable strip): stacked effort share per track per period — the emergent-values view.

### Creating things (must be effortless)
- **Double-click an empty spot** in a track lane → inline clip creator at that date: type a title, pick kind (Task is default; Event/Stem/Flag one tap away), enter. Advanced fields (effort, window, dependencies, disruption) live behind "More."
- **"+" button on each track header** → same creator, anchored at the viewport center date.
- **Toolbar:** + Track, + Clip, Composer, Fit All, zoom, settings.
- **Keyboard:** `t` new track, `n` new clip, `space` jump to now, `cmd/ctrl-K` command palette (jump to track, create clip, toggle balance meter, "ask Composer…").
- **Direct manipulation:** drag clips in time, drag between tracks to recategorize, edge-resize tasks, double-click a clip to edit. Manual edits always outrank AI and sequencer suggestions.

### Onboarding (first run)
Empty state offers exactly three doors: "Tell the Composer one thing you're working toward," "Add a track manually," "Load a sample life" (a pre-built realistic roadmap to explore and then clear). No values quiz, no setup wizard.

## The Composer (track-scoped AI)

**Hard scope rule: the Composer operates on exactly one track per conversation thread.**

- The Composer panel has a **track focus selector**. Starting a thread either focuses an existing track or begins with "new track" intent ("I want to get promoted by June" → Composer proposes one new track + its clips).
- **Proposal limits:** per turn, ≤ 1 new track and ≤ 8 clips, all on the focused track. For large intents, propose Phase 1 (next 8–12 weeks) and offer subsequent phases conversationally.
- **Cross-track awareness without cross-track action:** the Composer sees the whole roadmap (read-only) for context and capacity, but ideas outside the focused track surface only as `suggestions: ["Your Health track has nothing supporting this — want to switch focus there next?"]` rendered as tappable chips that start a new focused thread.
- **Questions XOR proposals:** a turn that asks clarifying questions proposes ≤ 3 clips or none.
- **Capacity-aware:** request payload includes per-month remaining capacity (18-month lookahead); proposals must not push any month over capacity — trim and say so.
- **Ghost workflow:** proposals render as ghost clips on the focused track with per-clip ✓/✕, Accept all, and a pre-accept conflict delta ("if accepted: no new conflicts"). Nothing enters the roadmap unaccepted.
- Each track keeps its own thread history (capped), so returning to a track resumes its conversation.

**Response contract** (JSON only, zod-validated):
```ts
{
  message: string,
  questions: string[],
  suggestions: string[],            // cross-track chips, max 2
  proposal: {
    newTrack: { tempId, name, color } | null,
    newClips: NewClip[],            // ≤ 8, focused track only
    modifications: { clipId, changes }[],   // focused track only
    removals: string[]              // focused track only
  }
}
```
Client-side enforcement mirrors the prompt: clips referencing other tracks are dropped with a notice. Validation failure → show raw message + retry; never crash.

## Sequencer (unchanged physics, calmer voice)

Pure function `(roadmap) => { conflicts, suggestedPlacements, loadByMonth }`. Capacity 1.0/month, event disruption zones compound (floor 0.1), tasks cost `effort/5`, stems `effort/15`. Severity bands: ≤1.0 fine; 1.0–1.2 **Snug** (yellow — "tight but plausible," expected near disruptions); >1.2 **Over** (red). Contiguous months collapse into ranges ("Over capacity Jun–Nov '26, peak 1.3× in Aug") with expandable detail. Conflict types: over/snug load, transition collision, deadline risk, silent track, dependency cycle. Each conflict has one action: **Discuss fix** → opens a Composer thread focused on the most-implicated track, seeded with that conflict.

## Architecture

### Stack
- **Vite + React 18 + TypeScript (strict)**, Zustand for state, zod for schemas, Tailwind for styling, **vitest** (core) + **Playwright** (flows).
- **Rendering:** SVG with virtualization (only render clips intersecting the viewport ± margin); revisit Canvas only if profiling demands it past ~1,000 visible clips.
- **Persistence:** IndexedDB via Dexie. JSON export/import preserved (and imports v2 exports via migration).
- **Deploy:** static site (Vercel/Netlify/GitHub Pages). PWA shell (installable, offline) in Phase 3.

### Module layout (single repo, enforced boundaries)
```
src/
  core/        # PURE TypeScript. No React, no DOM, no Dexie.
    model.ts        # types + zod schemas + migrations (v2→v3 included)
    sequencer.ts    # capacity, conflicts, placements
    lanes.ts        # sub-lane assignment, label LOD, flag clustering
    recurrence.ts   # stem occurrence math
  state/       # Zustand store, undo/redo (command pattern), selection
  storage/     # StorageAdapter interface; DexieAdapter now; SyncAdapter later
  ai/          # composer.ts (prompt build, call, zod-validate, scope-enforce)
               # provider.ts (BYOK browser calls now; server proxy later — one swap point)
  timeline/    # SVG canvas, ruler, minimap, playhead, drag/zoom interactions
  panels/      # Composer, Conflicts, Up Next, Balance, editors, command palette
  app/         # shell, routing (if any), theming tokens
```
Rules: `core/` imports nothing from the other folders (lint-enforced); all `core/` functions unit-tested; `ai/` and `storage/` are the only modules touching the network and disk respectively.

### Data & sync posture
- Every entity carries `id`, `updatedAt`, and a tombstone on delete — cheap now, makes last-write-wins sync feasible later without schema surgery.
- `StorageAdapter` interface: `load() / save(patch) / exportJSON() / importJSON()`. The app never talks to Dexie directly.
- Single-user assumption everywhere *except* the adapter boundary.

### AI key handling
Phase 1–3: user-supplied Anthropic key, stored locally, clearly labeled, app fully functional without it. Phase 4 (accounts): introduce a thin server (Hono/Node or Supabase Edge Functions) that proxies Claude calls and owns the key; `ai/provider.ts` is the only file that changes.

## Roadmap

- **Phase 0 — Foundation.** Scaffold, port `core/` from the v2 HTML file (sequencer + recurrence logic exist; lanes/LOD are new), schema + v2-import migration, unit tests green. *Done when: v2 JSON export round-trips into the new model in tests.*
- **Phase 1 — The instrument.** Timeline with stacking/LOD, minimap, newest-on-top tracks with drag-reorder, all manual creation flows, undo/redo, persistence, export/import, conflicts panel with severity bands, balance meter. *Done when: a person who has never seen the app builds a 3-track roadmap by hand in under 3 minutes without docs, and nothing ever visually overlaps.*
- **Phase 2 — The Composer.** Track-scoped threads, contracts + enforcement, ghosts with conflict delta, suggestion chips, Discuss-fix. *Done when: "I'm about to become a father" yields a single-track, capacity-respecting, phase-framed proposal, and cross-track ideas arrive only as chips.*
- **Phase 3 — Living with it.** PWA install + offline, Web Notifications for Up Next, .ics export per clip, sample-life onboarding, polish pass (motion, empty states, sounds optional).
- **Phase 4 — Wheels.** Accounts, sync via SyncAdapter, server-side AI proxy, sharing/read-only links. (Out of scope to design now; the seams above are the design.)

## Working agreement for Opus (Claude Code)

Build in a git repo with Claude Code, not chat — this is a multi-file project with tests. Conventions: small commits per feature; `npm run check` (typecheck + lint + vitest) must pass before any commit; Playwright smoke test for each Phase-1 flow; visual judgment calls get a code comment starting `DESIGN:`. Definition of done per phase is the italicized criterion above, verified by Opus before declaring the phase complete. Port logic from the attached v2 `lifetracks.html` where it exists rather than rewriting — the sequencer and recurrence math are proven.

## Business model (provider-agnostic AI)

**Principles:** the manual instrument is free forever; one flat price covers every AI brain; nobody pays twice; nobody sees a token.

| Tier | Price | What it includes |
|---|---|---|
| **Free** | $0 | Full manual tool: unlimited tracks/clips, sequencer, conflicts, balance meter, export/import, local-first. Plus a monthly taste of the Composer (~10 messages, standard model). |
| **Plus** | ~$7–9/mo or ~$70–90/yr | Full Composer with model picker (Claude Sonnet/Opus, GPT, Gemini — "Auto" default), generous fair-use cap stated in human units (hundreds of messages/mo), sync + notifications when shipped (Phases 3–4). |
| **BYOK** | Free | Bring your own API key for any supported provider; full Composer, no cap, no subscription required. Deliberate break from Superwhisper's Pro-gated BYOK — avoids "paying twice" resentment and keeps the agnostic promise honest. |
| **Lifetime (optional, early)** | One-time | App features only — never bundles managed AI (perpetual price + perpetual COGS = slow leak). AI via Plus or BYOK. |

**Fair-use mechanics:** cap set above the 99th-percentile user; premium models weight more against the cap internally but show no per-model pricing; at the cap, degrade gracefully (switch to the efficient model or continue via BYOK) — never hard-wall mid-conversation; a simple meter appears only when ≥80% consumed. Economics rationale: Composer usage is episodic (deep sessions at life events, light weekly check-ins), so worst-case COGS per active user is low single-digit dollars/month — flat pricing is safe here.

**Architecture implications:**
- `ai/provider.ts` becomes a **provider registry**: one adapter per vendor (Anthropic, OpenAI, Google), each normalizing to the same proposal JSON contract. Contract tests per provider (JSON-compliance reliability varies by vendor/model).
- Model selection is a per-thread setting; "Auto" routes to the best value model for the task.
- Phase 4's server proxy owns vendor keys, per-user metering, caps, and abuse control; entitlements (free/plus/byok) checked there. Payments via Stripe (web) — and RevenueCat/StoreKit if/when app-store distribution lands.
- BYOK keys stay client-side only and are never sent to the Lifetracks server.

## Mobile-first design

People will plan their lives on their phones. Design for the phone first; let desktop be the widescreen luxury.

**The phone leads with three surfaces:**
1. **Today / Up Next feed** — what the playhead is approaching, with done/skip/snooze. The daily touchpoint.
2. **Composer chat** — inherently phone-native; track-scoped threads double as the mobile navigation model (one track, one conversation).
3. **Single-track focus view** — a horizontal, pinch-zoomable timeline of one track at a time, with the minimap as scrubber.

The **full multitrack (orchestral) view** exists on mobile as a zoomed-out, read-mostly overview you tap to enter a track; it is the primary canvas only on tablet/desktop.

**Interaction rules:** bottom-sheet editors (never modals); floating "+" in the thumb zone (long-press to choose Track/Event/Task/Stem); long-press initiates clip drag so dragging never fights scrolling; touch targets ≥ 44px; ruler and minimap heights sized for fingers.

**Platform path:** responsive PWA from Phase 1 (one codebase, installable, offline via Phase 3 service worker); Capacitor wrapper later only when app-store presence and real push notifications (APNs/FCM) justify it.

**Phase 1 acceptance addendum:** the 3-minute "build a roadmap by hand" test must also pass on a 390px-wide viewport with touch emulation.

## Ideas backlog (gleaned from the AI-coach app landscape)

Market note: existing AI life-coach apps all operate at day-scale (habits, streaks, morning routines, chat). None own the multi-year timeline or life-transition sequencing. Positioning: *they're coaches without a canvas; Lifetracks is a canvas with a coach.* Stay one thing — no food scanning, no meditation timers, no kitchen sink.

- **Rehearsal notes (weekly briefing)** — Composer-generated digest of what the playhead crosses this week: due stems, imminent clips, approaching conflicts. Anchors the mobile Today feed; later the substance of notifications. *Phase 3.*
- **Stem check-off + gentle streaks** — notches fill when completed (done/skip from Up Next already exists); small streak count and per-stem consistency view. Deliberately minimal — engagement hook, not a habit-tracker pivot. *Phase 3.*
- **Track templates** — one-tap starter tracks (*New Parent, Job Hunt, First Marathon, Buy a House, Sabbatical*) installed pre-personalization; the Composer then tailors conversationally. Doubles as onboarding and as marketing landing pages. *Phase 2–3.*
- **Recompose (failure recovery)** — select a time stretch, tell the Composer what happened ("sick two weeks," "move delayed a month"); it proposes ghost *modifications* that shift the arrangement without shame. Likely retention-critical: plans are arrangements, re-arranging is normal. *Phase 2 (it's just a modifications-focused Composer mode).*
- **Voice input to Composer** — mic button: system dictation first; real-time voice later. Mobile-native and on-brand. *Phase 3.*
- **Far-future parking lot** — calendar two-way sync, HealthKit-style integrations, shared tracks (partner planning a baby together). Not designed now; the StorageAdapter/provider seams keep them possible.

## Interaction grammar

**Three modes by orientation/surface:** portrait Today = *act* (briefing, check-offs, occurrence sheets); portrait Tracks = *assess* (read-mostly orchestral scan, balance meter, conflicts chip); landscape (and desktop) = *arrange* (full DAW canvas: headers, solo/mute, sub-lanes, drag, ghosts).

**Universal rule: tap inspects, long-press moves.** Tapping never relocates anything; long-press lifts a clip for dragging.

**Tap targets → sheets (bottom sheets, never modals):**
- **Stem dot → occurrence sheet.** Done / Snooze / Skip (Done visually primary); rhythm strip of the last ~8 occurrences (missed weeks render as neutral dashes — streaks count from recovery, never shame); a per-occurrence note that surfaces on the next occurrence; occurrence-scoped Composer chip ("ideas for this week's call"); link to series settings (frequency, until-date, effort, delete) one level deeper — occurrence vs. series mirrors calendar-app recurring events.
- **Task bar → task sheet.** Status/progress, flags as an inline checklist, dates + effort + window, dependencies, "Recompose this task" (Composer modifications mode).
- **Event diamond → event sheet.** Countdown, disruption-zone editor (months before/after, capacity dip), and a list of clips currently inside the blast radius.
- **Flag → confirm popover** (reached / move) — no full sheet.
- **Track name → focus view** for that track. Long-press track name → reorder.
- **Empty lane area:** double-tap (mobile: tap-and-hold empty space) → inline clip creator at that date.

Every sheet carries a context-scoped Composer chip; scope narrows with the target (track → clip → single occurrence).
