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
index.html               Landing page
world.html               World setup and accessible workspace controls
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
preferences occupy a small utility row. The theme icon opens System / Light / Dark
choices. **EN / PL** switches between English and Polish on the landing page,
during setup, and during atlas playback. Language selection is remembered when
storage is available. Switching language preserves the world, day, playback,
camera, selected layer, and pinned hex. Without JavaScript, static copy is English.

## Explore a world

1. Select **Create a world** to open the separate **World setup** page. Every
   entry gets a fresh seed, including returning from the atlas. Enter a seed to
   reproduce a world, or use **Randomize** beside the seed field.
2. Choose size, geography, land fraction, and **Lakes and rivers**. Changes update
   the preview automatically after a short input delay. Generation runs in a
   browser worker so the controls remain responsive. Sizes are 24 × 16,
   60 × 40, and 120 × 80. The water slider increases spring abundance; actual
   rivers and lakes follow drainage and basins rather than an exact count.
3. The map previews the seasons automatically at 20 days per second. Select
   **Start** to open the atlas at the current day, initially paused. Both views
   start zoomed to fill their frame.
4. Drag to pan, scroll or pinch to zoom from the fitted world to 32×, and click to
   pin a hex. Focus the map and use arrows to inspect neighboring cells, `+` / `−`
   to zoom, and `Escape` to clear the pin. East/west inspection wraps. Edge hexes
   appear whole in the fitted view; zooming fully out also centers that outline.
5. Open the **Emergence / Field atlas** logo menu to choose **Terrain**,
   **Elevation**, **Temperature**, **Moisture**, or **Regions**. The wider notebook
   on the right occupies the full window height and shows terrain, ground/seabed
   elevation, temperature, and moisture for the pinned hex. The top and bottom
   control bars occupy only the map side. On phones the notebook sits below the map.
6. The bottom bar shows the **Day** and **Running / Paused** status on the left,
   **Play / Pause** and a speed
   short slider in the center, target and actual speed side by side, and zoom
   controls on the right. **1× = 2 days/s**;
   **10× = 20 days/s** is the maximum target. Actual speed is measured from days
   advanced over elapsed time and may be lower on a busy device. Hidden tabs
   stop advancing and do not catch up when reopened.
7. **Center** restores the map position at the current zoom. **Fit** centers the
   complete hex outline at the largest scale that fits the available map area.
   Use the logo menu's **Return to World setup** to build another world, then
   **Back to Emergence** to return to the landing page.

Playback currently changes climate only. A year has 360 days, beginning at the
northern spring equinox. Hydrology and geographic regions stay fixed while
temperature and land moisture change; biological simulation is future work.

Below the hex details, the notebook includes a **Start life here** panel with a
short explanation. Its button is enabled for design review but has no action yet;
life seeding is not implemented.
On phones, scroll within the notebook to see the panel.

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
  waterAbundance: 0.5, // 0–1; default retains the original spring density.
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
