# Architecture and decision record

## Status

**Current: Google tag restricted to the public deployment — 2026-09-19.**
Decision 054 adds the requested analytics tag only under the exact HTTPS
GitHub Pages origin and `/emergence/` path.

**Relative publishing paths and animated life silhouettes — 2026-09-19.**
Decision 052 fixes source-page subdirectory links and adds detailed, illustrative
population silhouettes with curved motion at closer map zoom.

**Theme flicker, universal species collapsing and mixed-feeding costs — 2026-09-19.**
Decision 051 adds a brief neon-like theme effect, lets a sole species collapse,
and activates V3 revision 3's stronger mixed-feeding tradeoffs.

**Ordered genomes, smooth readouts and revised world sizes — 2026-09-19.**
Decision 048 adds energy labels and collapsible species inspection, brief numerical
transitions, and Small / Medium / Large presets of 24 × 16 / 42 × 28 / 60 × 40.

**V3 trophic tuning and compact notebook — 2026-09-19.**
Decision 047 strengthens ecological distinction, increases opportunities for
carnivory and movement, extends producer shading to every body size, and removes
portraits while collapsing the shorter possible-adaptation list.

**V3 activation — 2026-09-19.**
Decision 046 activates V3, with bounded species-wide adaptation directions,
community-dependent scores and distinct ecological branching. V1/V2 remain
preserved. Active rules are in
[`v3/README.md`](../src/simulation/life/v3/README.md).

**Historical V2 activation — 2026-09-17.** Decision 043 switches
the application to the independent V2 model while preserving V1 unchanged. New
model rules and genes are in [`v2/README.md`](../src/simulation/life/v2/README.md).

**Historical presentation status — 2026-09-17.** Decision 041
uses muted warm-grey land and deeper blue seas from the supplied screenshot. Decision 040
moves the genome portrait above species details and separates vivid plant greens
from cooler bare ground. Decision 039
simplifies statistics, gene controls and selection styling. Decision 038
refines selection, charts, population display and biological cadence. Decision 037 refines startup,
species inspection, names, and life rendering. Decision 036 implements the first
life model, browser execution, and live notebook/atlas observations. Model choices
and approximation limits are recorded in
[`v1/docs/DECISIONS.md`](../src/simulation/life/v1/docs/DECISIONS.md).

**Historical physical-atlas status, superseded by 036 — 2026-09-15.** Decisions 010–013 implement the
requested interface, generator, seasonal climate, and geographic diagnostics.
Decision 014 adds a separate live world-building page and a UI seasonal preview
clock. Decision 015 simplifies the atlas and adds measured climate playback
controls. Decision 016 refines the controls, expands the notebook, and adds live
English/Polish localization. There are no organisms, biological rules, or biological
simulation loop.

**Historical documentation boundary update — 2026-09-16, implementation
deferrals superseded by 036:** Decision 034 separates shared
world rules from versioned life-model research and defines common life inspection
semantics plus a provisional rendering brief. Application behavior is unchanged;
`src/simulation/life/v1/` contains documentation only. Decision 035 refines its
internal documentation and gene directory layout.

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

The supplied notes were initially in `docs/`, not `/documents`. **Their location
and combined scope are superseded by 034; links below follow the relocation.**

- Simulation summary v6, now split into [shared world rules](evolution_simulation_summary_v6.md)
  and [life rules](../src/simulation/life/v1/docs/evolution_simulation_summary_v6.md):
  world, climate, habitats, movement, resources, and proposed daily phases.
- [Evolution mechanics v3](../src/simulation/life/v1/docs/evolution_mechanics_summary_v3.md): inheritance,
  mutation, drift, and proposed species classification.
- [Starting genes v1](../src/simulation/life/v1/genes/docs/evolution_simulation_genes_v1.md): capabilities and trade-offs.
- [Approximation strategies v1](../src/simulation/life/v1/docs/evolution_simulation_approximation_strategies_v1.md):
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

The footer credits Robert Chaba, links the author’s email using `mailto:` (address removed in 049),
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

## 018 — Aligned playback rate columns — 2026-09-15

Target and Actual speed outputs now use the same fixed-width multiplier column
and a separate days-per-second column. This extends 017's stable outer width so
single-digit, double-digit, and decimal multipliers cannot shift the rate's start.
The UI retains each complete translated speed phrase and native output element;
the rate column can wrap within constrained widths. Simulation, timing, renderer,
colour tokens, and usage remain unchanged.

Validation: `npm run build` and `npm test` passed (25 headless/renderer checks,
37 Chromium checks, one existing desktop touch-test skip). Browser measurements
confirmed aligned rate starts in both locales and themes at 1440, 800, 390, and
320 px and during playback. Both themes were visually inspected on desktop and
phone. Existing checks cover wrapping, overflow, keyboard focus, assets, disabled
controls, and the stationary slider. `git diff --check` passed. Validation remains
limited to Chromium and the existing physical atlas.

## 019 — Quieter rivers and mineral terrain palette — 2026-09-15

**Supersedes 017's bright dark-mode playback fill and refines 010's river and
terrain presentation.** The user supplied an earlier-version screenshot as a
visual reference. Dark Play/Pause now uses the existing pale lichen accent,
including hover, instead of the more saturated green. Light selection retains
its existing treatment. Explicit dark and system-dark fallback tokens match.

Rivers use muted blue-grey tokens and finer flow-dependent strokes, bounded to
0.45–2.5 CSS pixels instead of 0.7–7. Spring markers and their outlines are smaller
and use subdued water tones. Actual drainage links, tributary width ordering,
lake outlets, wrapped connections, and frozen-channel colouring remain intact.
Channels still follow the physical hex links; this does not add meandering or
change hydrology. At fitted phone scale, fine rivers are intentionally subtle;
zooming makes individual channels easier to inspect.

Land shifts from yellow-beige toward stone and taupe, with more neutral dark
relief and a warmer paper-compatible light palette. Elevation still drives land
colour, and terrain relief and frost retain their existing calculations. All
colours stay in `src/ui/styles/tokens.css`; rendering receives computed tokens
and only changes stroke/marker sizing. No engine state, generation, climate,
localization, usage, artwork, or dependencies change.

Validation: `npm run build` passed. `npm test` passed 25 headless/renderer checks
and 37 Chromium checks, with the existing desktop touch-test duplicate skipped.
The suite covers frozen snapshots, seam connections, frost, theme changes,
playback, keyboard focus, assets, disabled controls, both locales, and responsive
bounds through 320 px. Visually inspected light/dark atlas views at 1440 and
390 px and dark rivers at 2.3× zoom. Browser measurements confirmed the active
button keeps the lichen fill on hover and has a solid keyboard-focus outline.
`git diff --check` passed. Existing decision 018 work was preserved. Validation
is limited to Chromium and the existing physical atlas.

## 020 — Curved channels and hex-rim selection — 2026-09-16

**Supersedes 019's straight river presentation and refines 010's selection
outline.** The user's close-up reference calls for gently bending channels and
rounded turns. Rivers now use cubic curves between shared presentation nodes.
Small, fixed offsets derived from hex IDs move land nodes away from exact cell
centres; water endpoints stay centred. Tangents follow the strongest incoming
tributary and outgoing channel, with cell ID breaking equal-flow ties. Short
handles soften turns and terminal tangents give even one-link streams a slight
bend. Springs move with their channel's source node.

All tributaries share their receiving node. Wrapped edges use the nearest
longitude and clipped copies at both sides. Equal-level lake interiors remain
unmarked. Flow-dependent widths and frozen-channel colours continue from 019;
a faint token-defined bank is drawn beneath the water, with all banks painted
first to keep junctions continuous. Shape depends on physical snapshot fields
and fixed renderer geometry, never theme, season, camera, browser time, or random
state. This is cosmetic curvature, not erosion, new drainage, or simulated
meandering. Actual channel connectivity and world generation remain unchanged.

Pinned hexes now have a fine two-tone rim close to the cell boundary and a faint
translucent fill. Dark uses pale lichen; light retains warm paper/ink. Stroke and
inset sizes adapt to zoom, keeping small cells visible without the old heavy
fixed-width outline. Hover uses a lighter outline without tint, and a hovered
pin is painted only once. Terrain and rivers remain visible through selection.
New bank and selection-fill colours are root tokens with matching explicit-dark
and system-dark definitions. No UI commands, engine state, dependencies, artwork,
localization, or usage instructions change.

Validation: `npm run build` passed; `npm test` passed 27 headless/renderer checks
and 37 Chromium checks, with the existing desktop touch-test duplicate skipped.
Focused renderer checks cover frozen snapshots, short wrapped curves, shared
tributary endpoints, continuous main-channel tangents, sampled curve containment
within linked fixture cells, season/camera stability, and single-painted pin tint.
Existing browser checks cover keyboard selection, layers, playback, theme and
language changes, assets, focus, disabled controls, and responsive bounds through
320 px. Visually inspected both themes at desktop and phone sizes, including
close-up rivers and selection over a channel. `git diff --check` passed and dark
fallback tokens match. Validation covers Chromium and representative geometry;
these curves do not establish geological realism or future ecological behavior.

## 021 — Responsive generation, seasonal repainting, and frame-filling views — 2026-09-16

**Supersedes synchronous browser generation in 011/014 and the initial fitted
camera in 010/015.** The setup preview and newly opened atlas now use a centered
cover scale calculated from the rectangle inside the staggered hex perimeter.
This fills both dimensions of the frame. Fit still reveals the full outline,
including whole edge hexes. Zooming down to 1× also resets pan so an anchored
wheel gesture cannot leave the fully zoomed-out world partially offscreen.
Picking and silhouette clipping retain the original physical hex geometry.

### Work avoided and layer boundaries

Generation runs in `src/ui/generation-worker.js`, a browser adapter importing the
unchanged headless generator. Input still debounces for 180 ms. New input
terminates obsolete workers immediately, and a revision guard rejects stale
responses. Successful workers return the complete generated snapshot and then
terminate; failure keeps Start disabled and displays the existing translated
failure message. There is no backend or new dependency. Vite emits the module
worker as a separate static asset. Browser module-worker support is required.

UI retains the original generation snapshot as read-only `geography` while
replacing the current seasonal snapshot. Rendering uses that explicit identity
to cache shaded warm/frozen terrain colours and curved river geometry. New
geography replaces that identity; theme changes invalidate colour caches.
Offscreen river copies and springs are culled using padded geometric bounds.
The renderer never imports the generator or changes either snapshot.

The renderer retains its previous Canvas frame. With geography, camera, viewport,
theme, layer and selection unchanged, terrain updates compare frost/ice states.
Only changed cells and their river destinations need repainting. Pixel-aligned
damage rectangles clip clearing and drawing; nearby hexes repaint in their
original order, followed by rivers, springs and selection. This also preserves
the transparent light-theme ground. Unchanged terrain, elevation and region
frames skip raster work entirely. Temperature and moisture remain continuous
diagnostic layers and repaint from the current readings. Changes to camera,
selection, viewport/DPR, theme, layer or geography trigger a full repaint.

`setDay` still owns a complete deep copy of its result, including nested
neighbours and region records. Its copying loop now copies scalar fields
together and recurses only into nested data, avoiding per-scalar entry-pair
allocations. Climate formulas, all generated values, clock pacing (including
20 preview days/s), snapshot ownership, and deterministic behavior are unchanged.
No biological batching or simulation rules were introduced.

### Validation and measured limits

- `npm run build` passed; `npm test` passed 29 headless/renderer checks and
  43 Chromium checks, with the existing desktop touch-test duplicate skipped.
- New checks cover frame coverage, complete fitted edges, minimum-zoom
  recentering, skipped unchanged frames, cache invalidation, and worker
  cancellation while controls remain usable. Worker output is compared with
  direct headless generation for the same settings.
- Pixel comparisons check partial repainting against fresh complete frames
  through warm/frozen seasons, rivers and a pin, at fit/cover/panned cameras,
  both themes, and DPR 1/1.5. The comparison allows tiny Canvas antialiasing
  differences: mean premultiplied channel difference at most 0.01 out of 255,
  and at most 0.05% of pixels differing by more than two channel levels.
