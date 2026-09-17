# Emergence

A browser-based emergent evolution sandbox. Generate a world, seed life in one
hex, and observe how resources, inheritance, mutation, and seasons shape its
descendants. Geography supplies physical conditions; ecology emerges from life.
There are no predefined species or scripted outcomes.

**Current stage: working v1 life simulation.** Generate deterministic cylindrical
hex worlds, introduce a locally suited plant lineage, and observe resource competition,
inheritance, mutation, dispersal, and species branching. The Field Notebook shows
living and extinct species, their history, and the present traits of local species. V1 is an
experimental model with documented approximations, not calibrated biology.

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
npm run test:headless # Check physical rules, life rules, and rendering
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
    life/                Common life-model boundary and observation contract
      v1/                First life model, genes, research, and implementation decisions
  rendering/             Canvas map and read-only geometry/hit testing
  ui/                    Browser composition, map input, theme controls, CSS tokens
tests/                   Node invariants and Playwright real-browser checks
resources/               Original logos and reference mockups
docs/                    Shared world rules, architecture, and historical prompts
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
   **Start** to open the atlas on **day 1**, paused. Both views
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

A year has 360 days, beginning at the northern spring equinox. Hydrology and
geographic regions stay fixed while temperature and land moisture change. Once
life is introduced, v1 executes **three biological turns per ten physical days**.
At 10×, temperature/calendar playback still targets 20 days/s while biology targets
6 turns/s (the previous 3× biological pace). This ratio applies at every speed.
A one-day step advances the climate; biology runs when its next turn is due.
Higher speed requests more days without changing event probabilities.

Pin a suitable land or water hex and select **Start life here** in the notebook.
The model introduces a small plant colony and chooses its initial habitat and
temperature traits from the selected location. There is no population-size input.
An unsuitable site receives an explanation. Successful introduction starts playback
automatically; **Pause** and the one-day step control let you inspect descendants.

Living populations cannot be reset or replaced. If every organism dies, **Start
life here** becomes available again for an explicit new beginning on the same
world at the current day. Life is never introduced or restarted automatically.

The notebook shows the living-species count and its chart over the last 180
completed days of the current life attempt. Extinct species and the percentage
of all hexes occupied appear as counts only.
Pinning a hex reveals compact physical readings and all species living there, or
an explicit empty-hex message. Species receive stable generated names. Click a
name to open its genome portrait directly below the name, followed by its compact
population count (e.g. 21K) and present genes, and outline its whole occupied range;
click it again to clear the highlight. A sole local species opens automatically, with highlighting still
requiring a click. Gene expressions
carried by only part of the species appear in lighter text with their percentage.
Expressions below 2% of the species population are hidden but remain in the model.
Expressions covering at least 98% of the population are plain values; partial
expressions below that threshold can be clicked to highlight their carrier hexes
in pale green, with a dark-green dashed border inside the light species outline.
Click again to clear only the carrier highlight. Binary traits show their carrier
percentage, without a redundant “Present” label. Selected controls use dark green
in both themes.
The portrait uses the most populous complete genome.

Life always appears on the map as vivid green plant coverage and coloured dots
without dark outlines. Bare land uses softly warm stone greys in both themes.
Mobile groups have subtle motion and small appendages at closer zoom;
this stops while paused, hidden, or using reduced motion. These marks represent
population groups. On phones, pinning scrolls the local record into view; the
notebook scrolls independently. Theme and language changes preserve the run and
selection. Returning to setup and starting another world resets to day 1.

The preview's land budget counts the non-marine footprint before freshwater
lakes; dry land is reported separately. Spring discharge and runoff use reference
flow units. Humidity is a land-moisture index, with no value on sea or lake hexes
in the physical model. The notebook displays water as **100% (water)**; this
presentation convention does not change the model's moisture readings.
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

Life is a separate model with its own explicit commands:

```js
import { createLifeModel, restoreLifeModel } from './src/simulation/life/v1/model.js';

const life = createLifeModel(world);
const result = life.introduce(selectedHexId);
if (result.ok) {
  life.advanceTo(world.day + 360); // Completes every biological day.
  const observation = life.observe(); // Detached, serializable observation.
  const continued = restoreLifeModel(world, life.exportState());
  continued.advanceTo(observation.day + 1);
}
```

`inspectHex(id)` and `inspectSpecies(id)` expose consistent local counts and
locations. Checkpoints retain the complete biological PRNG and classification
state; a world seed alone cannot resume a run. Browser save/load is not provided.
See [v1 decisions](src/simulation/life/v1/docs/DECISIONS.md) for experimental
coefficients, cohort representation, energy rounding, and validation limits.

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

Shared world rules and the decision record stay in **`docs/`**, despite the
original brief's `/documents` path. Life/evolution and approximation research is
now under **`src/simulation/life/v1/docs/`**, with gene descriptions in
**`src/simulation/life/v1/genes/docs/`** and gene code in the enclosing
**`genes/`** directory. Later models will use the same layout in sibling version
folders while keeping the same physical world and common UI data contract.
Research filename suffixes retain their original revisions; they are separate
from the enclosing life-model version.

- [Architecture and decision record](docs/ARCHITECTURE.md)
- [Contributor contract](AGENTS.md)
- [Shared world, climate, and playback rules](docs/evolution_simulation_summary_v6.md)
- [Life-model ownership and versioning](src/simulation/life/README.md)
- [Universal life observations and UI commands](src/simulation/life/CONTRACT.md)
- [Life model v1 implementation and research](src/simulation/life/v1/README.md)
- [V1 habitats, movement, energy, and initialization](src/simulation/life/v1/docs/evolution_simulation_summary_v6.md)
- [V1 inheritance and species classification](src/simulation/life/v1/docs/evolution_mechanics_summary_v3.md)
- [V1 starting traits](src/simulation/life/v1/genes/docs/evolution_simulation_genes_v1.md)
- [V1 implementation choices and approximations](src/simulation/life/v1/docs/DECISIONS.md)
- [V1 approximation and performance research](src/simulation/life/v1/docs/evolution_simulation_approximation_strategies_v1.md)
- [Life rendering conventions](src/rendering/LIFE.md)
- [Original staged prompts](docs/prompts.md)

The combined v6 summary has been split by ownership, retaining original section
numbers for traceability. The architecture record identifies adopted physical and integration
rules; v1's `DECISIONS.md` records biological defaults and approximation limits.
The original research remains preserved. The common contract defines consistent
world/species/hex counts without fixing another model's biology.
