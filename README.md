# Emergence

A browser-based emergent evolution sandbox. Generate a world, seed life in one
hex, and observe how resources, inheritance, mutation, and seasons shape its
descendants. Geography supplies physical conditions; ecology emerges from life.
There are no predefined species or scripted outcomes.

**Current stage: foundation only.** The static landing page establishes the
branding and two themes. The Start button is disabled. World generation,
simulation rules, and map rendering will be designed in later steps.

## Run locally

Tooling requires **Node 22.12 or newer** and npm. Visitors need only a modern
browser; the application has no backend or runtime package dependencies.

```sh
npm ci
npx playwright install chromium
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

```sh
npm run build    # Produce a static dist/ directory
npm run preview  # Serve dist/ locally, normally on port 4173
npm test         # Build, serve, and run Chromium smoke checks
```

On Linux CI, `npx playwright install --with-deps chromium` also installs browser
system dependencies. `npm test` owns port 4173: stop a running preview first.
Test failures save screenshots and traces under `test-results/`.

Deploy the contents of `dist/` to a static host. Asset paths are relative so a
subdirectory deployment works. Preview is a local verification server.

## Project layout

```text
index.html               Static landing page and accessible controls
src/
  simulation/            Reserved: headless, deterministic rules
  rendering/             Reserved: read-only snapshot presentation
  ui/                    Browser composition, theme controls, CSS tokens
tests/                   Playwright real-browser checks
resources/               Original logos and reference mockups
docs/                    Research notes and architecture decisions
AGENTS.md                Contributor and coding-agent contract
```

The application uses plain JavaScript ES modules and native HTML/CSS. Vite and
Playwright are development dependencies only. System fonts keep the page
self-contained. Light and dark are complete themes; System follows the device
preference, and an explicit choice is remembered when browser storage is available.

The landing page presents the original logo over subtle circular lines, with
paper grain in light mode and a quiet green glow in dark mode. Theme and language
preferences occupy a small utility row. English is available; the disabled PL
control reserves a place for a future Polish translation.

## Author and planned release

Created by **Robert Chaba** — [robert.chaba@gmail.com](mailto:robert.chaba@gmail.com).
Repository: [robertchaba/emergence](https://github.com/robertchaba/emergence).

The repository is currently private. A public release under a BSD licence is
planned when the sandbox is working and published; this is a release intention,
not a licence grant for the current checkout.

**Recommendation: BSD-3-Clause.** Like BSD-2-Clause and MIT, it permits broad reuse
subject to preserving the required notices. Its extra non-endorsement condition
prevents the author's or contributors' names from being used to promote derived
products without permission. BSD-2-Clause is the simpler BSD option; MIT is
another short permissive option. The BSD variant remains to be confirmed before
adding the release's `LICENSE` file and package licence metadata.
See the canonical [BSD-3-Clause](https://spdx.org/licenses/BSD-3-Clause.html),
[BSD-2-Clause](https://spdx.org/licenses/BSD-2-Clause.html), and
[MIT](https://spdx.org/licenses/MIT.html) texts.

## Documentation

The supplied research notes are in **`docs/`**, despite the original brief's
`/documents` path. They have been preserved in place.

- [Architecture and decision record](docs/ARCHITECTURE.md)
- [Contributor contract](AGENTS.md)
- [World and ecology research](docs/evolution_simulation_summary_v6.md)
- [Inheritance and mutation research](docs/evolution_mechanics_summary_v3.md)
- [Starting trait research](docs/evolution_simulation_genes_v1.md)
- [Approximation and performance research](docs/evolution_simulation_approximation_strategies_v1.md)
- [Original staged prompts](docs/prompts.md)

These notes inform later design work; their numerical defaults and proposed
algorithms are not implemented or adopted by this setup step.