- Visually inspected setup and atlas in both themes at desktop and phone
  widths, including frame coverage, wrapping, focus, assets and controls.
  Existing browser checks also cover 320 px, both locales, playback and layers.
  The development page generated a world, opened the atlas and fitted the
  complete map without browser errors. `git diff --check` passed.
- A local headless Chromium comparison used seed `map-performance`, a
  1000 × 650 Canvas at DPR 1, five warmup updates and 60 measured seasonal
  updates, including a one-pixel readback to finish raster work. Medium-world
  climate plus drawing fell from about 40.5 ms/update to 3.6 ms; large-world
  work fell from about 67.0 ms to 14.5 ms. The generator itself is unchanged;
  moving it to a worker improves responsiveness rather than generation speed.

These are local measurements of stationary terrain playback, not guaranteed
frame rates on the user's Linux hardware. Panning, zooming and continuous
diagnostic layers still require full repaints. No other browser engine or future
ecological behavior was validated. Original research, artwork, theme tokens,
licence text, and engine/browser dependency boundaries remain intact.

## 022 — Stable setup preview and regeneration mist — 2026-09-16

**Refines 021's setup presentation.** The preview surface now keeps its own
1.65 aspect ratio (with the existing 420 px desktop minimum), instead of sharing
flexible height with the summary and adjacent form. Its panel aligns to the top
of the grid. Generation status reserves two lines, preventing the common
ready/generating message change from moving the phone preview. Longer copy can
still expand naturally; no text is clipped or given a fixed maximum height.

Changing settings immediately fades and softly blurs the old Canvas over 160 ms.
A drifting radial wash fills the frame while the worker runs: warm parchment in
light mode and a subdued lichen glow over green in dark mode. The result waits
for concealment, measures and draws the new world, then reveals it over 420 ms.
This hides the map replacement without transforming or scaling the actual frame.
Fast results wait only for concealment; slow generation has no extra fixed delay.

The UI uses the Canvas's CSS animation completion promises and rechecks the
existing request revision after awaiting them, so superseded results cannot
replace newer input. Invalid settings restore the prior preview; failure clears
it and ends the effect. Start retains its existing validity behavior. The preview
exposes its busy state; the existing translated status remains the announcement.
Decorations intercept no input. Reduced-motion preferences remove blur, fades,
and drifting movement, leaving a static wash until the completed map is drawn.

All colours remain root theme tokens, with matching system-dark fallback values.
Only browser composition and CSS change; the renderer, generation worker,
headless engine, seasonal pacing, language catalogues, original artwork and
licence are unchanged. No dependency or usage change requires a README update.

Validation: focused Chromium checks cover a held worker, small/large world swaps,
stable preview rectangles in both themes at desktop and phone widths, reduced
motion, invalid input, worker failure and recovery. Both themes were visually
inspected during generation and after completion at desktop and phone widths.
`npm run build` and `npm test` passed: 29 headless/renderer checks and 47 Chromium
checks, with the existing desktop duplicate of the touch test skipped. Existing
checks also cover keyboard focus, assets, disabled controls, both locales,
responsive overflow through 320 px, worker cancellation and seasonal playback.
`git diff --check` passed. Build wiring and usage are unchanged. Validation is
limited to Chromium and the physical atlas; no other browser engine or future
ecological behavior was validated.

## 023 — Serif speed readouts in light mode — 2026-09-16

**Supersedes 017's monospace speed outputs for the light theme.** Target and
actual speed values now use the existing `--font-playback-status` token, matching
the light theme's body serif while retaining monospace in explicit and system
dark mode. The reserved character widths and tabular figures remain, keeping
the slider stable as values change. This is a UI stylesheet change only; pacing,
measurement, simulation and rendering boundaries are unchanged. Usage is unchanged.

Validation: `npm run build` and `npm test` passed (29 headless/renderer checks,
47 Chromium checks, one existing desktop touch-test duplicate skipped).
Computed styles confirmed both readouts resolve to Georgia in light mode and
monospace in dark mode. Visually inspected both themes at desktop and phone
widths; existing layout checks cover both locales through 320 px, wrapping,
overflow and the 9× to 10× slider transition. Existing checks also cover focus,
assets and disabled controls. Validation remains limited to Chromium.

## 024 — Consistent light-theme serif and tighter speed spacing — 2026-09-16

**Supersedes 005's light-theme monospace labels/readouts and refines 023.** All
remaining UI readouts and labels now use the semantic `--font-readout` token:
body serif in light mode, the existing monospace stack in dark mode. This covers
Field atlas, Field notebook, landing labels, setup values, layer choices, theme
and language controls, and zoom values. Explicit and system-dark definitions
match; the no-JavaScript light fallback also receives serif typography.

Light-mode speed rows reduce the label/value grid gap from 8 to 4 px and the
reserved multiplier column from 7 to 5 character widths. The total output width
remains fixed so changing speed does not move the slider. Dark-mode spacing is
preserved through theme tokens. Only UI styles change; engine, renderer, playback,
localization, original assets, and usage remain unchanged.

Validation: `npm run build`, `npm test` (29 headless/renderer and 47 Chromium
checks, one existing skip), and `git diff --check` passed. An additional browser
inspection confirmed all visible text on the light landing, setup, atlas and
open application menu resolves to Georgia. Computed styles verified each theme's
speed gaps and readout fonts. Visually inspected the atlas in both themes and
the light landing/setup at desktop and phone widths. Existing tests cover both
locales, layouts through 320 px, stable speed controls, focus, assets and disabled
controls. Browser validation is limited to Chromium.

## 025 — Plain landing introduction label — 2026-09-16

Removed the decorative circle before “An open-ended evolution sandbox” at the
user's request, along with its unused CSS rule. The paragraph keeps its existing
translation key and theme typography. This change is limited to landing markup
and UI styling; usage and layer boundaries are unchanged.

Validation: `npm run build`, `npm test` (29 headless/renderer and 47 Chromium
checks, one existing skip), and `git diff --check` passed. Visually inspected
light and dark landing pages at desktop and phone widths; the label has no circle,
text fits, and original artwork renders correctly. Existing checks cover keyboard
focus, controls, responsive overflow, and language switching. Browser validation
remains limited to Chromium.

## 026 — Life introduction panel in the notebook — 2026-09-16

The notebook now includes a bordered, dialog-like panel below the hex details.
A small line-drawn cell, a heading, a short explanation and a full-width
**Start life here** button give the future action a clear place in the interface.
The panel uses existing theme colours and type tokens, including the paper
theme's double border and dark theme's lichen accent. English and Polish copy
use the existing catalogue and locale switcher.

At the user's explicit request, the native button is enabled and focusable but
has no action. A visible note explains that life seeding is not available yet;
the button references that note for assistive technology. There is no modal,
event handler, selected-site reservation, biological state or engine API.
The existing inspector, camera, climate and playback behavior remain intact.

The phone notebook grows from 220 to 300 px to give the panel reading space,
with a smaller decorative icon and tighter panel padding. Its existing scrolling
allows access below the facts, while the short-screen rule continues to reserve
map space. On narrow or short screens the panel can require scrolling. The README
describes this design-only control. Existing checkout work and original assets
are preserved; no dependency or build wiring changes were needed.

Validation: `npm run build`, `npm test` (29 headless/renderer checks, 47 Chromium
checks, one existing desktop touch-test skip), and `git diff --check` passed.
Visually inspected the panel in both themes at desktop and phone widths.
Additional browser checks covered both languages, horizontal overflow through
320 px, keyboard focus, and an enabled button whose click leaves the paused
world's day, camera, layer and selection unchanged. Existing checks cover assets,
disabled controls and physical-atlas behavior. Validation is limited to Chromium;
life simulation remains unimplemented.

## 027 — Selection-gated life button and quieter panel — 2026-09-16

**Supersedes 026's always-enabled button, decorative cell and availability note.**
The life panel retains its heading, explanation and full-width button below the
hex details. The icon, availability text, unused translations/styles and associated
accessible description have been removed at the user's request.

The button is disabled in initial markup and whenever no hex is pinned. The
existing inspector update synchronizes its native disabled state with selection,
including pointer/keyboard selection, clearing, generation and locale refreshes.
Any selected hex enables the button; this is presentation state, not a biological
suitability check. The enabled button still has no action. No simulation, rendering,
playback or dependency changes were introduced. The README describes the behavior.

Validation: `npm run build`, `npm test` (29 headless/renderer checks and 47 Chromium
checks, one existing skip), and `git diff --check` passed. Existing map interaction
checks now assert disabled initial/cleared states and enabled pointer/keyboard
selection states. Visually inspected both themes on desktop and phone with and
without a selection. Additional checks confirmed keyboard focus and no horizontal
overflow in Polish through 320 px. Existing checks cover original assets and
responsive atlas behavior. Validation remains limited to Chromium and the physical
atlas; life seeding is still unimplemented.

## 028 — Faded specimen plates in the light theme — 2026-09-16

The user's visual experiment adds six of the supplied transparent drawings as
quiet atlas decorations: a ginkgo and wing study around the landing hero, a moth
and shell in the page footers, a fern above world setup and in the notebook, and
a small seedling at the life panel's edge. Original `pic1`, `pic2`, `pic5`, `pic7`,
`pic8`, and `pic12` WebP files are referenced directly and retain their pixels.
The remaining drawings and all supplied background images are untouched; existing
page textures, backgrounds, logos, colours and typography are preserved.

Placement lives in `src/ui/styles/botanicals.css`; two root tokens set 24% and
15% opacity. The existing ornament display token confines the drawings to light
mode, including live System changes and the CSS fallback without JavaScript.
Absolute, clipped layers sit behind content without adding layout space or
intercepting input. Empty alternatives and `aria-hidden` keep the artwork out of
accessible content. Phone layouts scale/reposition the plates and omit the wing
and large notebook fern to preserve space for controls and details.

This changes static markup and UI styles only. The images are decoration, not
organisms or generated ecological information; simulation, rendering, state,
localization and life-button behavior are unchanged. No dependency or usage
change requires a README update. Keeping the originals adds approximately 2.2 MB
of image assets to the static build; footer and notebook images use lazy loading.

Validation: `npm run build`, `npm test` (29 headless/renderer checks and 47
Chromium checks, with the existing desktop touch-test duplicate skipped), and
`git diff --check` passed. Inspected landing, setup and notebook in both themes
at desktop and phone widths, including Polish at 320 px, selected/unselected
hexes, keyboard focus and disabled controls. Production browser checks verified
asset loading, decorative accessibility attributes, non-intercepting layers,
no horizontal overflow and light/dark visibility, including the no-JavaScript
system fallback. The existing development server also served both pages.
Validation remains limited to Chromium; the amount of decoration is an aesthetic
experiment for the user to judge.

## 029 — Keep only the notebook specimens — 2026-09-16

**Supersedes 028's placements outside the life panel and lower notebook corner.**
At the user's request, remove the landing, setup, footer and notebook-heading
drawings and their unused styles. The landing no longer loads the botanical
stylesheet. Keep the life panel's seedling at its existing size, position and
15% opacity. Move the notebook fern beyond the bottom-right corner so the
existing decorative layer crops it at both edges; its size and 24% opacity
remain unchanged. The existing phone rule continues to hide the large fern.

Only `pic7` and `pic12` remain application assets from the drawing collection,
totalling approximately 787 kB. Original resource files and all backgrounds are
preserved. This is a static markup and UI styling refinement with no engine,
renderer, state, localization, control behavior, dependency or usage changes.

Validation: `npm run build`, `npm test` (29 headless/renderer checks and 47
Chromium checks, one existing skip), and `git diff --check` passed. Visually
checked the remaining decorations in both themes at desktop and phone widths.
Additional browser checks confirmed the removed placements are absent, the fern
extends beyond both clipping edges, assets load, layouts do not overflow, and
the life button retains its disabled/unselected and enabled/selected states.
The development pages loaded successfully. Existing checks cover keyboard
focus, system themes, both locales and responsive layouts. Browser validation
remains limited to Chromium.

