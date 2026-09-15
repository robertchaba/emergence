# Architecture and decision record

## Status

**Current: physical world atlas — 2026-09-15.** Decisions 010–013 implement the
requested interface, generator, seasonal climate, and geographic diagnostics.
Decision 014 adds a separate live world-building page and a UI seasonal preview
clock. Decision 015 simplifies the atlas and adds measured climate playback
controls. Decision 016 refines the controls, expands the notebook, and adds live
English/Polish localization. There are no organisms, biological rules, or biological
simulation loop.

**Historical foundation status, superseded by 010–012:**
**Foundation accepted for implementation — 2026-09-15.** This repository initially
contained one static landing page with theme controls. There was no engine,
generator, renderer, world setup screen, or working Start action.

Extend this document in every subsequent task. Add a dated entry recording the
decision, reason, affected boundaries, validation, and limitations. Keep prior
entries and mark superseded decisions explicitly.

## 001 — Scope and research authority

Emergence is an open-ended evolution sandbox: a player will generate physical
geography, seed life in one hex, and observe descendants shaped by resources,
inheritance, mutation, and seasons. Species and ecological patterns emerge;
they are not predefined outcomes or world-generation inputs.

The supplied notes are in `docs/`, not `/documents`:

- [Simulation summary v6](evolution_simulation_summary_v6.md): world, climate,
  habitats, movement, resources, and proposed daily phases.
- [Evolution mechanics v3](evolution_mechanics_summary_v3.md): inheritance,
  mutation, drift, and proposed species classification.
- [Starting genes v1](evolution_simulation_genes_v1.md): capabilities and trade-offs.
- [Approximation strategies v1](evolution_simulation_approximation_strategies_v1.md):
  fidelity, profiling, and eventual optimization recommendations.
- [Staged prompts](prompts.md): historical task sequence and visual direction.

These were read as research for the rewrite. Their numeric defaults, algorithms,
and future prompts do not expand this task's scope or settle later implementation
choices. The referenced readiness review is absent from this checkout. Reproduction,
feeding, generation, and simulation rules must be resolved in their own steps.

**Consequence:** preserve the notes; reserve the layers with rule documents only.
Do not add speculative state schemas, PRNGs, hex utilities, map placeholders,
simulation loops, or optimization scaffolding now.

## 002 — Browser-only delivery and tooling

Use native HTML/CSS and plain JavaScript ES modules. There is no backend, UI
framework, TypeScript, type-transpilation configuration, or application runtime
package dependency. Node 22.12+ is required only for local development and builds.

