# Emergence — contributor contract

Applies to human contributors and coding agents throughout this repository.

## Scope and source of truth

- Read `docs/ARCHITECTURE.md` and relevant research before proposing changes.
  Shared world rules stay in `docs/` (called `/documents` in the original brief).
  Life-model research lives in `src/simulation/life/v1/`, with later alternatives
  in sibling version folders. Read `src/simulation/life/README.md` and
  `CONTRACT.md` there for the common boundary. Preserve research content/history
  and `resources/` artwork when reorganizing documentation.
- Follow the user's current step and explicit instructions. `docs/prompts.md`
  contains future steps, not permission to implement them now.
- The current application includes the landing page, world setup, a Canvas atlas,
  deterministic physical generation, drainage, climate, and geographic regions.
  Do not add biological simulation, organisms, life seeding, or speculative
  engine APIs until a later task requests them.
- Geography supplies physical conditions; ecology emerges from life. Do not
  introduce predefined species, assigned ecological biomes, scripted evolution,
  or guaranteed outcomes.
- Research documents describe earlier proposals, not automatically accepted
  rewrite decisions. Ask when a consequential requirement is ambiguous; do not
  silently pick missing ecological rules or balancing coefficients.
- Keep every life-specific rule and approximation inside its `life/vN/` model:
  initialization, genes, organism behavior, movement, species classification,
  population calculations and representation. Models consume the same shared
  world, climate, calendar and speed meanings. Expose the common read-only life
  observations to UI/rendering; do not make those layers read model internals.
  `src/rendering/LIFE.md` is a provisional visual brief awaiting later instructions,
  not authorization to implement life rendering.
- Extend `docs/ARCHITECTURE.md` in **every later step** with decisions, reasons,
  boundaries, validation, and limitations. Preserve history; explicitly mark
  superseded decisions instead of silently rewriting them.

## Stack

- Browser-first, static deployment to `dist/`; no backend.
- Plain JavaScript ES modules and native HTML/CSS. No UI framework, TypeScript,
  type transpilation, or configuration for either.
- No application runtime package dependencies. Vite is the development server
  and static bundler; Playwright is the real-browser development check.
- Node 22.12+ is for tooling only. Keep dependencies and the npm lockfile aligned.
- Canvas 2D for the map; SVG for future illustrations and charts.

## Layer boundaries

| Layer | Owns | Must never do |
| --- | --- | --- |
| `src/simulation/` | Future headless deterministic engine and authoritative state | Import UI/rendering; access `window`, `document`, DOM, Canvas, storage, or other browser services |
| `src/rendering/` | Future presentation of read-only snapshots | Mutate snapshots/state, call engine commands, or import UI/engine implementations |
| `src/ui/` | Screens, input, browser adapters, explicit commands, theme settings | Reach into engine internals or directly mutate simulation state |

Dependency direction is **UI → simulation and renderer**, never the reverse.
The UI will pass snapshots and visual tokens to rendering and explicit commands
to the engine. Do not create cross-layer imports or shared mutable state to
shortcut this contract. A future worker/browser adapter belongs outside the
headless engine.

### Determinism

- Simulation must never call `Math.random()` or read wall-clock time, including
  `Date`, `Date.now()`, and `performance.now()`.
- Future randomness must use an explicit seeded PRNG with serializable state.
  A seed alone is insufficient to resume a run partway through its random stream.
- Simulated time is an explicit input/state value. Rendering cadence, camera,
  theme, processor speed, and browser timing must not change biological results.
- Reproducibility requires versions, inputs, command ordering, stable iteration
  and tie-breaking, and complete state. Do not claim cross-browser numerical
  equivalence without evidence. No PRNG or persistence format is selected yet.

## Visual contract and accessibility

- Use the original logos for identity and both mockups for visual language.
  `resources/logo-dark.webp` anchors the dark theme's green-black ground,
  lifted green panels, warm green-white text, fine lines, and lichen accent.
- Light is an aged biology book: paper, sepia/ink-brown, restrained botanical
  accents, serif headings, and engraved artwork. Both themes are first-class.
- **Every authored colour and the full type scale are CSS custom properties on
  `:root`, with theme definitions in `src/ui/styles/tokens.css`.** This includes
  borders, alpha colours, focus, selected states, gradients, and transparent
  stops. Do not put literal colours or font sizes in component styles or JS.
  Original raster artwork retains its embedded palette.
- Future Canvas/SVG drawing must consume computed theme tokens. Read browser
  styles in the UI/browser adapter and pass resolved values to rendering; never
  introduce a parallel palette or couple theme access to the simulation.
- Preserve System/Light/Dark choices, follow live system changes in System mode,
  and persist explicit choices when storage is available. Storage failure must
  not break the page. Keep the no-JavaScript system-theme fallback in sync.
- Use native semantic controls, visible keyboard focus, readable contrast,
  meaningful text alternatives, and layouts that work on phones and desktops.
  Do not add fake statistics or suggest that a disabled feature is operational.
- English and Polish are available on every screen, including during playback.
  Keep visible copy as complete translatable phrases, allow longer labels to
  wrap, and keep locale formatting in UI. Language changes update the document's
  `lang` and preserve the current world, clock, camera, and selection. Never
  translate engine IDs, commands, or saved state. Persist the language choice
  when storage is available; storage failure must not break either switcher.
- Credit Robert Chaba and preserve the supplied contact/repository links.
  BSD-3-Clause is the project licence. Preserve the full root `LICENSE` and its
  inclusion in static builds. Repository visibility is separate from licensing.
- Keep availability messaging off the landing page: show EN / PL and link the
  actual licence without release-status qualifiers.

## Before declaring work done

1. Check scope, dependency direction, and `git diff` for unintended changes.
2. Run `npm run build` and `npm test`. The latter builds and checks the production
   page in Chromium at desktop and phone widths; port 4173 must be available.
   Install Chromium with `npx playwright install chromium` on a fresh checkout.
3. For UI changes, inspect both themes at desktop and phone widths, including
   wrapping, overflow, focus, assets, and disabled controls. Confirm the dev
   server still loads the page when setup/build wiring changes.
4. Extend the decision record and update the README when usage changes. Add
   focused checks for new behavior without speculative test infrastructure.
5. Report what changed, checks run, and any actual limitations. Never claim
   unrun checks passed. Browser smoke checks do not validate future ecology.