## 030 — Larger, lighter notebook fern — 2026-09-16

**Supersedes 029's deep corner crop and 028's fern opacity.** Raise the fern
from a −104 px bottom offset to −30 px and bring it inward from −96 px to
−32 px at the right edge, leaving only the root tips slightly cropped.
Increase its maximum width from 330 to 380 px, bounded by the notebook width,
and reduce its opacity from 24% to 16% through the existing root token.
The life-panel seedling retains its existing appearance and 15% opacity.

The fern remains decorative, clipped, absent from dark mode and hidden on phones.
Only UI sizing, placement and an opacity token change; original images,
backgrounds, simulation, rendering and controls are preserved. Usage is unchanged.

Validation: `npm run build`, `npm test` (29 headless/renderer checks and 47
Chromium checks, one existing skip), and `git diff --check` passed. Visually
inspected both themes at desktop and phone widths. Browser checks confirmed
16% fern opacity, unchanged 15% seedling opacity, theme visibility, image loading
and no horizontal overflow. Existing checks cover focus, disabled controls and
both locales. Browser validation remains limited to Chromium.

## 031 — Mirror the notebook fern — 2026-09-16

Mirror the notebook fern horizontally with `scaleX(-1)` applied to its existing
rotated presentation, as requested. Its size, placement, opacity and responsive
visibility remain unchanged. This CSS-only adjustment preserves the original
image, life-panel decoration, backgrounds and application behavior; no layer
boundary or usage changes are introduced.

Validation: `npm run build`, `npm test` (29 headless/renderer checks and 47
Chromium checks, one existing skip), and `git diff --check` passed. Visually
inspected both themes at desktop and phone widths; additional browser checks
confirmed asset loading, theme visibility and no horizontal overflow. Existing
checks cover focus, disabled controls and localization. Browser validation
remains limited to Chromium.

## 032 — Centered insect plate at the notebook foot — 2026-09-16

**Supersedes 029–031's notebook fern treatment.** The user's request for the
winged insect is implemented with the full insect study in `pic5.webp`.
Replace the fern with this plate, centered horizontally, 12 px above the
notebook's bottom edge, at up to 340 px wide and 15% opacity. Remove the fern's
mirroring and corner offsets. The existing light-only and phone-hidden treatment
continues; the user's intervening life-panel styling adjustments are preserved.

Only static markup and UI placement change. Source images, backgrounds, engine,
renderer, controls and usage remain unchanged. The drawings are decorative and
do not describe generated organisms.

Validation: `npm run build`, `npm test` (29 headless/renderer checks and 47
Chromium checks, one existing skip), and `git diff --check` passed. Visually
inspected both themes at desktop and phone widths. Additional browser checks
confirmed centered placement, the 12 px bottom inset, 15% opacity, asset loading,
theme visibility and no horizontal overflow. Existing checks cover focus,
disabled controls and both locales. Browser validation remains limited to Chromium.

## 033 — Remove the notebook insect — 2026-09-16

**Supersedes 032's insect decoration.** Remove the insect markup, its positioning
styles and the notebook's now-unneeded decorative stacking context at the user's
request. The life-panel seedling and its current user-adjusted styling remain.
Original drawings are preserved in `resources/`; the built UI now references only
`pic12` from that collection. Backgrounds, application behavior, layer boundaries
and usage are unchanged.

Validation: `npm run build`, `npm test` (29 headless/renderer checks and 47
Chromium checks, one existing skip), and `git diff --check` passed. Visually
inspected both themes at desktop and phone widths. Additional browser checks
confirmed the insect is absent, the seedling loads, theme visibility is preserved
and layouts have no horizontal overflow. Existing checks cover focus, disabled
controls and both locales. Browser validation remains limited to Chromium.

## 034 — Versioned life models and common observations — 2026-09-16

**Supersedes 001's single research location and combined world/life scope, and
003's deferral of a documented life-observation contract.** The user's current
request establishes `src/simulation/life/v1/`, with future candidate models in
sibling version folders. This step creates documentation only: no biological
implementation, registry, model selector, engine API or life overlay is added.

### Ownership and source split

Generation, grid/hex identity, terrain, water/drainage, temperature, moisture,
seasons and geographic diagnostics remain shared. Existing physical modules stay
where they are. Browser playback retains its shared 1×–10× scale (2–20 days/s),
20 days/s preview, measured throughput and hidden-tab pause behavior. Life models
receive explicit time and read-only physical inputs; they do not read browser
time, mutate geography or override the climate. The physical generator must not
import a life implementation.

Every biological choice belongs to its candidate model: the meaning of introducing
life, founder settings and admission, genes, organism behavior, movement and
crossing, reproduction, species classification, population dynamics, numerical
representation and approximations. In particular, v1's resource budget and
adaptation formulas are not promoted into shared physics. Alternative models must
remain possible without importing another candidate's biological rules.

The combined `docs/evolution_simulation_summary_v6.md` is split in place: shared
sections 1–4, geographic material in 9, and physical checks in 12 remain there.
Life-specific paragraphs from 1/4, sections 5–8 and 10–11, classification in 9,
and biological examples/checks in 12 move to the same filename under `life/v1/`.
Original section numbers remain traceable. Mechanics v3, genes v1 and approximation
strategies v1 move into that folder, retaining their research revision names.
Cross-references, contributor instructions, and README indexes follow the split.
Historical prompts remain unchanged and do not authorize future work.

One ownership clarification explicitly supersedes the original summary's request
to publish its organism traversal formula as the world's static difficulty:
that calculation is v1-local; the implemented geographic diagnostic in 012 stays
shared. Existing research formulas and biological proposals are otherwise retained.
Older gene proposals remain subordinate to their later summaries. Missing
production, reproduction, feeding and initialization decisions are listed in the
[v1 index](../src/simulation/life/v1/README.md), with no invented coefficients.
The previously cited readiness review is absent from this checkout.

### Common UI boundary and rendering direction

The [life boundary](../src/simulation/life/README.md) and
[observation contract](../src/simulation/life/CONTRACT.md) define version-independent
meanings for global population/species counts, species lists, per-hex occupants,
species-to-hex populations and display summaries. Counts represent organisms,
not cohorts, cells or markers. Species classification remains model-owned;
generic consumers use opaque IDs, consistent completed revisions and explicit
exact/estimated/unavailable metadata. Global and local counts must reconcile;
missing information is not zero. Queries do not advance time or consume
biological random state. Optional model details must not become generic UI
requirements. Exact JavaScript APIs and storage/transport formats remain deferred.

World setup Start, Play/Pause and biological introduction are distinct intents.
A future model validates life introduction and reports structured results;
UI neither invents founders nor implements suitability checks. Model changes
start separate life runs; no implicit state migration is promised. Reproducibility
requires the model/rules/approximation identity and complete state in addition to
physical inputs. Comparing different models does not promise matching seed paths.

The [provisional rendering brief](../src/rendering/LIFE.md) records greener hexes
for very small plants (stronger on land, subtler on water), green dots for larger
plants, other colours for other larger organisms, and larger dots for larger
bodies. Further user instructions will refine this. Thresholds, mixed roles,
marker aggregation, palette and scaling are intentionally undecided. UI supplies
computed theme tokens; rendering consumes read-only common observations and has
no biological authority. No UI or renderer implementation changes in this step.

### Validation and limitations

`npm run build` and `npm test` passed: 29 headless/renderer checks and 47 Chromium
checks, with the existing desktop touch-test duplicate skipped. Local Markdown
file/heading links resolve, the source split was compared against the original
notes, and `git diff --check` passed. The diff contains only Markdown; historical
decisions and the pre-existing decision 033 were preserved. No UI changed and no
additional visual inspection was performed.

These checks cover the existing physical atlas, not the unimplemented biology,
approximation fidelity or cross-model compatibility. The shared contract is a
documented integration requirement awaiting real implementations, not a tested
interface. Biological coefficients and the further rendering instructions remain
open as described in the model index and visual brief.

## 035 — Model documentation and gene directories — 2026-09-16

**Supersedes 034's flat research-file layout within each model version.** Each
`life/vN/` keeps model documentation in `docs/`, gene code in `genes/`, and gene
descriptions in `genes/docs/`, as requested. These are model-relative paths;
the repository's `docs/` continues to own shared world rules and this record.

V1's life summary, mechanics and approximation notes move into `v1/docs/`;
the starting-gene catalogue moves into `v1/genes/docs/`. Research filenames,
content and authority are preserved, and links and contributor indexes follow
the relocation. The model README remains its entry point. Later versions use
the same structure without sharing model-specific gene rules implicitly.

This is a documentation reorganization only. No biological code, speculative
gene API, application behavior or layer dependency is introduced. Original
artwork and historical decisions remain intact.

Validation: `npm run build` and `npm test` passed (29 headless/renderer checks,
47 Chromium checks, one existing skip). All 85 local Markdown file links resolve;
relocated research content matches its originals apart from link destinations.
Diff review and `git diff --check` passed. These checks cover the physical atlas
and documentation structure, not the still-unimplemented biological model.
No UI changed, so no additional visual inspection was performed.


## 036 — Working v1 life and the living Field Notebook — 2026-09-16

**Supersedes the biological implementation deferrals in 001–004, 026–027,
034–035, and the climate-only playback boundary in 015.** The current user
explicitly requests the complete first life model, its UI, and performance
optimizations, and authorizes judgment for unspecified rules provided those
choices are recorded. The original research is preserved. Adopted biological
rules and departures belong in
[`src/simulation/life/v1/docs/DECISIONS.md`](../src/simulation/life/v1/docs/DECISIONS.md),
not in shared physical modules or presentation code.

### Ownership and execution

V1 owns introduction, complete genomes, local habitats, energy, light competition,
feeding, movement, births, mutation, starvation, dispersal, species identity,
representation, and continuation state. It exposes completed serializable
observations through the common boundary. Species and variants have separate
identities; neither a map region nor a new mutation automatically creates a
species. Counts refer to represented living organisms, not cohort records or
map markers. Classification uses actual occupied habitat connectivity.

`climateAt(world, hex, day)` is a new shared physical query. It returns the same
readings as `setDay` for one location without copying a whole world. Both paths
use one implementation and a cached 360-day seasonal signal. Formulas and
geography remain unchanged. V1 evaluates only occupied locations and candidate
arrival locations; empty regions need no biological update.

The browser owns the life worker and pacing. UI supplies explicit introduction
and advance commands; the headless model never reads time, DOM, or browser
services. Worker replies contain completed observations. The atlas advances its
physical day only when the corresponding biology has completed. Playback uses
the existing 1×–10× meanings (2–20 simulated days/s), with bounded requests and
no accumulation of hidden-tab catch-up. Target speed does not alter daily rules,
mutation probability, or the species qualification period. Querying, drawing,
locale, and theme cannot consume the model's random stream.

### Controls and observations

The selected hex is the explicit introduction input; the user does not choose a
founding population size. Following the user's clarification during this step,
the model supplies a small photosynthetic plant colony and adapts its initial
habitat and temperature traits to that hex. This initial choice does not make
subsequent mutations environment-directed or change genomes during life. Hard
exclusions and conditions no available founder genome can support return an
explanation without choosing another site.

Introducing life leaves playback paused; Play/Pause and one-day stepping control
advancement. There is no reset while organisms survive. After extinction, the
same introduction action can explicitly start a fresh attempt on the current
world/day. It never reseeds automatically. Returning to setup continues to
generate a new physical world. A pause finishes an already requested bounded
batch and shows that pending state before reporting Paused.

The Field Notebook displays world counts, selected-hex inhabitants, a living
species catalogue, variants, eight-trait profiles, abstract specimen plates,
and accumulated life events. UI formats whole phrases and numbers in English
and Polish and retains world, camera, and selections across locale/theme changes.
Model notes distinguish exact represented counts from approximate ecology.

The map consumes common abundance, normalized size, habitat, and derived-role
summaries. Small producers tint hexes; larger producers and consumers have
bounded, deterministic decorative markers. Species highlighting shows occupied
locations. Marker count is unrelated to organism count, and zoom only changes
presentation detail. Colors come from root theme tokens, including system-dark
fallbacks. Original artwork and historical research are preserved.

