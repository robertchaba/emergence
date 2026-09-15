# Architecture and decision record

## Status

**Foundation accepted for implementation — 2026-09-15.** This repository currently
contains one static landing page with theme controls. There is no engine,
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