[Vite](https://vite.dev/guide/) provides development serving and a static `dist/`
build. Relative asset paths support deployment at either a site root or a
subdirectory. [Playwright](https://playwright.dev/docs/test-webserver) starts the
production preview for browser smoke checks. Both packages are development-only,
with exact direct versions and a committed lockfile. No external fonts, CDN scripts,
or remote services are needed by the built page.

Entry points:

```text
index.html → src/ui/main.js → src/ui/theme.js
           → src/ui/styles/tokens.css
           → src/ui/styles/landing.css
```

The landing content is native static HTML, so it remains readable without
JavaScript. The script only enables theme selection. Build output contains the
page, CSS, JavaScript, and referenced logos; research notes and mockups are not
application assets.

## 003 — Layer ownership and dependency direction

```text
                   UI / browser adapters
                   commands ↓      ↓ snapshots + visual tokens
                       simulation  rendering
                   snapshots ↑
```

**Imports point from UI to simulation and renderer, never back.** Rendering and
simulation do not import each other's implementation. UI coordinates the flow;
data returning to UI does not reverse dependency ownership.

| Directory | Contract | Present implementation |
| --- | --- | --- |
| `src/simulation/` | Own authoritative state; headless deterministic rules; explicit inputs and commands | Rule document only |
| `src/rendering/` | Consume read-only snapshots and presentation options; never mutate state or issue commands | Rule document only |
| `src/ui/` | Compose screens, translate input to explicit commands, own browser services and theme preference | Static page styles and theme controller |

Future Canvas 2D maps and SVG illustrations/charts belong in rendering. A
renderer may own presentation-only state such as a camera, but it cannot alter
simulation results. UI must not mutate engine internals. Snapshot schema,
immutability enforcement, command protocol, worker use, and storage format remain
open until actual requirements arrive. No abstractions for them exist yet.

## 004 — Determinism before the engine exists

The simulation layer must have no `window`, `document`, DOM, Canvas, storage,
browser services, or imports from UI/rendering. It must never use `Math.random()`
or wall-clock reads (`Date`, `Date.now()`, `performance.now()`).

Future random choices use an explicit seeded PRNG whose **current state is
serializable**. Simulated time is explicit state/input. Reproducibility depends
on engine/generator versions, settings, complete state, command ordering, and
stable tie-breaking, not just the original seed. No PRNG algorithm is chosen now.

Rendering frequency, camera movement, theme, or hardware speed must not affect
the biology. Future cosmetic randomness must be separate from biological random
state. Worker timing and browser persistence remain outside the headless engine.
Cross-browser bitwise floating-point identity requires separate evidence.

## 005 — Two complete visual themes

The original `resources/logo-light.webp` and `resources/logo-dark.webp` are used
unchanged. The supplied dark and light mockups (`mockup1.png`, `mockup2.png`) guide
the fine borders, notebook labels, framing, and quiet hierarchy. Their maps and
application controls are outside this step.

| Role | Light: biology book | Dark: laboratory |
| --- | --- | --- |
| Ground | Aged paper | Very dark desaturated green |
| Panels | Warm paper and parchment | Lifted green-grey surfaces |
| Text | Ink-brown, sepia secondary text | Warm green-white, sage secondary text |
| Accent | Restrained botanical olive | Pale lichen green from the logo's highlights |
| Type | System serif headings and body | System sans-serif headings and body |
| Labels/readouts | Monospace, tabular figures | Monospace, tabular figures |
| Detail | Engraved logo, inset hairline frame | Luminous logo, precise fine rules |

All authored colours, alpha colours, transparent gradient stops, and the type
scale live as CSS custom properties on `:root` in `src/ui/styles/tokens.css`.
Theme definitions resolve those values; components consume semantic roles such
as `--color-ground`, `--color-accent`, and `--text-body`. Raster artwork naturally
retains its own pixels. Dark secondary text is slightly lighter than the brief's
initial sage to keep small labels readable.

Future Canvas/SVG renderers receive **computed token values**, read by the
UI/browser adapter and refreshed on a theme change. They must not hardcode
colours or build another palette. The engine never reads CSS.

The native radio group offers System, Light, and Dark with standard keyboard
behavior. Without a saved choice, the page follows `prefers-color-scheme` and
responds to live changes. Explicit light/dark choices use local storage key
`emergence.theme`; selecting System removes it. Invalid saved values fall back
to System. Storage errors leave theme selection usable for the current visit.
CSS follows the system before initialization and without JavaScript; the
switcher stays hidden until its controller is ready.

This is a responsive single page with a disabled Start button and a visible
availability note. The emblem is branding, not a preview of simulated life.

## 006 — Verification contract

`npm test` builds the production page, starts a fresh Vite preview on port 4173,
and uses Chromium at desktop (1440 × 1000) and phone (390 × 844) sizes. The
smoke suite covers content/assets, both themes, system changes, explicit-choice
persistence, reset to System, unavailable storage, and responsive bounds. It
also checks keyboard selection and the CSS fallback without JavaScript.

Before completing any later step: run `npm run build` and `npm test`, inspect
changed UI in both themes and sizes, review the diff and layer boundaries, and
extend this decision record. Check the development loop when its wiring changes.

**Limits:** Chromium smoke tests are not an exhaustive browser/device matrix,
automated accessibility audit, or simulation validation. Headless rule tests,
deterministic replay fixtures, profiling, and scientific calibration belong to
the steps that implement those behaviors.

### Foundation verification — 2026-09-15

- `npm run build` passed; `dist/` contains only static application assets.
- `npm test` passed all 10 Chromium checks across the two viewport projects.
- The development page loaded at port 5173; both themes were visually inspected
  in desktop and phone screenshots.
- `npm ls --omit=dev` reported no runtime dependencies; `git diff --check` passed.
- Verification ran with Node 26.8.1. The declared tooling minimum is Node 22.12.

## 007 — Landing identity, texture, and release information — 2026-09-15

**Supersedes the landing logo framing in 005.** The rectangular specimen panel
and plate labels suggested an in-game inspector. The landing logo now sits
freely over two faint circular outlines. The appendage can extend beyond the
circles; the artwork is neither cropped nor redrawn. The original logos continue
to define both themes. Caption styling remains quiet and editorial.

The repeated wordmark and unrelated asterisk have been removed from the top.
Only theme preferences and the language placeholder occupy the utility row.
The large project title and emblem provide the page's identity.

Light mode gains a very faint paper grain, fibre pattern, and aged edge wash.
Dark mode uses lower-contrast grain and a soft green halo behind the logo. CSS
gradients and pseudo-elements supply these static decorations without asset
requests, animation, or dependencies. Decorative lines do not intercept input.
Their colours, alpha values, halo, and logo shadows use theme tokens, including
the no-JavaScript fallback. Small diamond terminals finish the section rule.

The footer credits Robert Chaba, links `robert.chaba@gmail.com` using `mailto:`,
and links the supplied GitHub repository. It states that the repository is
private and a public BSD release is planned, rather than implying it is already
available. No repository visibility change or release is part of this task.

**Licensing recommendation:** BSD-3-Clause, because it combines permissive reuse
with an explicit non-endorsement condition for the author and contributors.
BSD-2-Clause and MIT are simpler permissive alternatives. The choice remains
pending; no operative licence file or SPDX package licence has been added.
The README links the canonical licence texts. On release, confirm the BSD
variant, add its full text with the author's copyright, and update the footer
and package metadata together.

## 008 — Language placeholder and future Polish locale — 2026-09-15

English remains the only available locale and `html[lang]` stays `en`. The
preferences row displays the current EN language and a disabled PL button,
with a visible availability note and an accessible language group. It does not
change locale or save a nonfunctional preference.

Polish localization is a later step. Keep phrases complete and allow text to
grow and wrap. That step should introduce the actual message catalogue, update
document/control language metadata, and use locale-aware formatting in UI.
Stable engine IDs, commands, and serialized state must remain locale-independent.
No translation framework, dictionary, or speculative locale controller is needed
for this placeholder.

Validation: `npm run build` and all 10 Playwright checks passed. The loading check
now also covers the disabled language placeholder and footer link destinations.
Both themes were reviewed in screenshots at 1440px and phone widths, including
320px; layout checks found no horizontal overflow. `git diff --check` passed.

## 009 — Readability, microscope light, and BSD licence — 2026-09-15

**Supersedes the availability wording and deferred licence decision in 007–008,
and the Start availability note in 005.** The user's follow-up requests a BSD
licence now. The project adopts the recommended BSD-3-Clause licence with
copyright © 2026 Robert Chaba, using the
[canonical text](https://spdx.org/licenses/BSD-3-Clause.html).

The root `LICENSE` is authoritative, package metadata declares `BSD-3-Clause`,
and a small Vite build hook emits the same text as `dist/LICENSE`. The footer
uses a relative link that works in development and static deployments, including
subdirectories. This keeps the licence available with the distributed page
without duplicating a maintained source file. Repository visibility is unchanged.

The language control is simply EN / PL with PL disabled. Availability notes,
release-status qualifiers, and the Start note are removed from the landing page.
The Start control is still disabled; this remains the static foundation.

The full type scale remains theme-token driven. Labels rise from 11px to 14px;
captions and footer text from 13px to 16px; body text to 18px, with introductory
copy at 20px in light mode and 19px in dark mode. Smaller headings also increase.
The main title and subtitle retain their existing sizes. Tracking is slightly
tighter on the enlarged monospace labels so they wrap comfortably on phones.

The dark logo circle has a brighter, soft green centre and a lightly illuminated
edge, suggesting a microscope's field of light. Both colours are theme tokens;
the no-JavaScript dark fallback uses the same values. Light mode retains its
existing paper-toned halo.

Validation: `npm run build` and all 10 Playwright checks passed. The smoke test
follows the footer licence URL and compares the served text with the complete
root `LICENSE`. The development licence URL also returned the correct file.
Both themes were checked at 1440px, 390px, and 320px with no horizontal overflow;
screenshots confirmed the type hierarchy and illumination. `git diff --check`
passed.

## 010 — World setup and interactive atlas — 2026-09-15

**Supersedes the foundation-only implementation restrictions in 001–005 and the
disabled Start behavior in 009.** The current request explicitly includes the
interface skeleton and prompts 3 and 4. The final interface therefore uses real
generated snapshots instead of retaining the intermediate placeholder grid.
The original landing, artwork, theme behavior, contact links, and licence remain.

World setup is a section of the normal page. Seed, size, geography, and land
fraction are native form controls. A default world is generated on load; changing
settings marks the preview stale and disables Start until Generate succeeds.
Input values are read together and passed directly to `generateWorld`. Generation
failure is visible and leaves Start disabled. The preview explicitly distinguishes
the non-marine land budget from remaining dry land after lakes fill.

Start opens a full-viewport workspace. The map and notebook sit side by side on
desktop; the notebook scrolls below the map on phones. Its day controls follow
the Hex inspector visually on phones so a newly pinned hex is immediately visible.
The application menu provides Fit world and Return to World setup. Returning
restores the previous page scroll and focuses Start. The same native theme radio
group moves between screens, preserving one preference/controller and System's
live behavior. The disabled PL placeholder remains on the landing page.

Map input belongs to `src/ui/world-ui.js`: wheel and two-pointer pinch zoom around
the pointer/centroid, drag pans, and a click pins. Zoom is 1–32 times the fitted
world. Focused-map arrows inspect adjacent cells (east/west wraps, poles clamp),
`+` / `−` zoom, and Escape clears. Keyboard inspection pans a hidden cell back
into view. The Hex tab uses native focus with arrow, Home, and End navigation;
its facts are semantic text and definition lists. A short live status announces
the pin without reading the entire notebook on each interaction.

### Layer boundaries and palette

```text
index.html → ui/main.js → theme.js
                       → world-ui.js → simulation/world.js, climate.js
                                     → rendering/map.js
```

The UI owns events, `ResizeObserver`, animation-frame scheduling, browser styles,
and number formatting. It calls generation/day commands and replaces its snapshot
reference; it never edits hex state. Renderer methods receive a read-only world,
resolved `--map-*` tokens, a camera, layer, and selection. Renderer-local geometry
supports fitting, picking, and cell centers, avoiding an engine dependency.
Drawings cache colors by snapshot identity and clear those caches on token changes.

All map palette values, including region colors, ice/frost, selection outlines,
and pass markings, live on `:root` in `tokens.css`. Explicit dark and no-JavaScript
dark fallback definitions match. Canvas interpolates supplied colors and performs
relief shading; it never reads CSS or invents a separate palette. Temperature
interpolates hue from token-derived cold blue to warm red; humidity interpolates
dry ochre to wet green. Terrain includes depth-graded sea, distinct lakes, shaded
elevation, flow-width river segments, and spring markers. Connections unwrap to
the closest longitude and draw at both clipped map edges when crossing the seam.

**Limits:** Canvas has a semantic inspector and keyboard input, but this is not
an exhaustive accessibility audit. Only Chromium is in the browser matrix.
The camera is presentation state; no map input advances biological time. The
workspace is viewport-filling without invoking the browser Fullscreen API.

## 011 — Deterministic geography and established flow — 2026-09-15

`generateWorld({ seed, size, geography, landFraction })` is the first implemented
headless API. It returns ordinary serializable data, with no browser services,
wall-clock reads, mutable shared random stream, or imports from UI/rendering.
The dimensions are small 24 × 16, default medium 60 × 40, and maximum large
120 × 80. Stable row-major IDs and sorted reciprocal neighbors represent an odd-row
cylinder: six neighbors inside, four at either polar boundary.

### Elevation and repeatability

The generator version is `physical-world-1`. Seeded integer coordinate hashing
feeds five octaves of smoothly interpolated value noise, periodic in longitude.
At every octave, geography blends the adjacent integer frequencies around
`(4 + 6 × geography) × 2^octave`. Weights fall by 0.36 per octave; detail beyond
the small map's useful resolution is attenuated. A sixth-power latitude taper
lowers the poles. This is deterministic synthetic geography, not a tectonic model.

Every top and bottom row is excluded before allocating the whole-grid land budget.
The highest `round(hexCount × landFraction)` eligible elevations become land,
with cell ID resolving ties. Sea beds are strictly negative, including inland
below-sea-level pockets; sea surface is zero. The synthetic vertical scale is
approximately −6,000 to +5,000 metres. The target fraction defaults to 0.38 and is
validated within 0.35–0.40. `nonMarineLandFraction` counts the selected footprint;
`dryLandFraction` excludes freshwater lakes.

A bounded sequence of at most 12 deterministic candidates checks for coherent
land (largest component at least 12% of non-marine cells and at least six cells),
a spring-fed river, multiple non-hard regions with at least three cells, and a
real costly pass. Exhaustion throws a visible error rather than weakening the
criteria. The snapshot records the normalized seed, settings, version, selected
candidate, and integer hash inputs in `randomState`. Hashing is stateless, so
there is no unfinished random stream to resume. This does **not** choose the
future biological PRNG or promise cross-browser floating-point identity.

### Drainage and basins

A stable priority flood starts from all sea hexes. Surface elevation and then
cell ID order the heap. Each dry cell gets a spill/routing elevation and a
downstream neighbor leading to an earlier-settled outlet. Depressions group at
their connected spill level, including side pockets linked through zero-depth
saddles. Such saddles remain dry land. The basin routes toward one deterministic
overflow; equal-height routing never depends on iteration accidents.

Basins at most five metres deep are sediment-filled in their entirety. About
2.5% of exposed eligible land above 300 m receives seeded springs (at least one
when eligible land exists), each discharging one reference flow unit. Topological
accumulation sums tributaries, detects cycles, and carries water through basin
outlets to sea. A basin becomes a lake only when positive flow enters it; every
submerged pocket fills to its spill level. Nested basins can overflow into one
another; flow entering a lower basin does not backfill an unfed upper basin.

Each hex separates bed elevation, actual water level, spill elevation, downstream
ID, spring discharge, accumulated runoff, lake inflow, basin ID, and shortest
hex distance to water. Sea and lake water surfaces are distinct from beds; river
land uses its bed as a reference water level because cross-sections are not
modeled. Any dry-land hex with positive runoff is a channel. Multi-source distance
search includes sea, lakes, and channels, using the same wrapped adjacency.

**Limits:** This is an established-flow approximation computed once at generation.
There is no erosion, evaporation, infiltration, rainfall-driven discharge,
progressive filling, or seasonal rerouting. Coherence and candidate checks are
engineering acceptance criteria, not calibrated geological statistics. Generation
runs synchronously after yielding a browser frame for its busy state; no worker
or long-term persistence interface is introduced.

## 012 — Seasons and diagnostic geographic barriers — 2026-09-15

The current task leaves climate coefficients and barrier thresholds open. The
research's section 4 provides a concrete starting climate model, adopted here as
**provisional geography defaults**. No ecological coefficients, species labels,
organism movement rules, or survival decisions are introduced.

`setDay(world, day)` requires a non-negative safe integer, recursively copies the
entire snapshot, and returns new climate readings. A year is 360 days and day zero
is northern spring equinox. With latitude `L = 90 − 180 × row / (height − 1)`:

```text
seasonalSignal = (L / 90) × sin(2π × (day % 360) / 360)
meanTemperature = 28 − 60 × (abs(L) / 90)^2 − 0.0065 × max(0, surfaceHeight)
temperature = clamp(meanTemperature + amplitude × seasonalSignal, −40, 40)
amplitude = 4 on sea/lake; 12 on land
humidity = clamp(exp(−distanceToWater / (width / 20))
                 − max(0, bedElevation) / 10000
                 − 0.01 × max(0, temperature − 20)
                 − 0.10 × seasonalSignal, 0, 1)
```

Surface height uses water level for sea/lake and bed elevation for land. Humidity
is a moisture index only on land, and null on sea/lake. River land retains its
land climate. Seasonal ice and frost derive from negative temperature in the
renderer; hydrology remains fixed. Annual maximum temperature defines permanent
ice, and annual minimum humidity is derived analytically at the warmest seasonal
signal. These annual values make geographic regions independent of the viewed day.

### Initial diagnostic thresholds

| Physical condition | Provisional reference treatment |
| --- | --- |
| Annual maximum temperature below 0 °C | Permanent ice, difficulty 1 |
| Land at or above 3,500 m | High ridge, difficulty 1 |
| Sea depth at least 2,000 m and at least `max(2, round(width / 30))` hexes from dry land | Wide deep ocean, difficulty 1 |
| Ground/shore elevation step at least 1,000 m | Blocked reference connection |
| Narrow land or water neck | Difficulty at least 0.65 |
| Elevated, seasonally dry, cold, river-bearing land | Continuous difficulty derived from those fields |

Soft land difficulty takes the maximum of elevation / 3500, river flow
(`min(0.5, 0.1 × log2(1 + runoff))`), dryness
(`0.75 × clamp((0.35 − annualMinimumHumidity) / 0.35)`), cold
(`0.75 × clamp((8 − meanTemperature) / 40)`), and a narrow-link cost. Values clamp
to 0–1. Water starts at `0.2 + depth / 10000`, capped at 0.55 unless narrow or
hard. A narrow link has two or three neighbors of the same surface type which
are disconnected around its immediate ring. The easy/harsh split is 0.55.

Regions flood connected cells of the same physical class, respecting cliffs and
the cylindrical seam. Every hex exposes difficulty, physical reasons, and a
region ID. IDs follow deterministic cell order, never random colors or rectangles.
The graph records the least-cost actual boundary edge between each region pair,
with stable endpoint tie-breaking. `regionConnections` retains blocked edges;
`passes` contains crossable diagnostic connections. Region view colors the zones,
uses a neutral token for hard barriers, and marks passes. Tiny isolated cliff
zones remain visible; the generation quality gate counts larger meaningful zones
separately rather than pretending all colored fragments are major regions.

**Limits:** Geographic difficulty is a reference diagnostic, not universal
organism passability. A region boundary itself is never a prohibition, a habitat
label, or a mechanism for creating species. These thresholds and local bottleneck
heuristics need later balancing against actual movement capabilities. Season
controls inspect climate only; there is no organism simulation or run/pause loop.

## 013 — Validation for the physical atlas — 2026-09-15

`npm test` now runs Node's built-in test runner before building and launching
the production page for Playwright. Browser tests explicitly match `*.spec.js`
so headless tests do not run inside Playwright. No dependency was added; package
versions and the lockfile remain aligned.

The headless suite covers all three sizes, both geography endpoints and midpoint,
land budgets, reserved poles, serializable deterministic snapshots, periodic
noise and continuity, reciprocal seam adjacency, water distance, acyclic monotone
sea drainage, conserved spring flow, basin side pockets, dry saddles, whole-basin
sedimentation, unfed depressions, and multi-level overflow. Tiny-world seeds are
checked explicitly for coherent land, rivers, and useful regions. Climate checks
cover hemispheric symmetry, lapse rate, water amplitude, humidity bounds, complete
snapshot-copy purity, annual barriers, connected regions, and stable real passes.
Renderer checks cover picking after camera changes, both seam halves, frozen
snapshot drawing, short seam connections, and complete theme tokens.

Playwright extends the landing checks with real setup inputs and generation,
screen navigation/focus restoration, wheel zoom, drag, click pin, keyboard seam
and pole inspection, 32× bounds, Fit world, notebook keys, every map layer,
season changes, theme/layout bounds, and a Chromium touch pinch on the phone
project. Screenshots support inspection of light/dark desktop and phone layouts,
including 320px.

### Executed verification

- `npm run build` passed; the static output includes the full BSD licence.
- `npm test` passed 22 Node headless/renderer tests and 21 Chromium tests.
  The phone touch-pinch check passed; its desktop duplicate is intentionally
  skipped because the desktop project has no touch input.
- Both themes were visually inspected for setup, workspace, pinned inspector,
  phone scrolling, and keyboard focus. Responsive checks include 1440px, 390px,
  and 320px widths. Temperature and region debug layers were also reviewed.
- The Vite development page loaded and generated worlds successfully. No runtime
  dependencies were introduced; `npm ls --omit=dev` is empty, and dependency
  versions match the npm lockfile. Headless source scans found no forbidden
  browser imports, unseeded randomness, or wall-clock access.
- Independent review compared 500 generated test terrains with a separate
  minimum-spill calculation and sampled 300 tiny worlds for coherence, rivers,
  and meaningful regional separation. These ad-hoc checks passed; fixed
  regressions for discovered saddle and nested-lake cases remain in the suite.
- `git diff --check` passed. Original research notes, artwork, and licence text
  remain unchanged. No biological model was implemented or validated.

**Limits:** Browser and headless checks validate these physical-model invariants,
not future ecology, geological realism, calibrated climate, or other browser
engines. No cross-browser numerical equivalence is claimed.


## 014 — Live world-building page and theme detail — 2026-09-15

**Supersedes setup navigation and manual regeneration in 010, fixed spring
abundance in 011, and manual-only preview seasons in 012.** The landing now links
to `world.html`, a second native HTML entry emitted by Vite. Setup is a separate
page with its own title, heading, and home link, so Create a world navigates
normally and works on static hosts and subdirectory deployments. Workspace
controls remain on that page. Theme initialization is shared; world UI initializes
only where its form exists. The landing no longer generates an unused world.

Every setup entry chooses a new seed using browser `crypto.getRandomValues`,
including page restoration and returning from the atlas. The adjacent Randomize
button uses the same path. The browser supplies this seed as an explicit engine
input; headless generation remains deterministic. Other settings are retained
when returning from the atlas, and focus moves to the seed field.

Inputs regenerate automatically after a 180 ms debounce. A request revision
invalidates older work before synchronous generation. Start is disabled for
pending, invalid, or failed settings, and the last valid preview pauses while
input is incomplete. A failed generation clears the preview and reports the
error; there is no Generate button. Generation remains synchronous after a paint
yield, so very large worlds can briefly block input.

### Water abundance

Generator version is now `physical-world-2`. The serializable `waterAbundance`
setting ranges from 0 to 1, default 0.5. It maps to the fraction of eligible
spring sites: 0.5% at zero, the previous 2.5% at midpoint, and 10% at maximum,
linearly interpolated on each half. At least one eligible source remains. These
are provisional physical preview controls, not ecological balancing rules.
Sources use the existing stable seeded order, so more abundance adds sources
on a fixed candidate terrain. Conserved spring flow still determines channels
and fills only fed basins; lake count/area is not prescribed. The same quality
gates apply, so a changed setting can select a different candidate. Monotonic
lake counts across different candidates are not promised. UI reports actual
lake and river hex counts alongside the land budget and dry land.

### Seasonal presentation

The setup preview starts running at 20×: 20 explicit days per second, approximately
18 seconds per 360-day year. A browser animation clock batches climate updates
roughly every 200 ms through `setDay`, replacing read-only snapshots. The renderer
continues to receive snapshots and computed tokens. The headless layer neither
reads time nor owns a loop. This is climate preview only; no biological turns
are skipped or invented. Geography, drainage and regions stay fixed during it.

Pause/Resume is a native button with pressed state. Hidden tabs and the atlas
stop the preview clock without background catch-up. Long foreground frame gaps
are capped at 250 ms to avoid large jumps; slow devices may play more slowly.
A new world starts at day zero. Start opens the atlas at the preview's current
day, where the existing manual day controls apply. Season text is visible but
is not a constantly announcing live region.

### Visual boundaries

Light mode gains inset engraved button rules, shaped button corners, double
frames, and rounded inner panel detail derived from the book mockup. Dark mode
uses simple single rules and hides ornamental terminals, including the landing
divider diamonds. Decoration uses theme tokens, including the no-JavaScript
system fallback. Original artwork, full licence, credits, and disabled PL control
are preserved. No dependencies, backend, or renderer palette were added.

### Executed validation

- `npm run build` passed and emitted both HTML entries and the full licence.
- `npm test` passed 23 headless/renderer tests and 29 Chromium tests. The desktop
  duplicate of the phone touch-pinch test is intentionally skipped.
- New checks cover separate-page navigation, seed randomization on entry and
  return, live updates with rapid input, invalid seed handling, water abundance
  and conserved drainage, preview playback rate, pause/resume, and the stopped
  preview clock while inspecting the atlas.
- Landing, setup, and workspace were visually reviewed in light and dark at
  desktop and phone widths. Responsive checks include 320px; keyboard focus,
  wrapping, original artwork, and disabled language controls remain usable.
- The development server loaded both pages and generated worlds at desktop and
  phone widths without browser errors; the largest world's preview advanced.
  Dark landing divider terminals were confirmed absent in computed styles.
- `git diff --check` passed. Simulation source scans found no browser access,
  wall-clock reads, or unseeded randomness; runtime dependencies remain empty.

The limitations in 013 continue to apply: these checks establish physical and
interface behavior, not ecological validity or cross-browser numerical equivalence.


## 015 — Open atlas, notebook, and playback controls — 2026-09-15

**Supersedes the framed map, layer toolbar, notebook tab,
manual day entry, and menu-based Fit action in 010; the preview playback controls
and extra inset frame in 014; and the older 20× speed label.** The user's follow-up
asks for a larger map and a quiet inspection workspace. The setup preview retains
one theme-defined outer border (double in light, single in dark); its extra inset
ornament, season text, and Pause preview button are removed. The preview continues
to advance automatically at 20 days/s. The landing utility row and hero start
closer to the top. World setup uses the same square rule terminals as the landing,
with both hidden in dark mode and in its no-JavaScript fallback.

### Layout and controls

The original theme-appropriate logo, Emergence, and Field atlas form one native
`details` menu trigger. Layer radio controls and their legend move into that menu,
alongside navigation and map input help. Moisture is the visible label for the
existing `humidity` layer ID. The map has no layer toolbar or visible status
caption. A visually hidden live region still announces deliberate pin changes;
playback does not repeatedly announce the inspector.

The notebook stays on the right, following the user’s correction, and is
360–420 px wide at desktop sizes, with a smaller
13 px token-defined facts scale. It contains only the notebook heading and hex
inspection. Facts are Terrain, Elevation, Temperature, and Moisture. Elevation
means ground/seabed height (`bedElevation`); spill height is a routing diagnostic
and remains in the physical snapshot. No geography fields or calculation rules
were removed. Sea/lake moisture is described as not applicable, never a fabricated
percentage. Phones put the notebook below the map and wrap the bottom controls
into two rows; short screens retain notebook scrolling.

The bottom bar has day on the left, Play/Pause and speed in the center, and zoom,
Center, and Fit on the right. This resolves the request's two different day
positions in favor of its explicit day-left / zoom-right arrangement. Center
resets pan without changing zoom. Fit resets to the largest centered scale that
contains the complete world in the current map viewport. Native range/radio/button
controls retain keyboard focus and accessible labels. Day and speed readouts do
not continuously announce themselves.

### Whole hexes and fitting

Renderer bounds include the extra half-column of staggered odd rows. Every hex
is drawn once, whole, without a duplicate seam half or rectangular stroke. Picking
rejects empty notches beyond the first/last column. East/west engine adjacency and
keyboard wrapping are unchanged. A clip path combines the interior rectangle and
perimeter hexes to constrain rivers and region marks to the actual jagged outline;
its construction is linear in width + height. Wrapped connections still take the
short route and continue at the opposite edge. Springs and selection outlines
are drawn once. A fitted view leaves at most 12 px on its limiting dimension.
The canvas background resolves the same ground token as the surrounding surface.
Intentional zooming/panning can still move cells partly beyond the viewport.

### Browser pacing and measurement

The atlas opens paused at the preview's current day. Play advances the existing
climate API through explicit integer days. The speed slider is 1–10×, where 1×
is 2 days/s and 10× is 20 days/s. This normalization replaces the previous preview's
20× wording. The preview itself keeps its existing 20 days/s rate.

The UI accumulates fractional days from animation-frame elapsed time and calls
`setDay` for completed days. Actual speed counts advanced days divided by elapsed
foreground time over approximately one-second windows, then reports days/s and
its corresponding multiplier. It is not copied from the target. Frame gaps count
in the measurement denominator, but at most 250 ms per frame supplies day credit,
so a stalled browser reports slower throughput and avoids a large catch-up jump.
Pause, speed changes, generation, screen transitions, and visibility changes reset
clock credit and measurement; hidden tabs never accumulate background work.

This remains a browser climate presentation clock. It introduces no biological
loop or engine API, and does not select any future biological turn batching rule.
The engine receives integer days, never browser time. UI replaces its snapshot
reference; rendering reads the snapshot and theme values without mutating either.
No dependencies or persistence formats were added.

### Validation and limitations

- `npm run build` passed and emitted both static HTML pages and the full licence.
- `npm test` passed 24 headless/renderer checks and 29 Chromium checks; the desktop
  duplicate of the phone touch-pinch check remains intentionally skipped.
- Focused checks cover full edge hexes and picking, viewport-maximizing fit,
  centering without changing zoom, menu keyboard access and all layers, the four
  notebook facts, 1×/10× pacing, measured throughput after a stalled frame,
  pause/resume, and hidden-tab suspension without catch-up. Playback timing tests
  freeze automatic clock ticking during measurements so locator actions cannot
  add unintended simulated time.
- Visually inspected landing, setup, atlas, and menu in both themes at desktop
  and phone widths. Final atlas checks include a right-side notebook, readable
  facts, wrapping, visible focus, original logos, disabled controls, and no
  horizontal overflow at 1440px, 390px, and 320px widths.
- The development server served both pages without browser errors. A large
  9,600-hex world advanced 48 days in a roughly 2.5-second foreground observation
  at a 20 days/s target; the measured readout reached 20 days/s. This is a local
  smoke observation, not a device-independent performance guarantee.
- `git diff --check` passed. No runtime dependencies were added. The simulation
  source remains free of browser access, unseeded randomness, and wall-clock
  reads. Pre-existing work in the checkout and original research/artwork were
  preserved.

Chromium layout and clock checks cover this physical atlas, not ecological rules
or calibrated climate. The target is a pacing request; actual throughput depends
on workload and device. Other browser engines have not been tested.


## 016 — Compact controls, full-height notebook, and live localization — 2026-09-15

**Supersedes the disabled Polish placeholder in 008–010 and 014, the theme
control presentation in 005, dark divider omissions in 014–015, and the notebook
and playback bar layout in 015.** The user's current request explicitly enables
Polish and language changes during atlas playback. The contributor contract now
reflects that supported behavior; the original decision history remains intact.

### Presentation

A single borderless theme icon opens a native `details` menu with labelled
System / Light / Dark radios. The trigger shows the selected preference (monitor, sun, or moon),
with a translated accessible name and tooltip. Keyboard arrows select a radio;
Escape returns focus to the trigger. Outside clicks and leaving the menu close it.
Existing theme persistence, live system updates, and CSS-only fallback continue.
Icons are inline SVG using the current token-derived text colour.

The original atlas emblem grows from 48 to 64 px on desktop and from 36 to 52 px
on phones, extending inside its existing vertical allocation. The top bar keeps
its previous height, and the gap between Emergence and Field atlas decreases by
3 px. Smaller phone tracking allows the Polish subtitle to fit at 320 px.

On desktop, the notebook occupies its own grid column from the very top to the
very bottom of the window. There is no application top bar above it or control
bar below it. Its heading belongs to the notebook content. Map controls occupy
only the left column. Phones retain a notebook below the map with independent
scrolling, and use two rows for bottom controls.

The bottom bar uses a quiet grouped Play/Pause control, consistent line icons,
soft selected states, and labelled Center/Fit actions. Target and actual speed
occupy adjacent columns with the same baseline, retaining both multipliers and
days/s. The slider is 88 px rather than 260 px. Narrow screens place it beneath
the readings; both columns stay alongside each other when text wraps. Actual
speed remains measured from advanced days and elapsed foreground time.

The day readout uses the normal theme body font, with a small Running / Paused
label above it that follows playback and locale changes. Light-theme menus and
the map/notebook divider use double borders; dark keeps single rules.
Light-theme button inset lines use low-opacity dedicated tokens. Small 5 px
rule terminals appear in both themes, with separate subtle light/dark colour
tokens. The authored palette and complete type scale remain in `tokens.css`;
explicit dark values and the no-JavaScript fallback match.

Frost uses a near-white token and an 86% overlay applied after terrain relief.
This prevents terrain shadow from masking freezing while preserving a little
underlying relief. Water ice retains its blue tint. The threshold remains below
0 °C; no climate, hydrology, regional, or ecological rule changes. Diagnostic
layers keep their existing physical colour meanings.

### Language and boundaries

`src/ui/messages.js` owns complete English and Polish phrases. `locale.js` applies
static text and accessible attributes, updates `html[lang]`, and owns locale-aware
number formatting. Dynamic notebook, generation, map legend, day, and speed
readouts re-render on a UI language-change event. The existing theme and language
controls move together between setup and atlas.

Locale changes neither generate a world nor reset the clock, camera, layer,
selection, or measured speed. They never translate engine IDs, commands, seeds,
or snapshots. The simulation and rendering layers have no locale dependency.
Explicit choices use `emergence.locale` when storage is available; blocked storage
still allows switching for the current visit. The initial language is English
unless Polish was saved. Without JavaScript the readable static English page and
system theme remain, and language buttons are disabled. No runtime dependencies
or persistence format for simulation state were introduced.

### Executed validation and limitations

- `npm run build` passed and emitted both static pages plus the full licence.
- `npm test` passed 25 headless/renderer checks and 37 Chromium checks. The
  desktop duplicate of the phone touch-pinch check remains intentionally skipped.
- New checks cover language persistence, blocked storage, translated accessible
  controls, decimal formatting, in-place language changes during playback without
  clock/selection/camera/layer resets, and translated Running / Paused status.
- Layout checks cover both themes and locales at 1440, 1024, 800, 390, and 320 px,
  including adjacent speed values and the full-height desktop notebook. The
  menu keyboard and no-JavaScript system-theme checks continue to pass.
- Inspected landing, setup, atlas, and menus in both themes at desktop and phone
  widths. Verified double light-theme menu/divider rules, a borderless theme
  trigger with keyboard focus retained, body-font day counts, whiter frost,
  readable text, wrapping, and visible disabled zoom controls. Frost rendering
  tests cover both palettes and unchanged elevation diagnostics.
- The development server served both pages and generated worlds without browser
  errors. `git diff --check` passed; runtime dependencies remain empty. Original
  artwork, research, licence text, and pre-existing checkout work were preserved.

These checks cover Chromium UI behavior and physical-atlas invariants. Other
browser engines and future biological simulation have not been validated.
Localization requires JavaScript; browser storage remains optional.

## 017 — Landing spacing and centered playback controls — 2026-09-15

**Supersedes the setup's upper decorative rule and the adjacent speed readouts,
soft dark playback selection, and emblem sizes in 016.** The landing preferences
row is shorter and the hero's extra top padding is removed, lifting the main
copy by 28 px on desktop and 36 px on phones. World setup loses the first rule
below preferences, including its diamond endpoints.

The playback group sits at the center of the map footer between day and zoom.
Target and Actual occupy aligned rows, with Actual below Target; label widths
accommodate both locales. The zoom divider and phone playback separator are
removed. At widths below 1440 px, playback occupies a centered second row
so the longer Polish zoom labels have room. Phones keep the slider below the
readouts and allow the values to wrap.

Dark mode uses a bright green fill and dark icon for the active Play or Pause
button, including while hovered. Dedicated tokens preserve the light theme's
subtle selection and match the system-dark fallback. The original atlas logo
is now 72 px on desktop and 60 px on phones, centered within its existing layout
box; the header's height and brand spacing are unchanged.

These are presentation changes only. The engine, pacing behavior, measured
speed, original artwork, and locale state remain unchanged. No new
runtime dependencies or usage steps are introduced.

Existing layout expectations now check stacked speeds, centered
playback, separation from zoom controls, and the absence of the setup rule.
The preview pacing test freezes automatic wall-clock advancement before sampling,
matching its existing atlas-clock check, to avoid locator timing adding extra days.


The follow-up request unifies the light atlas with the other pages' warm paper.
Page gradients and grain now share root tokens. The light workspace uses those
same layers, with transparent toolbar and notebook surfaces revealing the paper.
Dark retains its solid green ground and lifted panels, including its CSS fallback.
The light Canvas ground is transparent, allowing paper to show outside the map;
the renderer clears each frame before painting to prevent trails when panning or
zooming. Hex colours remain opaque and keep their existing diagnostic meanings.
The same transparent ground also reveals the setup preview's paper panel.


Speed outputs reserve 18 monospace character widths, including decimal measured
rates, and shrink only with the viewport. Changing from 9× to 10× therefore does
not move the playback group or slider. The existing layout check now compares
the slider rectangle before and after that transition in both themes and locales.
The Paused / Running label uses the light theme's body serif; dark retains its
monospace status label through a theme token.

### Executed validation and limitations

- `npm run build` passed; `npm test` passed 25 headless/renderer and 37 Chromium
  checks, with the existing desktop duplicate of the touch-pinch check skipped.
- Layout checks cover both themes and languages at 1440, 1401, 1281, 1024, 800,
  390, and 320 px, including a stationary slider during the 9× → 10× transition.
- Visually inspected landing, setup, and atlas in both themes on desktop and
  phones, including wrapping, focus, logo assets, and disabled zoom controls.
- Browser measurements confirm the larger logo preserves the header height,
  active Play/Pause keeps its bright fill on hover and keyboard focus, and light
  atlas background layers match the page. Canvas corner alpha is zero in light
  and opaque in dark after zoom/fit; the light status font resolves to Georgia.
- `git diff --check` passed. Prior checkout work and layer boundaries were
  preserved. No build wiring or usage instructions changed.

Validation covers Chromium and existing physical-atlas behavior, not other browser
engines or future ecology. Measured speed remains dependent on device workload.