### Performance and limits

Complete genomes are interned; equivalent local states share integer-count
cohorts. Random event counts retain stochastic demographic variation rather than
using deterministic expected populations. Daily energy quantization is identified
as a biological approximation with an exact-energy comparison mode. Rare variants
are retained, and no fixed population cap or skipped ecological days substitute
for resource competition. V1's decision record specifies the selected coefficients,
ordering, rounding, and checkpoint metadata.

Rendering caches presentation geometry, limits each occupied hex to a small
marker budget, culls offscreen work, and invalidates changed life areas alongside
seasonal map damage. Biological work runs independently of camera and redraw
frequency. The static build gains a life worker but no application dependencies,
backend, framework, or transpilation.

### Executed validation

- `npm run build` and `npm test` passed: 55 headless/renderer checks and 55
  Chromium checks, with the existing desktop duplicate of the touch test skipped.
  Life checks cover rejected-command atomicity, site-adapted plant introduction,
  extinction-only restart, conserved counts, newborn activation, complete seeded
  continuation, gene graphs, light caps, habitat-local feeding, predator depletion,
  movement, 100-day species qualification and reconnection resetting its timer.
- Browser checks exercise real worker playback against headless results at the
  same day, including theme/locale changes; they also follow a land colony through
  seasonal extinction and an explicit new attempt without replacing the world.
  Existing physical, localization, theme, input, accessibility and layout checks
  continue to pass at desktop and phone sizes, including 320 px.
- Both themes were visually inspected with living populations, census/trend,
  gene portraits, native focus, disabled controls and notebook scrolling. The
  development server ran a medium-world life population through 40 days without
  browser errors. No founder-size input or reset action remains.
- Final local Node 26.8.1 benchmarks used seeds `life-benchmark-small`, `-medium`,
  and `-large`, default physical settings, day-zero water sites nearest 20 °C,
  and 360 complete biological days. Model-only totals were approximately 65,
  420 and 986 ms. The large run ended with 130,793 organisms in 749 occupied
  hexes and 1,676 cohorts; its 95th-percentile update took 4.55 ms and observation
  construction took 2.15 ms. These low-diversity runs do not establish speed for
  all ecosystems or devices. The v1 decision record includes approximation limits.
- A deliberately dense 10,000-predator/10,000-prey checkpoint exposed quadratic
  hunting work. Size-indexed prey pools and immediate recombination reduced that
  local one-day test from approximately 424 to 8 ms, retaining its 5,898 kills.
  Additional mixed-food-chain stress checks reconciled births, deaths, species,
  hex populations, bounded energy and checkpoint continuation across 30 seeds.
- `git diff --check` passed, all 94 local Markdown file links resolve, the full
  built licence matches `LICENSE`, and runtime dependencies remain empty. Source
  review found no browser services, wall-clock access or unseeded randomness in
  simulation, and no reverse layer imports. Original research and artwork remain.

Energy bins and shared-pool grazing are explicit experimental approximations.
There is no independent individual reference, calibrated ecological balance,
rare-lineage accuracy guarantee, or validated long-term trajectory error bound.
Exact counts mean exact counts of the represented state. Browser validation is
limited to Chromium, and no cross-browser numerical equivalence is claimed.

## 037 — Species-centered notebook and day-one startup — 2026-09-17

**Supersedes preview-day carryover in 014–015 and the paused introduction,
optional life overlay, automatic species highlighting, population/variant census,
and detailed model panels in 036.** The user's requested inspection flow starts
from world species totals, then the selected hex and its inhabitants.

Opening a new atlas explicitly applies physical day 1 before initializing life,
and starts paused. The setup preview retains its independent seasonal playback.
A successful introduction starts playback automatically; rejection keeps it paused
and displays the model's reason. Extinction still pauses, and another introduction
requires an explicit action. The simulation's calendar, daily rules, seeded stream,
worker completion boundary and speed meanings are unchanged.

The notebook heading loses its version badge and separator. Its summary contains
living species, extinct species, and occupied hexes as a percentage of every
physical hex, including water and ice. A two-series SVG chart uses the existing
180-completed-day model history with added extinct-species counts. Counts and
history describe the current life attempt; explicitly starting after extinction
begins another attempt, with the existing prior-attempt archive retained. The
chart uses distinct solid/dashed lines, ticks, a translated legend and accessible
text. It replaces the UI's sampled population history, so faster worker batches
do not omit daily species events. The footer remains the sole current-day readout.

Hex facts now occupy a compact two-column definition list. An empty pinned hex
explicitly says it has no life, including before introduction. Otherwise its
species appear as native buttons in a list, retaining focus across observations.
Clicking a name opens its details and highlights every current occupied hex;
clicking it again clears that highlight. Switching hexes clears the highlight.
A sole occupant opens automatically, without requesting map highlighting. Pinning
scrolls the local record into view when needed in the phone notebook. Theme and
locale changes preserve the current selection and biology.

Species details contain the global population, present gene expressions and
retained genome portrait. Model-owned observations aggregate all living variants'
carrier totals; partial genes/expressions use lighter text and explicit population
percentages. Absent traits are omitted, and iteration is not limited to eight
genes. The portrait uses the most populous complete living genome, rather than
inventing a composite genome. Variant/location selects, ancestry, derived-role
notes, life-event panels and approximation disclaimers are removed from the UI;
model decisions and limitations remain in the model's documentation.

V1 assigns each species a persisted, deterministic cosmetic name from its seed
and ordinal. A versioned fixed-width syllable encoding grows with the ordinal
instead of exhausting a finite dictionary, with uniqueness within each attempt.
Names do not depend on genes or consume biological randomness, and remain stable
across locale changes and checkpoint continuation. Older unnamed checkpoint
records receive deterministic names on restoration. Naming and gene aggregation
stay within `life/v1/`; shared consumers read observations only.

Life always appears on the map. Tiny stationary producers retain a separate
colour mark on diagnostic layers whose physical fills cannot be tinted. Dots
lose their dark outlines. Model-provided
mobility enables same-colour appendages at close zoom and small cosmetic local
motion at at most eight updates per second. UI controls animation time, stops it
while paused/hidden and honors reduced motion; the renderer cannot change any
biological position. The existing damaged-cell repaint path includes animated
cells, retaining the twelve-marker budget per hex. Explicit species highlights
remain separate from organism marks, using ochre in light mode and the existing
pale token in dark mode. All authored colours and type sizes remain root tokens.

Validation: `npm run build` and `npm test` passed: 58 headless/renderer checks,
57 Chromium checks, and the existing desktop touch-test duplicate skipped.
Checks cover day-one reset after preview playback, auto-start, explicit highlight
versus automatic detail expansion, local-only species lists, partial gene carriers,
empty hexes, extinction/reintroduction, 100,000 unique generated names, checkpoint
continuation, bounded motion rendering, visibility on every map layer, and occupied-range
highlighting. Browser checks also confirm motion stops on pause and with reduced
motion. Real
worker playback still agrees with headless results at equal completed days.
Both themes were visually inspected on desktop and phone, including partial-gene
styling, keyboard focus and notebook scrolling. Existing checks cover both locales,
320 px overflow, assets, disabled controls and storage failures. Translation-key,
layer-boundary, runtime-dependency and `git diff --check` checks passed.

Limitations: the chart retains the last 180 completed days of the current attempt,
and the portrait depicts one representative genome. Cosmetic motion represents
mobile groups rather than individual trajectories. Browser validation is limited
to Chromium; no ecological coefficients or calibration claims change here.


## 038 — Territory contours, carrier selection and slower biology — 2026-09-17

**Supersedes 037's per-hex species outlines, combined chart and unfiltered gene
expressions, plus 036's one biological turn per physical day.** This implements
the user's request for a calmer map selection, independent chart scales, compact
population counts, minor-variant filtering, optional carrier highlighting, and
biology at 30% of its former speed while temperature continues as before.

The renderer outlines the union of a selected species' occupied hexes, with a
subtle fill, rounded joins and a contrast halo. Integer lattice vertices remove
all internal shared edges, preserving holes and disconnected patches. At the
cylindrical map cut the two visible portions close independently. No smoothed
boundary invents occupied land. A second teal fill and narrower dashed outline
marks carriers of a clicked gene expression while the species outline remains.
Overlapping contours remain distinguishable. Pin and hover remain above both.
Cached contour geometry is presentation-only; membership changes repaint the
frame, while unchanged ranges use the existing damage repaint path. All colours
are root theme tokens, including their alpha and system fallback definitions.

Three compact notebook charts separately show living species, extinct species,
and occupied-hex counts. Each has its own zero-based scale and the same 180-day
physical history window, with step lines, numeric ticks and localized accessible
text. The occupied-hex summary remains a percentage of all physical hexes. Species
population uses locale-aware compact notation (e.g. 21K / 21 tys.); exact model
counts and observation quality remain intact.

Gene expressions below 2% of the selected species' global population are omitted
from the notebook, with the threshold applied before display rounding. Exactly
2% remains visible. A row with no visible expressions disappears. Every rare
variant continues to live, mutate, reproduce and contribute to totals normally.
The existing expression list also serves as carrier selection, without adding
a second genome catalogue. Clicking an expression enables the species outline
if needed and toggles its additional carrier range. Switching species/hexes,
starting a new attempt, or dropping below 2% clears the carrier selection. Theme,
locale and ordinary count updates preserve it and stable buttons retain focus.
V1 provides detached per-variant and per-expression carrier locations/counts;
UI/rendering consume observations and never infer occupancy from private genomes.

Biological cadence belongs entirely to v1. Rules revision `v1-cohorts-2` accrues
three integer credits per physical day, takes one complete turn per ten credits,
and keeps the remainder. Introduction resets credit; turns first fall at offsets
4, 7 and 10 physical days. All biological phases and classification run at that
cadence and sample the current physical day's climate. The classifier now waits
100 biological turns. The world calendar, 360-day seasons, 2–20 days/s speed scale,
worker completion boundary and one-day step retain their shared meanings. A 10×
target therefore executes six biological turns/s, the former 3× rate, with the
same ratio at every speed. No frame timing, view option or floating accumulation
selects biological events. Checkpoint format 2 stores credit and turn count;
format 1 is rejected explicitly rather than silently changing old continuation.
See the v1 decision record for rule ownership and historical benchmark limits.

Validation: `npm run build` and `npm test` passed: 61 headless/renderer checks,
59 Chromium checks, and the existing desktop touch-test duplicate skipped.
New checks cover integer cadence and fractional checkpoint continuation, exact
carrier-location accounting, internal-edge removal, holes/islands/map-cut closure,
independent chart scales, layered selections, and partial-repaint equivalence to
fresh Canvas frames in both themes. Browser checks cover the exact 2% cutoff,
rare-carrier retention, compact counts, keyboard selection/focus across updates,
clearing a now-minor expression, and selection persistence across locales/themes.
Visually inspected territory/carrier contours, charts and controls in both themes
at desktop and phone widths; checked Polish wrapping and 320 px overflow.
Existing checks cover climate playback, assets, disabled controls and storage
failure. All 168 EN/PL translation keys match; layer-boundary review, 43 links in
touched documents, built-licence equality, empty runtime dependencies and
`git diff --check` passed.

Limits: territory boundaries have hex resolution; a carrier highlight marks all
hexes containing that expression, including hexes shared with other variants.
Separate charts retain only the current attempt's last 180 physical days. Slowing
biology relative to seasons changes ecological trajectories and does not establish
calibrated balance or future performance with greater diversity. Old headless
checkpoints are incompatible with the revised cadence. Browser checks cover
Chromium, not cross-browser numerical equivalence.

## 039 — Compact notebook and green highlights — 2026-09-17

**Supersedes 038's three-chart notebook, teal carrier highlight and clickable
universal expressions, plus 037's ochre light-theme species outline.** The user's
eight UI refinements retain the living-species count and its 180-day chart, while
extinct species and occupied-hex percentage become text counts only. The visible
“Species in this hex” heading is removed; the section retains its translated
accessible name. Water moisture displays a localized **100% (water)**. The shared
physical model still uses `null` for water's inapplicable land-moisture index.

