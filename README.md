# Emergence

A browser-based emergent evolution sandbox. Generate a world, seed life in one
hex, and observe how resources, inheritance, mutation, and seasons shape its
descendants. Geography supplies physical conditions; ecology emerges from life.
There are no predefined species or scripted outcomes.

**Current stage: physical world atlas.** Generate deterministic cylindrical hex
worlds, inspect drainage and spring-fed lakes, change the season, and explore
geographic regions. The landing page and both themes are preserved. Biological
simulation, organisms, and evolution are future work.

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
npm test         # Run headless checks, build, serve, and check Chromium
npm run test:headless # Check geography, climate, drainage, and map geometry
```

On Linux CI, `npx playwright install --with-deps chromium` also installs browser
system dependencies. `npm test` owns port 4173: stop a running preview first.
Test failures save screenshots and traces under `test-results/`.

Deploy the contents of `dist/` to a static host. Asset paths are relative so a
subdirectory deployment works. Preview is a local verification server.

## Project layout

```text
index.html               Landing, world setup, and accessible workspace controls
src/
  simulation/            Headless generation, drainage, climate, and regions
  rendering/             Canvas map and read-only geometry/hit testing
  ui/                    Browser composition, map input, theme controls, CSS tokens
tests/                   Node invariants and Playwright real-browser checks
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

## Explore a world

1. In **World setup**, choose a seed, size, geography, and land fraction. The
   default preview uses seed `emergence`, medium size, 50% geography, and 38% land.
2. Select **Generate world** after changing settings, then **Start** to open the
   workspace. Sizes are 24 × 16, 60 × 40, and 120 × 80; the last is the maximum.
3. Drag to pan, scroll or pinch to zoom from the fitted world to 32×, and click to
   pin a hex. Focus the map and use arrows to inspect neighboring cells, `+` / `−`
   to zoom, and `Escape` to clear the pin. East/west inspection wraps.
4. Switch between **Terrain**, **Elevation**, **Temperature**, **Humidity**, and
   **Regions**. The notebook reports physical facts for the pinned hex. Its Hex
   tab accepts arrow keys, Home, and End. On phones the notebook scrolls below
   the map; its day controls follow the inspector.
5. Enter a non-negative whole **Day** or use **+90 days** to inspect the seasons.
   A year has 360 days, beginning at the northern spring equinox. Hydrology and
   geographic regions stay fixed while temperature and land moisture change.
6. Use **Application menu → Fit world** to reset the view or **Return to World
   setup** to restore the setup screen and focus its Start button.

The preview's land budget counts the non-marine footprint before freshwater
lakes; dry land is reported separately. Spring discharge and runoff use reference
flow units. Humidity is a land-moisture index, with no value on sea or lake hexes.
Region colours and marked passes are geographic diagnostics; they do not prescribe
future organisms' movement or species. Neutral areas in the region view indicate
hard reference barriers such as permanent ice, high ridges, and wide deep ocean.

### Headless API

```js
import { generateWorld, setDay } from './src/simulation/world.js';

const world = generateWorld({
  seed: 'field-notes', size: 'small', geography: 0.25, landFraction: 0.38,
});
const summer = setDay(world, 90); // New snapshot; world is unchanged.
const serialized = JSON.stringify(summer);
```

Snapshots record the generator version, settings, selected candidate, hash
inputs, physical hex fields, drainage basins, regions, and their connections.
They contain ordinary serializable values. UI and rendering treat snapshots as
read-only; there is no browser save/load interface yet.

Generation is synthetic geography with a fixed, established groundwater-flow
approximation. It models neither tectonics nor erosion, evaporation, infiltration,
rainfall discharge, or progressive filling. Climate and barrier coefficients are
documented provisional defaults, not scientific calibration. A bounded search
reports failure if it cannot produce coherent land, rivers, and useful regions.

## Author and licence

Created by **Robert Chaba** — [robert.chaba@gmail.com](mailto:robert.chaba@gmail.com).
Repository: [robertchaba/emergence](https://github.com/robertchaba/emergence).

Licensed under the [BSD-3-Clause licence](LICENSE), copyright © 2026 Robert Chaba.
The build includes the full licence as `dist/LICENSE`, linked from the footer.

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

The architecture record identifies the specific generation and climate proposals
adopted in this step. The notes' biological rules remain research, not implemented
simulation behavior.
