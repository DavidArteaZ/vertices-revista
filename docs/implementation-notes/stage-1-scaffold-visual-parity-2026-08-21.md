# Implementation notes — Stage 1, scaffold & visual parity

- **Spec**: `docs/superpowers/specs/2026-08-20-vertices-nextjs-supabase-design.md`
- **Plan**: `docs/superpowers/plans/2026-08-21-stage-1-scaffold-visual-parity.md`
- **Started**: 2026-08-21

## Decisions made outside the spec

- **App lives in `web/`, legacy stays at the repo root.** The legacy site is
  the visual reference for the whole stage and must stay deployable on Netlify
  until cutover. At cutover, Vercel's *Root Directory* is pointed at `web/`.
- **Ports pinned: app 3100, legacy fixture 4399.** 3000 is occupied on this
  machine, and the visual suite needs a fixed origin. `dev` and `start` both
  carry `-p 3100`.
- **`turbopack.root` is set explicitly.** A stray `package-lock.json` sits in
  the parent directory, outside the repo; without pinning the root Turbopack
  warns on every build.
- **Golden baselines are NOT committed.** 72 PNGs, 68 MB, against a repo that
  is otherwise 1.5 MB. They regenerate deterministically from the legacy site —
  which is itself in the repo — via `npm run baseline -- --update-snapshots`,
  in about three minutes. Rejected the alternative of committing them: a 45×
  repo-size increase to store something reproducible from source.
  **Consequence to watch:** once the legacy site is deleted at cutover, the
  reference lives only in git history. Commit the baselines at that point, or
  freeze them another way.
- **CSS extracted with `sed`, not retyped.** 570 lines have to be
  byte-identical. Verified by diffing the extract against `index.html:16-585`:
  exactly 12 differing lines, all six `@font-face` `src` URLs gaining a leading
  slash. A read-then-retype round trip would have risked silent drift with no
  way to detect it.

## Deviations from the plan

- **Task order:** T2 (baselines) was pulled ahead of T3–T7. It is the stage's
  highest-risk item — if the capture had proven non-reproducible, the gate that
  the entire stage rests on would have been worthless. Better to learn that at
  task 2 than at task 16. It did in fact take three attempts to make
  deterministic (see below).
- **Landing baselines are viewport captures, not `body` captures.** The plan
  said `page.locator("body")`. That was wrong twice over: the body is ~8700 px
  tall because of the 680vh `#recorrido` spacer, so the canvas — the only thing
  that changes between phases — occupied about 10% of each frame, and a
  `maxDiffPixelRatio` of 0.001 over 1440×8676 would have allowed ~12,500 pixels
  of drift. Worse, the fixed-position canvas **was not captured at all** in the
  stitched full-body screenshot; the first image inspected had an empty hero
  with no wordmark. A gate over a blank canvas is trivially stable and proves
  nothing. Now: viewport shots per phase, plus one separate `fullPage` shot per
  locale for the static portal content.
- **Per-test timeout raised to 180 s.** Eight screenshots per landing test, each
  waiting for frame stability, overruns the 30 s default — it was dying on the
  seventh.

## Gotchas / surprises

- **The engine is not reproducible without help.** Two independent sources of
  non-determinism, both fixed from the test side via `addInitScript` so the
  legacy site stays untouched:
  1. `buildNetwork` places all 27 constellation nodes with `Math.random`
     (`index.html:1252-1298`), and randomness also drives tints, particle
     seeds, edge beads, and which long edges get added. Fixed with a seeded
     mulberry32 over `Math.random`.
  2. **Seeding alone was not enough.** The engine auto-rotates the
     constellation after 3 s idle, accumulating `autoAng` on every real
     animation frame (`index.html:1507-1511`), so the network's angle at
     capture time depended on how long the page took to load. Signature: only
     `u=0.48` failing, by ~6000 of 1.3M pixels, with the count varying run to
     run. Playwright's `page.clock.install()` did **not** stop it. Fixed by
     stubbing `requestAnimationFrame` to a no-op — `__qa.runTo` runs its own
     synchronous update/render loop and does not need rAF, so the test becomes
     the only thing driving the engine.