Both themes use a pale species contour. Carrier hexes have a much lighter green
fill with a dark-green dashed contour. Notebook selections use dark green with
contrasting pale text, without changing their borders on hover or selection.
All colours remain root CSS tokens, including the system-dark fallback; Canvas
continues to receive resolved tokens through UI. Geographic diagnostic colours,
territory geometry, contours and biological rules are unchanged.

Gene expressions with at least 98% of a species' population are static values,
not buttons. This UI interpretation of “almost all” complements the existing
2% visibility cutoff, applied to unrounded fractions. Expressions from 2% to
below 98% remain carrier-selection buttons when locations are available. A
selected expression reaching 98% clears its carrier highlight while preserving
the species outline; keyboard focus moves to the species control if its focused
expression becomes static. Stable buttons retain focus across ordinary updates.
Binary traits display only the carrier percentage instead of “Present”, and
other partial expressions keep their value plus a compact percentage. The same
spacing is reserved for static and selectable values, avoiding line/border jumps.

The scope is UI and theme presentation. Complete observations, retained rare
variants, counts, seeded state, climate, biological cadence and history remain
unchanged. README and the rendering record describe the revised inspection flow.

Validation: `npm run build` and `npm test` passed: 61 headless/renderer checks,
59 Chromium checks, and the existing desktop touch-test duplicate skipped.
Updated browser checks cover the single chart, EN/PL water labels, absence of
redundant headings/labels, static universal values, the exact 98% boundary,
selection clearing and focus transfer, return to a selectable partial expression,
and stable dimensions when toggling selection. Both themes were visually inspected
on desktop and phone, including the lighter carrier region, compact counts,
keyboard focus and Polish labels; the suite also checks 320 px overflow, disabled
controls, assets and storage failures. Diff and layer-boundary review passed.

Limits: a carrier highlight marks whole hexes, including those shared with other
expressions. The 98% cutoff is a presentation choice, not a biological threshold.
Browser checks cover Chromium and do not establish ecological calibration or
cross-browser numerical equivalence.

## 040 — Portrait first and plant-green terrain contrast — 2026-09-17

**Supersedes 037's portrait-after-details order and the previous producer, land
and relief palette values.** Place the genome portrait directly below the species
name, before population and gene details, with a smaller top gap. Its existing
representative-genome source, caption, size and accessible control relationships
remain intact.

Both themes use a more saturated leaf green for producer coverage and markers.
Bare land and its relief shading shift toward softly warm stone greys, most
noticeably in light mode, so vegetation stands apart from unoccupied ground.
The first cooler revision was too desaturated for the user; it is superseded by
the midpoint between that revision and the original land/relief RGB values,
restoring some warmth in both themes. The page keeps
its paper/ink or green-black identity. All palette changes live in root CSS tokens,
with the system-dark fallback synchronized. UI passes resolved colours through
the existing renderer boundary. Terrain geometry, abundance-based tint strength,
water colours, selections and biological observations remain unchanged. The
existing relief-shadow token also supplies the subtle shading on region colours;
region identities and diagnostic meanings are unchanged.

This is a presentation-only adjustment with no engine, timing, dependency or
state-format changes. README and the life rendering record describe the new
inspection order and palette.

Validation: `npm run build`, `npm test` (61 headless/renderer checks, 59 Chromium
checks and one existing skipped desktop touch duplicate), and `git diff --check`
passed after the palette refinement. Visually inspected both themes at desktop
and phone widths, including portrait placement, keyboard focus, Polish wrapping
and the revised ground colours. A dense land-producer display fixture confirmed
the vegetation contrast on desktop. Additional browser checks confirmed portrait
ordering and overflow on desktop, and the no-JavaScript system-dark map tokens
match explicit dark mode. The existing suite covers narrow-screen overflow,
assets, disabled controls, localization and playback. Diff review confirms all
code changes remain in UI and theme presentation.

Visual validation is limited to Chromium and does not establish ecological
fidelity; the dense-colony fixture checks appearance, not attainable populations.


## 041 — Reference-inspired land and sea palette — 2026-09-17

**Supersedes 040's land/relief colours and the preceding sea/lake palette.**
The supplied screenshot guides a narrower warm stone-grey elevation ramp and
stronger blue seas, with muted blue-teal lakes. Light mode uses slightly lifted
values beside the paper interface; dark mode uses deeper values beside its
green-black panels. The system-dark fallback matches explicit dark mode.

All changes are root CSS colour tokens. The existing UI adapter passes them to
Canvas; depth interpolation, terrain relief, seasonal frost/ice, vegetation
coverage and selections keep their existing calculations. The relief-shadow
token also shades geographic regions, so their subtle shading follows the new
neutral tone. No geography, climate, life rules, commands or dependencies change.
The screenshot is a visual reference, not a source of additional requirements.
Usage is unchanged.

Validation: `npm run build` and `npm test` passed (61 headless/renderer checks,
59 Chromium checks; one existing desktop touch duplicate skipped). Visually
inspected the atlas in light/dark at desktop and phone sizes. The existing suite
checks focus, disabled controls, assets, localization and overflow through 320 px.
A token comparison confirmed explicit-dark and system-dark map values match.
`git diff --check` passed; diff review confirms this step changes only palette
tokens and this decision record, preserving earlier workspace edits. Browser
validation is limited to Chromium.

Limit: this is a palette approximation of the reference; the generated geography,
current season and zoom determine the actual distribution of colours.

## 042 — Any-hex introduction and finer life marks — 2026-09-17

**Supersedes 036's site rejection rules, 037's small orbital motion and twelve
marks per hex, and numeric body-size descriptions.** The user requests words for
size, introduction regardless of suitability, and smaller, more numerous marks
with softer plants, changing placement and visible mobile motion.

V1 now accepts introduction on every valid physical hex, including permanent ice,
high ground and sites with negative initial energy balance. The same 20 founders
receive the existing site-matched traits and energy reserve. Normal habitat,
feeding, upkeep, starvation, movement and offspring rules determine subsequent
survival. Living runs still reject another introduction; explicit restarts after
extinction accept any hex. No balancing coefficients change. This model-owned
command change increments rules revision to `v1-cohorts-3`; checkpoint shape stays
at format 2, with the existing strict revision check rejecting older rules.

The notebook maps the supplied body-size range to ten complete EN/PL word labels,
from tiny to enormous, removing numeric size and cell counts. Partial-expression
percentages, filtering and carrier highlighting continue to describe observations.
There is no gene or body-size calculation in UI.

All display groups receive smaller representative dots, including tiny producers
alongside their existing terrain tint. Abundance provides up to ten samples per
group within a 30-mark hex budget, reduced to six/fifteen at lower zoom. Dot radius
is capped at 3.5 CSS pixels. A separate translucent stationary-plant token softens
plants without weakening vegetation coverage; both themes and system fallback
supply it through the existing UI-to-renderer token boundary.

A stateless cosmetic hash supplies scattered in-hex positions. Stationary marks
fade out and reappear every twelve visible playback seconds, staggered by slot;
mobile marks follow smooth paths between waypoints every 3.5 seconds. This
replaces the previous small orbital wiggle. UI advances the cosmetic clock at
most eight times per second, stopping on pause, hidden tabs and reduced motion.
Damage repainting includes stationary fades and mobile travel. The renderer reads
only common observations and cannot alter biological state or random streams.

Validation: `npm run build` and `npm test` passed: 63 headless/renderer checks,
61 Chromium checks, and one existing skipped desktop touch duplicate. Tests cover
all fixture hexes, ordinary energy-driven extinction on ice/high land/cold water,
explicit restart, checkpoint replay, EN/PL size labels, bounded smaller samples,
reproducible scattering, smooth mobile travel, and partial-versus-full repaint
pixel comparisons with stationary and mobile marks in both themes. Existing
checks cover pause/reduced motion, worker/headless equivalence, keyboard focus,
disabled controls, original assets, storage failure and overflow through 320 px.
Visually inspected the notebook and a dense presentation fixture in both themes
at desktop and phone widths, including Polish copy and focused controls.
Translation parity, theme fallback, layer/dependency review and `git diff --check`
passed. README and model/rendering records describe the new behavior.

Limits: marks represent population groups, not individual positions or counts.
Motion stays inside each occupied hex; actual spread follows new observations.
Poorly suited introductions may go extinct. Prior-rules headless checkpoints
require their original model revision. No ecological calibration is claimed.

## 043 — Independent V2 life model and bounded environmental variability — 2026-09-17

**Supersedes V1 as the application's active model in 036–042.** V1's source,
gene catalogue, research and decisions are preserved byte for byte as they stood
at the beginning of this task, including the user's pre-existing uncommitted
changes. V2 is a separate sibling implementation, importing no V1 code. The life
worker now selects V2 explicitly; no model-switching UI or checkpoint conversion
is introduced. Existing clocks, speed meanings and the common detached
observation contract continue unchanged. V2 has its own `v2-cohorts-1` rules and
`emergence-life-v2-checkpoint-1` format, rejecting V1 checkpoints.

### Why a separate model

V1 combines very rare mutations with a classifier requiring disconnected
populations and a strict majority of one complete genome. In practice this can
retain one species despite substantial variation. The user requests modestly
faster diversification, permeable barriers, additional ecological trade-offs and
complete new documentation, with a clarified target of roughly 5–15 simulated
years to the first new species on suitable sites. That target guides exploratory
experiments; it never creates a scheduled branch or protects founders.

V2 implements 20 inherited traits, with all values and costs documented in the
new [gene catalogue](../src/simulation/life/v2/genes/docs/GENES.md). New capabilities
include toxins/spines and resistance/handling, alternative skeletons and armor,
quantitative movement, flight, eyesight, echolocation, thermal sensing and
facultative sexual reproduction. Larger bodies pay higher absolute and per-cell
costs, while height affects contested light and size supplies feeding refuges.
Mixed feeding and mobile photosynthesis remain possible with efficiency costs.
Expensive newborns must actually be funded; no mutation can create an elaborate
body for its cheaper parent's construction payment.

Finite accessible plant tissue is allocated in resistance bands; one resistant
grazer cannot expose otherwise protected tissue to vulnerable consumers. Hunting
uses opposing movement, sensing, handling and defenses and immediately depletes
prey. Background mortality, mutations and integer stochastic recruitment retain
drift. Measured pressure increases undirected mutation probability within a bound;
no organism receives a useful trait because it needs one. Sex recombines existing
traits, has maintenance/construction/mate costs, and receives a modest paid
establishment benefit under stress. Assortative mating uses inherited acquisition
signatures and living local conspecific partners. Human intelligence is absent.

### Isolation and classification

A land lineage may cross one hostile water hex through delayed passage, with
survivors counted and feeding at their source until one arrival roll. Waiting
carriers do not reproduce; passage delay and all remaining state are checkpointed.
Functional flight can reduce delays but cannot remove them. Land/water adaptation
has overlapping intermediate states, allowing repeated evolutionary reversals.

Persistent radius-one demes replace the global complete-genome-majority gate.
Barrier isolation requires two genetic steps for 240 biological turns; weaker
distance isolation requires three steps for 420 turns. A persistent acquisition
niche can branch after three steps and 360 turns, even as a minority beside an
abundant founder population. One connected ecological lineage receives one new
species identity, avoiding a separate label for every local deme. No divergence,
insufficient population, or loss of qualifying isolation resets qualification.
Full rules and limits are in [ISOLATION.md](../src/simulation/life/v2/docs/ISOLATION.md).

### Shared physical inputs and boundaries

The generator's existing quality gate already requires multiple meaningful
regions, a river and a physically costly region connection. V2 does not insert
biological barriers or assigned biomes into geography. Regression checks cover
48 maps spanning sizes and extreme settings, inspecting actual coasts, ground
barriers and costly neighboring passes.

`physical-world-3` adds `seeded-weather-1` world metadata. Stateless, smoothly
interpolated regional and long-period seed/day signals bound temperature changes
at ±2 °C and land-moisture changes at ±0.1. Sea surfaces vary by at most ±0.3 m;
each lake basin shares a drawdown of at most 0.5 m, exposing shallow margins.
Channels use a bounded exposure index because the model has no cross-sections.
Shared `climateAt` and the atlas agree on current conditions and ice cover;
V2 carries weather metadata in both geography and world identity. Weather never
consumes biological randomness. Metadata-free historical worlds keep their
original seasonal formulas.

Hydrology's `waterLevel` remains the fixed datum; `currentWaterLevel` is a dynamic
observation. Bed elevations, coastline, water types, drainage and region topology
remain fixed. This is bounded physical variability, not a conservation-based
weather/water cycle or a flowing-glacier/erosion model. V2's organism responses
stay in V2. UI and rendering receive common observations, never model internals.
The notebook localizes all added traits and structural categories in EN/PL using
supplied expression ranges; themes, controls and original artwork are retained.

### Validation and limits

The complete [V2 validation record](../src/simulation/life/v2/docs/VALIDATION.md)
records the final checks and seeded pacing panel. New focused tests exercise gene
costs and countertraits, finite accessible feeding, living-mate selection,
recombination, delayed passage, habitat reversals, spatial/ecological persistence,
exact population accounting, checkpoint continuation and weather determinism.
Cannibalistic hunts explicitly exclude the current actor when removing pending
prey turns, preventing phantom hunters after a cohort is depleted.

All 13 V1 file hashes match the pre-task manifest. The complete application remains
static, framework-free and without runtime package dependencies. Exact integer
counts describe the represented cohorts; energy binning, pooled feeding,
operational species boundaries and ecological balance remain approximations.
No universal survival, speciation deadline, accuracy bound for long trajectories,
or cross-browser numerical identity is claimed. New high-diversity food webs can
cost more CPU than V1's sparse populations; playback still reports achieved speed.


Final V2 validation: `npm run build` and `npm test` passed with 102 headless/
rendering checks, 63 Chromium checks and one existing skip. Both themes were
inspected at desktop/phone widths with EN/PL gene labels and visible focus.
Eight seeded suitable-site introductions (six water, two land) produced first
branches at 7.00–11.41 simulated years, all retaining living descendants at the
follow-up observation; exact results and limitations are in the V2 validation
record. Runtime dependencies remain empty, documentation links resolve, V1 hashes
are unchanged, and `git diff --check` passes.

A final per-feeding-call cache removes repeated genotype-pair derivation and prey
filtering during hunts. Six synthetic food-web seeds with both energy modes and
cross-restored checkpoints gave 36 identical complete before/after states,
including random streams, with about a 14% fixture speed improvement. It changes
no rules or continuation schema. The development server also completed atlas
startup, V2 introduction and pause without browser errors.

The existing climate playback browser check now uses a fixed world seed. Weather
can offset a short seasonal change at a random site, leaving its rounded reading
unchanged even when playback works; the known fixture retains the visible-change
assertion and passed three repetitions at both viewport sizes.

## 044 — Maximum speed after placement and stable gene emphasis — 2026-09-17

**Refines 037's automatic playback and supersedes its dimming of every partial
gene/expression.** Successful introduction now sets the speed slider and target
readout to the existing maximum, 10× (20 physical days/s), before starting
playback. This applies to explicit restarts after extinction as well. The change
is made only after the worker accepts introduction; rejection/error does not
change the selected speed. Manual speed controls and Play/Pause retain their
meanings. UI owns this pacing preference; no life model receives a new setting.

Notebook trait labels and expression values now use decision 039's existing 98%
cutoff for normal versus muted text as well as for expression interaction. The
previous exact-100% styling test could toggle colour when a rare noncarrier
appeared or disappeared while the displayed percentage remained rounded to 100%.
Shares at or above 98% keep normal theme colours; visible shares below 98% stay
muted. The comparison uses unrounded observed populations. Percent formatting,
the 2% visibility filter, carrier locations and selection behavior are preserved.

Both fixes stay in browser composition and notebook presentation. There are no
changes to biology, snapshots, seeded streams, theme tokens or renderer rules.
Existing uncommitted V2 work and historical records are preserved. README,
the common UI command contract and life rendering notes describe the behavior.

Validation: `npm run build` and `npm test` passed: 102 headless/renderer checks
and 65 Chromium checks, with one existing desktop touch-test duplicate skipped.
Focused checks cover first placement and extinction/reintroduction selecting 10×,
and real-model observations alternating between 100%, 99.99%, 98% and 97.99%
carriers. Computed colours for both labels and values, static/selectable behavior,
and EN/PL formatting are checked across updates in both themes and viewports.
Visually inspected light/dark desktop and phone screenshots for stable gene
emphasis, muted partial values, maximum-speed readouts, wrapping and focus.
Existing checks cover overflow through 320 px, assets, disabled controls and
worker/headless equivalence. Diff and layer review plus `git diff --check` passed.
Browser validation remains limited to Chromium.

Limits: 10× is a throughput target, so achieved speed still depends on workload.
The 98% cutoff is a presentation convention, not an ecological rule.

## 045 — Bounded local variants and earlier species recognition — 2026-09-17

**Supersedes 043's exhaustive living-genome representation and 240/360/420-turn
qualification waits for active V2.** The user requests substantially less variant
detail and earlier species recognition, and explicitly approves a compact
approximation with a representative and a few competing variants per local
population. V1 and earlier research remain preserved. This is a changed
biological approximation, not an exact performance optimization or a display
filter. V2 rules advance to `v2-cohorts-2`; the checkpoint format identifier stays
at 1, with the existing strict rules-revision check rejecting older trajectories.

### Representation and boundaries

After mortality, reproduction and energy settlement, V2 retains at most three
living complete genomes per `(species, hex, habitat, acquisition signature,
pending passage)` pool. Two most-abundant genomes retain their populations;
older establishment and stable ID resolve abundance ties. A third exploratory
representative comes from a population-weighted lottery over all other living
genomes. The fixed ticket is reconstructed from run seed, pool identity and
genome ID using one draw of a keyed Xoshiro128** stream. No changing day or
iteration order enters that ticket, no separate partially consumed stream
exists, and the demographic PRNG is untouched by compaction. This gives a rare
candidate a chance without rerolling its position every turn or preserving
every new mutation indefinitely.

Excess carriers use the nearest retained actual genome by existing genetic
distance, with abundance, establishment and stable ID breaking ties. Their
integer count, species, hex, habitat, provenance and pending journey remain
unchanged. Stored energy can only stay equal or decrease to the retained body's
capacity. No averaged genome, synthetic trait, extra organism, or forced branch
is created. The next ecological turn uses the represented traits normally.
Classification follows compaction, so its divergence evidence comes from the
population that remains represented. Equivalent cohorts then merge as before.

Separate localities retain different adaptations. Different feeding signatures
and pending route/due-turn/probability combinations stay separate rather than
erasing a minority niche or modifying an already paid journey. Consequently,
three is a limit per comparable pool, not per whole species, hex or world;
different niches and travel plans can require more representatives. The
historical genome registry remains intact. No population or species-count cap is
introduced. Earlier branching does not erase a new species' ability to evolve.

### Species recognition and observations

The existing population, genetic-distance and spatial/ecological isolation gates
remain: 20 organisms per compared deme, two genetic steps behind a barrier or
three for distance/niche separation. Qualifying persistence becomes 60 barrier,
90 ecological and 120 distance turns: 200, 300 and 400 physical days. Reconnection,
insufficient population/divergence and loss of the qualifying niche still reset
the timer. Filling the variant budget never creates a species. Once named,
species retain separate identities even after renewed contact or genetic
convergence; compaction never combines them.

Observations identify `local-representatives`, the pool meaning and its limit
alongside the existing energy approximation. `maximumRoundingStorageLoss`
replaces V2's broader `maximumDailyStorageLoss` label: the quantum bounds only
rounding, not the separate body-capacity clamp. `variantReassignments` counts
cumulative carrier assignments, potentially counting the same represented
organism more than once over time. Census totals and carrier locations reconcile
exactly for the represented population. They do not claim preservation of every
original rare allele. `energyQuantum: 0` disables energy rounding only; it does
not disable genome compaction. UI and rendering continue to consume detached
common observations and implement no biological rules. README, model rules,
isolation notes and the observation contract describe the new representation.

### Validation and limits

`npm run build` and `npm test` passed: 112 headless/rendering checks and 65
Chromium checks, with one existing desktop touch duplicate skipped. Focused
checks cover strict per-pool bounds, population and location conservation,
minority-niche and transit separation, rare-candidate admission and persistence,
stable ordering, energy capping, actual compaction followed by checkpoint replay,
query/day-chunk independence, earlier qualification, timer resets and permanent
species identities. Existing browser checks cover worker/headless agreement,
themes/locales and desktop/phone layouts. No authored UI or build wiring changed.

A full-suite rerun exposed an existing browser-test timing assumption: automatic
10× playback can grow the 20 founders before the test's Pause click completes.
The theme/language preservation check now compares with the actual paused
population, retaining its unchanged-day and unchanged-population assertions.

The [V2 validation record](../src/simulation/life/v2/docs/VALIDATION.md) retains the
old pacing panel as historical and records new seeded experiments. At the same
day 4,320 in the `emergence` water fixture, living variants decrease from 70 to 39
and the first branch moves from day 3,817 to 2,054. Population and species
trajectories differ: cohorts increase from 3,089 to 3,584 and timings are similar.
Therefore a local bound and lower genetic detail do not establish a universal
CPU speedup. Full historical registry size is not bounded by this change.

Three representatives are an explicit starting budget, not a scientifically
established minimum. Consolidation can remove rare adaptations and change trait
frequencies, drift, body investment and future ecology. It caps stored reserves
but does not conserve embodied biomass when changing representative body size.
The earlier waits are experimental pacing choices; neither the software checks
nor the small seeded panel proves ecological realism or guarantees survival,
branching time, long-run error bounds or cross-browser numerical equivalence.

## 046 — V3 species populations and ecological pressure — 2026-09-19

**Supersedes 043 and 045 as the active biological model.** The user explicitly
authorizes implementing and activating an independent V3, with freedom to change
genes and calculation rules. V2's per-location variant pools still multiply
across habitats, feeding signatures, journeys and energies; individual hunting,
offspring handling and deme classification remain expensive. Its classifier can
also recognize genetic distance without requiring a useful ecological difference.
V1/V2 source, research and artwork are preserved; V3 imports neither life model.

### Representation and selection

V3 holds one accepted genome per species and one integer population per species,
hex and habitat. It replaces individual action loops, energy cohorts and variant
journeys with finite-resource community calculation and aggregate demographic
events. The maximum of three candidate adaptation directions applies to the
whole species, not separately to every hex or feeding niche. Candidates never
feed, reproduce, count as organisms, or acquire their own tracked territories.

Founders still match local physical conditions, with additional viable seeded
random gene changes. All 22 traits, including new paid elevation and water-depth
preferences, are documented in the V3 gene catalogue. Elevation acts separately
from temperature; depth uses the actual water-surface/bed difference. No new
physical world fields, ecological biomes, species templates or guaranteed
evolutionary outcomes are introduced.

The same calculation supplies population growth and candidate ecological scores.
It accounts for temperature, habitat, moisture, elevation, depth and the resident
community's finite light, accessible plant production and prey. Consumers share
defended tissue bands, so additional species cannot unlock an inaccessible food
pool. Candidates and the parent phenotype are compared at the same probe size
against the same occupied community. New feeding lineages may use existing
parent resources, but hypothetical carriers cannot supply their own food.

Periodic seeded searches try single legal gene changes. Persistent broad
improvements can replace a species genome. A branch instead requires sustained
advantage, a meaningful ecological profile, available local support and an
advantage over occupants of its acquisition niche. Near-duplicate score and
realized-diet profiles are rejected. A successful branch transfers parent
population; it never creates additional organisms merely by naming a species.
A major feeding-system change always enters living state as a distinct lineage,
preventing large producer/consumer subpopulations hidden behind one species name.