- **Seeding the RNG turned out to be a feature, not just a fix.** Because both
  the legacy site and the port run from the same seed, the parity test asserts
  that the port consumes random numbers in the *same order*. If `buildNetwork`
  draws one value more or fewer than the original, the constellation differs
  and the gate catches it. That is a much stronger check on the port than
  originally planned.
- **The typewriter is now asserted too.** With `secLabelTimer` advancing only
  inside `runTo`, the `u=0.75` baseline captures the section labels mid-stroke
  (`Capital Soc|`, `Excel|`), so label timing is part of the contract.
- **Next 16 emits CSS to `/_next/static/chunks/*.css`**, not
  `/_next/static/css/`. The minifier also lowercases hex, so `#E7DECB` becomes
  `#e7decb` — greps against compiled output need `-i`.

- **`globals.css` cannot be a global stylesheet.** It defines `.cierre` as the
  round 36×36 panel-close button; `lineamientos.html` uses `.cierre` for its
  end-of-page block. The legacy satellite pages are standalone documents that
  never load the landing's stylesheet, so the collision is impossible there.
  Loading it from the root layout squashed that block from 88 px to 38 px.
  `globals.css` now imports from the landing page; each satellite carries its
  own sheet, `@font-face` and `body` rules included. Worth remembering in
  Stage 2 and beyond: **any new shared stylesheet risks the same class of
  bug**, because the legacy pages were never designed to coexist.
- **The satellite header is not fixed, and that is accidental.**
  `fondo-flujo.js:9-20` walks `document.body.children` and stamps inline
  `position:relative; z-index:1` on every sibling — including
  `header.marco`, whose CSS says `position:fixed`. So on satellite pages the
  header scrolls away. Almost certainly not intended by the author, but it is
  the live behaviour and it is in the baselines. Reproduced explicitly through
  an `EN_FLUJO` style constant rather than by mutating nodes React owns. If the
  committee ever wants the header to stick on those pages, that is a design
  change and needs saying out loud.
- **There is no `.grano` element.** `globals.css` defines the class
  (`index.html:75`) but the original markup never uses it. The plan said to add
  one; doing so would have introduced a film-grain overlay the site does not
  have.
- **Stubbing `requestAnimationFrame` breaks the port but not the legacy.** It
  was how the baseline capture stops `autoAng` accumulating. React 19 schedules
  rendering on rAF, so with it stubbed the canvas component never mounted and
  `__qa` never appeared — the parity run failed with a 180 s
  `waitForFunction` timeout, not a pixel diff. The port reaches the same frozen
  state through a new `__qa.reset()`.
- **`__qa.reset()` is deliberately not part of `runTo`.** The original *does*
  accumulate `autoAng` across successive `runTo` calls — each simulates three
  seconds — and that accumulation has to be reproduced. Resetting inside
  `runTo` made capture 1 match and every later one drift.
- **The language pill is injected at runtime**, along with its CSS
  (`idiomas.js:98-143`), so it is in the golden images and had to be
  reproduced even though i18n is Stage 2. Its stylesheet is separate so
  `globals.css` stays a literal copy.
- **Next 16 emits CSS to `/_next/static/chunks/*.css`**, not
  `/_next/static/css/`, and the minifier lowercases hex — grep compiled output
  case-insensitively.

## Deferred / follow-ups

- Baselines for the five non-Spanish locales are captured but not asserted
  until Stage 2, per the deviation documented in the plan.
- The satellite pages' `fondo-flujo` canvas is also randomised and animated;
  its captures pass at zero tolerance, apparently because the per-frame veil
  (`VELO = 0.002`) changes less than one quantization step. This is empirical,
  not reasoned — if those tests start flaking, seed and freeze them the same
  way as the landing.

## Open questions for review

- **The language pill is a working-looking control that does nothing.** It has
  to render to match pixels, and its `<select>` defines the pill's hit area and
  size, so removing it would change the geometry. Stage 2 wires it up. If that
  bothers you before then, the alternative is disabling the `<select>`, which
  costs nothing visually but changes the cursor.
- **The satellite header not sticking** (above) is preserved because it is
  current behaviour. Say the word if it should be fixed instead — it is a
  one-line change, but it is a design decision, not a port decision.
- **Stage 2 must re-run the visual suite for the other five locales.** The
  baselines exist; only the assertion is deferred. Do not regenerate them
  against the new app.