Full coefficients, temporal sampling, candidate extension, novelty gates and
transfer thresholds are in [V3 rules](../src/simulation/life/v3/docs/RULES.md).
These are version-specific model decisions, not shared geography or UI rules.

### Integration and deterministic continuation

The browser worker explicitly imports V3. Existing introduction, pause/play,
automatic maximum target speed, calendar and three-turns-per-ten-days cadence
retain their meanings. V3 has its own `v3-populations-1` rules revision and
`emergence-life-v3-checkpoint-1` format. It serializes complete random state,
partial turn credit, populations, genomes, directions and persistence. V1/V2
checkpoints are rejected; there is no automatic migration or model-selection UI.

The common detached observation preserves consistent exact integer census
totals. Approximation metadata identifies aggregate demographic events and
estimated directions. The notebook shows established traits and separately
labels candidate ranges as estimated favourable locations, with no invented
carrier percentages. English/Polish controls highlight the model-supplied range
through the existing overlay. Empty estimated ranges are disabled. Themes,
portraits, population marks, keyboard controls and supplied artwork remain intact.
Queries, rendering and locale do not execute selection or consume randomness.

Memoized phenotypes and local scores are caches of immutable genomes and one
frozen community. They are discarded/rebuilt as their inputs change and are
not checkpoint state. They reduce repeated calculation without replacing the
underlying population rules. Simulation remains headless; UI owns browser
workers, translation and interaction; rendering consumes observations and tokens.

### Validation and limitations

The [V3 validation record](../src/simulation/life/v3/docs/VALIDATION.md) records
the final software checks, visual inspection and reproducible timing panel.
Focused checks cover bounded directions, conditioned/randomized founders,
finite resources, defended food access, ecological novelty and incumbent
competition, population-conserving branching, role coherence, aggregate count
consistency, checkpoint replay, query independence and browser/headless agreement.

This is a deliberately different ecological approximation. Stochastic rounding
has less demographic variance than individual Bernoulli events. Mean reserves
are bookkeeping, and body biomass is not conserved through phenotype changes.
Sampled pressure can miss intermediate or seasonal events; harmful/neutral
bridges can be lost. Barrier transport is rare aggregate conductance, with no
individual delayed journeys. Candidate territories and frequencies are not
measured carrier distributions. Ecological score criteria are not biological
taxonomy. No calibration, survival guarantee, speciation deadline, cross-browser
numerical identity or universal performance multiplier is claimed.

Final V3 verification: `npm run build` and `npm test` passed with 134
headless/rendering checks and 67 Chromium checks, plus one existing skip.
The development server completed atlas startup, V3 introduction and pause
without browser errors. Both themes and both locales were visually inspected
at desktop and phone widths; new controls also pass 320 px overflow and keyboard
focus checks. Localization parity, documentation links, layer review and diff
checks passed. V1/V2, original artwork, licence and package/lockfile are unchanged.

The eight same-world advancement samples in the validation record show smaller
V3 checkpoints and faster elapsed time, with different biological trajectories.
The most expensive water sample improved by about 17%, while its first complete
observation cost about 60 ms. Fixed-population-record updates remained near
0.1 ms when organism count grew 1,000-fold. These measurements support the
representation change but do not establish a universal speedup or calibrated
diversification. The record includes the reproducible benchmark command,
workload sizes and limitations.

## 047 — Compact inspection and V3 ecological tuning — 2026-09-19

**Supersedes 046's portrait and adaptation-note presentation, the earlier
tiny-producer-only coverage rule, and V3 revision 1 coefficients below.** The user
requests green shading for large photosynthetic organisms as well as dots,
shorter collapsible adaptations, removal of genome portraits, more carnivory and
movement, and fewer, more distinct species in medium worlds (preferably 50–60,
below 100). These are tuning aims, not hard population or taxonomy quotas.

### Presentation and boundaries

Every producer display group now contributes to the existing green terrain and
elevation tint, irrespective of normalized size or mobility. Abundance curves,
land/water tint caps, diagnostic colours and population dots are preserved.
Rendering still uses model-supplied roles and resolved CSS tokens; no biological
rules or genome interpretation move into Canvas code.

Species details start with population and inherited traits. The generated
genome portrait, helper and styles are removed; original resource artwork stays
intact. The unchanged SVG chart is isolated in `rendering/life-trend.js`.
Possible adaptations uses native `details`/`summary`, initially collapsed and
reset when inspecting a different species. It preserves expansion through live
updates, theme and language switches. Its explanatory paragraph is removed;
short EN/PL entries use numeric levels and approximate hex counts. Accessible
button names still identify estimated ranges, and unavailable ranges remain
disabled. Closing the disclosure preserves its current map selection.

### Version-specific tuning

Active rules become `v3-populations-2`. The checkpoint format is unchanged but
its existing strict revision check rejects revision 1 trajectories. There is no
implicit conversion, species merge or forced extinction. V1/V2, shared world
rules, three-turns-per-ten-days cadence, browser speed and random-state ownership
are preserved.

- Hunting effort increases from 2.2 to 2.8 per cell/acquisition/environment unit;
  grazing remains 2.2. Capture's base increases from 0.45 to 0.50 and speed
  coefficient from 0.09 to 0.14. Finite prey, size/defense limits, failed-attempt
  effort, 60% conversion and the shared 12% prey-withdrawal cap are unchanged.
- Movement upkeep decreases from `0.022 × level^1.4` to `0.016 × level^1.4`.
  Construction and photosynthesis penalties remain. Movement can pay through
  better pursuit or escape, with no free food or unconditional survival benefit.
- Movement and animal-feeding mutations get twice the search weight, including
  losses. Eight trials per pass and three directions per species remain the
  bounds; ecological advantage, persistence and actual founding-density tests
  still govern acceptance.
- A branch must pass ecological novelty against its own parent as well as all
  other extant species. Previously the parent was skipped. Mean realized-diet
  difference rises from 0.15 to 0.35, and the alternative complementary score
  profile threshold from 0.008 to 0.03. Uniform efficiency improvements do not
  constitute a niche. Whole-species adaptation still excludes its replaced
  parent from this comparison and cannot converge onto an incumbent.

These changes address weak hunting returns and permissive niche recognition.
They do not assign species, script future feeding transitions, guarantee movement,
or use the world's species count as a balancing input. All coefficients and
genetic search remain inside `life/v3/`.

### Validation and limits

The current [V3 validation record](../src/simulation/life/v3/docs/VALIDATION.md)
records focused rule checks, complete application checks, visual inspection and
the seeded medium-world panel. `scripts/check-life-v3-balance.js` repeats the
population/diet/movement observations without browser timing or hand-seeded
consumers. Its counts are observations rather than universal pass/fail targets.
The stronger novelty gate can reject small real niches, and higher hunting
pressure changes population and extinction trajectories. Limited seeded runs
cannot establish a stable species count for every seed or a calibrated ecology.

Final verification: `npm run build` and `npm test` passed, with 135
headless/rendering checks, 67 Chromium checks and the existing touch-test skip.
Both themes and EN/PL were inspected at desktop/phone widths, including native
disclosure focus, disabled entries, portrait removal and large-producer shading.
Actual development-server introduction and pause also passed. Two medium-world
water introductions reached 65 and 53 living species after 80 simulated years,
with respectively 11 and 8 animal-feeding lineages, three pure predators each,
and 7 and 6 mobile lineages. The comparable revision 1 `emergence` run had 98
species and no carnivorous/mobile species at year 40; revision 2 had 54 at that
age. These measurements support the tuning direction without guaranteeing the
requested species range. Full fixture details and limitations are in validation.


## 048 — Ordered genomes, smooth readouts and revised world sizes — 2026-09-19

**Supersedes the size presets in 010 and the earlier shared-world summary, and
refines 037/047's notebook presentation.** The user requests energy-first genome
inspection, smoother numerical updates, collapsible species when several share a
hex, energy-dependent list colours, and a size between Small and the former Medium.

### Inspection and presentation boundary

Inherited traits and possible-adaptation changes now list photosynthesis, plant
feeding and animal feeding first, then body size and sexual reproduction when
present, followed by the remaining supplied traits in stable observation order.
The UI sorts copies and reorders persistent rows when traits appear during playback;
model genomes and observations stay unchanged. Existing expression visibility and
carrier-selection thresholds retain their meanings.

Each species name has short energy labels: green photosynthesis, brown plant
feeding, red animal feeding. Every visible acquisition source gets its own label,
so mixed feeders are not forced into a single role. This describes observed
capabilities, not measured energy intake or a new biological classification. Text
labels accompany colour; all colours and type sizes consume root theme tokens,
including the no-JavaScript dark fallback. English and Polish update in place.

With several local species, clicking an open species again collapses its details
and clears its map highlight; a chevron indicates expansion. A sole local species
stays open, and clicking its name still toggles the range highlight. Live updates,
theme and locale preserve the current collapsed state. Native buttons keep their
keyboard behavior, visible focus and expanded/pressed state.

A UI-only animator eases numeric readouts to the latest observation over 240 ms:
population, life census, temperature/moisture, playback day and measured speed.
Small changes progress through rounded integers; large jumps skip intermediate
integers to settle promptly. Existing number nodes are retained instead of
rebuilding the physical inspector and speed text on each update. First display,
new species/hex selection, paused day stepping and speed-control feedback remain
immediate. Reduced motion and hidden documents settle active transitions, with
no catch-up animation. New observations retarget from the currently displayed
value. Raw data attributes, charts, map selections and model state use completed
observations immediately; interpolated text is a brief presentation transition,
not another census or simulated day. No wall-clock reads enter simulation code.

### World presets and reproducibility

Small remains 24 × 16 (384 hexes); Medium is 42 × 28 (1,176 hexes), the midpoint
of both former Small/Medium dimensions and the default; Large is the former
Medium at 60 × 40 (2,400 hexes). The 120 × 80 preset is retired. Setup labels,
static HTML, engine dimensions and current usage documentation agree.

The generator version advances to `physical-world-4` because identical named
size inputs now mean different dimensions. Terrain, drainage, climate and life
algorithms are unchanged. Historical validation records preserve their original
size names and generator versions; their former Medium is now Large. Headless
checkpoint world-identity checks continue rejecting incompatible worlds; there
is no implicit conversion of saved runs.

### Validation and limitations

Focused browser checks cover all preset dimensions and EN/PL labels, multi-source
energy labels, inherited trait priority, persistent collapsing, keyboard focus,
smooth retargeting, live locale changes and reduced motion. Existing geography
checks exercise every new preset's drainage, land budget and physical regions.
`npm run build` and `npm test` passed: 135 headless/renderer checks and 73
Chromium checks, with the existing desktop touch duplicate skipped. Both themes
were visually inspected at desktop and phone widths in EN/PL, including coloured
labels, collapsed lists, ordered genes and keyboard focus. The suite covers
wrapping through 320 px, disabled controls, original assets, storage failure and
worker/headless equivalence. New label contrast is at least 5.81:1 on its token
background; all 204 translation keys and explicit/system dark tokens agree.
The final diff and dependency-boundary review passed, as did `git diff --check`.
Pre-existing uncommitted work was preserved. Browser verification is limited to
Chromium; this task makes no new biological-validation claim.

Transitions intentionally lag numerical observations by at most their short
settling period after the final update; they never delay commands or biological
advancement. Compact population formatting can hide small numerical changes.
Colour indicates acquisition capabilities and makes no promise about future
evolution, actual diet proportions or ecological calibration.


## 049 — About dialog and GitHub contact — 2026-09-19

**Supersedes 007’s email contact link.** At the author’s request, the landing and
world-setup footers replace the email address with **About / O projekcie**.
The README directs contact to the author’s GitHub profile; the historical email
address is also removed from this record without removing the earlier decision.
Author credit, repository and BSD-3-Clause links remain.

A shared UI module creates a native modal `dialog` with the author’s supplied
eight English paragraphs, preserving their wording, and a complete Polish
translation. The final paragraph links directly to the author’s GitHub profile.
The current page locale determines the dialog language. The title receives
initial focus so readers start at the beginning; native modal behavior confines
keyboard navigation, and Close or Escape restores focus to About. The text scrolls
independently beneath a persistent heading and Close control, and each opening
starts at the top. The dialog fits desktop and phone viewports and uses existing
theme typography plus a root-defined backdrop token in both explicit and system
themes. The About link is enabled only after JavaScript initializes the dialog.

The change stays in the browser UI, with no simulation, rendering, dependency or
biological-rule changes. The AI attribution is author-supplied project copy.
Browser checks cover both footer entry points, both themes and locales, bounded
layout, readable scrolled contact, keyboard opening, focus, Escape, Close and
reopening. `npm run build` and `npm test` passed: 135 headless/rendering
checks and 77 Chromium checks, with the existing desktop touch duplicate skipped.
Both themes were visually inspected at desktop and phone widths, including
English and Polish copy, wrapping and visible keyboard focus. `git diff --check`
and the dependency-boundary review passed. Validation is limited to Chromium;
the dialog requires JavaScript and makes no new biological-validation claim.


## 050 — More explicit About link — 2026-09-19

At the author’s request, the English footer link from 049 is now **About this
project** on the landing and setup pages. Polish remains **O projekcie**.
The dialog title and supplied story retain their wording. This is a UI copy
change; static HTML, the translation catalogue, README and existing link check
use the same label, with no engine or rendering changes.

Validation: `npm run build` and `npm test` passed (135 headless/rendering checks,
77 Chromium checks and one existing skip). The updated footer was visually
inspected in both themes at desktop and phone widths through the development
server. `git diff --check` passed. Browser coverage remains limited to Chromium.

## 051 — Neon theme switching, sole-species disclosure and feeding tradeoffs — 2026-09-19

**Supersedes 048's always-open sole-species behavior and 047's V3 revision 2
mixed-feeding costs.** The user requests an irregular neon-like light/dark
transition, collapsing even a single local species, and substantially less
profitable mixed acquisition, especially photosynthesis with plant feeding.

Theme changes apply the final palette once, then play a 760 ms decorative
power effect: two uneven, low-opacity dimming holds plus a localized edge and
top glow. There is no smooth whole-page colour interpolation or repeated palette
swap. The effect consumes root colour tokens, uses no biological randomness,
and cannot intercept input or change focus. It is absent on initial load,
locale-only updates, unchanged resolved themes, hidden documents and reduced
motion. Active effects are removed when motion is reduced or the page is hidden.
Rapid changes cancel the current effect; a one-second guard prevents stacked
flickering. System/Light/Dark, persistence, storage failure, and no-JavaScript
fallback retain their meanings. Canvas updates its palette once per actual
change and does not implement the effect.

Every species row now has the same disclosure behavior and chevron. A sole
occupant opens by default; clicking it closes its details and clears the range
highlight, and reopening also highlights its range. An uninitialized disclosure
is distinct from an explicit collapse, so live observations, themes and locales
cannot reopen it. A new pinned hex or life run restores default expansion.
Native buttons retain keyboard operation, focus and accessible expanded state.
No additional UI interpretation of genomes is introduced.

### V3 costs and compatibility

Rules become `v3-populations-3`; the existing checkpoint format and strict
revision check reject older V3 continuations. With `n` acquisition systems,
additional per-cell upkeep is `0.06max(0,n−1) + 0.16PG`, where `P/G` indicate
photosynthesis/plant feeding. Construction pays 1.3 times that upkeep charge,
plus `0.30max(0,n−1) + 0.30PG` per cell. Thus photosynthesis plus grazing pays
an extra 0.22 upkeep and 0.886 construction per cell, versus 0.06 and 0.378
for either other dual combination; all three pay 0.28 and 1.264.

Costs apply even without food for a retained system. They change both resident
demographics and hypothetical direction scores through the existing shared
phenotype calculation. Every combination stays legal, and removing an unused
system removes its costs. Single-system phenotypes keep their earlier budgets.
Construction carries much of the pressure because excessive upkeep can close
marginal paths toward specialist consumers entirely. The final coefficients
are experimental game tuning, not empirical biological constants or fixed
mutation probabilities.

All rules stay inside `life/v3/`. V1/V2, mutation weights, the one-locus search,
branching gates, food access, finite budgets, hunting/movement, physical world,
calendar and browser speed are unchanged. There are no predefined species,
forced feeding transitions, quotas or new engine APIs. Existing uncommitted
About/contact work is preserved.

### Validation and limits

Focused checks cover paid mixed-feeding viability, unchanged specialist budgets,
finite resources, independent replay and prior-revision rejection. The mature
branching fixture now uses a viable specialist direction at an affordable
founding density; the overlarge split still fails. Browser checks cover the
actual intermediate theme frames, input during the effect, rapid changes,
reduced motion, system choice, sole-species keyboard toggles and persistence
through live updates and both locales. Screenshots cover both themes at desktop
and phone widths.

The [V3 validation record](../src/simulation/life/v3/docs/VALIDATION.md) records
same-world revision 2/3 comparisons at 20 years and final revision 3 observations
at 40 years. Photosynthesis/grazing disappeared from sampled checkpoints, while
specialist grazers still emerged and the land introduction produced one omnivore
and one pure predator. All combinations can grow in controlled suitable niches.
Two introductions in one world cannot establish universal rarity or calibrated
balance; the extra costs also affect consumer-emergence timing and diversity.
Browser inspection is limited to Chromium and cannot validate ecology.

Final verification: `npm run build` and `npm test` passed with 136
headless/rendering checks, 83 Chromium checks and the existing desktop touch
duplicate skipped. Intermediate theme frames and expanded/collapsed species
were inspected in light/dark at desktop/phone widths, including EN/PL and
keyboard focus. The full suite covers storage failure, disabled controls,
original assets, responsive overflow and browser/headless equivalence.
`git diff --check` and the final dependency/scope review passed. No runtime
dependencies, shared physical rules, artwork or licence changes were introduced.


## 052 — Relative publishing paths and animated life silhouettes — 2026-09-19

The user requests correct publishing at `robertchaba.github.io/emergence/` and
more interesting life visualization, especially animals. The live site was
serving unbundled source HTML with `/src/` and `/resources/` links pointing outside
the repository subdirectory. Both HTML entries now use `./` asset references.
Vite's existing `base: './'` remains explicit, as do the relative navigation,
licence and module-relative worker URLs. This supports direct source publishing
as well as the recommended `dist/` build without hardcoding a hosting directory.
There is no deployment, remote-setting change, backend or new dependency.

**Supersedes 042's close-view dots/radial appendages, straight mobile paths and
fixed eight-update animation cadence.** Rendering retains simple marks at wide
views and reveals plant rosettes plus rounded grazer, pointed predator and
segmented mixed/other silhouettes on zoom. Observed water habitat selects curved
tails and fins; land selects alternating bent limbs for mobile groups. Bodies
face the derivative of joined quadratic paths, whose shared tangents avoid
abrupt changes at waypoint boundaries. Stationary consumers stay fixed; stationary
producers retain fading, renewing patches. These are artistic population symbols,
not a claim about evolved anatomy, species identity or individual journeys.

`life-marks.js` owns cosmetic geometry and drawing. `map.js` retains aggregation,
culling, damage repainting and selections, now preserving display habitat in
marker summaries. Population-independent budgets remain 30 per hex, reduced to
six/fifteen at wide zoom. Consumer base radius caps at six CSS pixels, plants at
3.5; bounded appendages remain inside occupied cells. The new engraving colour
is a root CSS token in both explicit themes and synchronized system fallback.
Producer coverage, diagnostic fills and role-colour meanings are retained.

The UI cosmetic clock uses up to 24 updates/s at zoom ≥3×, otherwise eight.
Pause, document visibility and reduced motion continue to gate it. Simulation
cadence, browser speed meanings, biological randomness, counts and rules are
unchanged. Rendering reads only the common observations and supplied tokens;
no engine implementation, gene interpretation, state migration or new ecological
rule is involved. Research, original artwork and full licence remain preserved.

Validation and limitations: focused renderer checks cover deterministic bounded
paths and continuous headings, stationary consumers, habitat/role differentiation,
zoom detail, fixed drawing budgets, camera invariance and frozen observations.
A strict local static server checks both source and built pages in subdirectories,
including artwork, navigation, direct entry, licence and both workers, returning
404 for requests outside the mount. Canvas screenshots cover controlled consumer
and producer observations in both themes at desktop and phone widths. These
fixtures illustrate drawing only; shapes do not establish actual anatomy and
browser checks do not validate ecology. Remote publishing remains a separate step.


Final verification: `npm run build` and `npm test` passed with 137 headless/
rendering checks, 89 Chromium checks and the existing desktop touch duplicate
skipped. Light/dark population fixtures and the actual notebook/atlas were
visually inspected at desktop and phone widths, including selection, readable
wrapping, controls and original assets. Existing browser checks cover keyboard
focus, disabled controls, reduced motion, both locales, storage failure and
browser/headless equivalence. The Vite development server loaded both entry
pages and initialized generation/life workers without browser errors.
`git diff --check` and the final scope/dependency review passed. Browser validation
is limited to Chromium; neither actual GitHub deployment nor cross-browser
numerical equivalence was tested by this local change.


## 053 — README live link and project story — 2026-09-19

At the author’s request, the README opens with the public project URL, followed
by the existing About dialog’s eight English paragraphs and GitHub contact link.
The previous README details follow intact under Project details so visitors can
find the live sandbox and its motivation before the technical documentation.
This is a documentation-only change with no application or model-rule changes.

Validation: `npm run build`, `npm test` and `git diff --check` passed, including
89 Chromium checks and one existing skip. Final diff review confirms that the
previous README details are preserved. Browser coverage is limited to Chromium;
this documentation change makes no new biological-validation claim.


## 054 — Google tag restricted to the public deployment — 2026-09-19

The requested Google tag `G-45PVLVFBRP` initializes from the shared browser
entry point only when `location.origin` is exactly
`https://robertchaba.github.io` and the pathname starts with `/emergence/`.
This includes the landing page, explicit `index.html`, and `world.html`, with
query strings and fragments allowed. HTTP, non-default ports, other hosts,
forks, localhost and other paths leave both the remote script and analytics
globals absent. The trailing slash prevents matching `/emergence-preview/`.

`src/ui/analytics.js` queues the supplied `js` and `config` commands, then
appends the asynchronous Google script to the document head. Browser location,
DOM access and the analytics timestamp stay in UI; simulation and rendering
have no analytics dependency. No custom simulation events are added.

**Qualifies 002's external-service statement:** the public deployment now
optionally loads Google's analytics service. The application still runs
without it; no runtime package or backend is introduced. Local/static copies
outside the allowed URL retain their existing self-contained operation.

Focused Chromium checks serve the actual build at allowed and disallowed
browser URLs, verify the async script and initialization commands, and stub
external requests so test runs send no analytics events. These checks verify
the deployment gate, not receipt of events in the Google Analytics account.

Validation: `npm run build` and `npm test` passed with 137 headless/rendering
checks and 113 Chromium checks, including 24 analytics cases, plus one existing
skip. The browser suite covers both themes, desktop/phone layouts, keyboard
focus, assets and disabled controls. Both Vite development pages initialized
without errors and without analytics globals. `git diff --check` and the final
scope/dependency review passed. No deployment or live analytics-account
verification was performed.


## 055 — Replace the Google tag ID — 2026-09-19

At the user's request, `G-YWYZTQZ4V3` replaces `G-45PVLVFBRP` in both the
Google script URL and the configuration command. This supersedes only the tag
ID in 054; its exact HTTPS origin and `/emergence/` path restriction remain.
The README and existing browser expectations use the new ID. This change stays
within the browser adapter and does not alter simulation or rendering.

Validation: `npm run build`, `npm test` and `git diff --check` passed, with
137 headless/rendering checks and 113 Chromium checks plus one existing skip.
The analytics checks verify the new ID and the preserved URL restriction using
stubbed external requests; live analytics receipt and deployment were not tested.
