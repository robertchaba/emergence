View the project at [https://robertchaba.github.io/emergence/](https://robertchaba.github.io/emergence/).

# Emergence

## About this project

Emergence is a browser-based evolution sandbox built around a simple question: what
happens if, instead of counting products, tickets and service times, I try to count
life?

My name is Robert Chaba. I am a programmer. In my day job, I count things - product
publications, service mean times, employee HR requests, and plenty of other numbers that
somehow need to end up in databases, reports and charts.

After work, I like to read and listen to what scientists have to say about the world.

Then AI arrived, and suddenly both coding and counting became much easier. One day a
thought crossed my mind: what if I use all of this to count something completely
different?

That idea became Emergence - an experiment in creating a tiny artificial world where
organisms inherit traits, mutate, compete for resources, spread across geography and,
perhaps, eventually become something new. There are no predefined species and no
scripted evolutionary paths. The idea is to define relatively simple rules and then
watch what emerges.

This project is 100% the work of an amateur. I have no biological background and do not
pretend that this is a faithful model of real evolution. I simply thought it would be
interesting to build one, watch it run, and see where the rules lead.

OpenAI's Astra model was used extensively while designing the model and creating much of
the engine that runs it.

If you find the project interesting, find me on
[GitHub](https://github.com/robertchaba). That's also the best place to find my contact
details - and I'd genuinely love to hear what you think.

## Project details

A browser-based emergent evolution sandbox. Generate a world, seed life in one
hex, and observe how resources, inheritance, mutation, and seasons shape its
descendants. Geography supplies physical conditions; ecology emerges from life.
There are no predefined species or scripted outcomes.

**Current stage: V3 population life simulation; V1 and V2 preserved.** Generate
deterministic cylindrical hex worlds, introduce a locally suited plant lineage
with seeded random traits, and observe competition, adaptation and branching.
V3 calculates populations per species and hex, with one established genome and
at most three possible adaptation directions per whole species. New lineages
need a sustained ecological advantage; temperature, habitat, moisture, elevation,
water depth and other species all affect success. The Field Notebook shows
inherited traits and estimated favourable ranges for possible adaptations.
The model is an explicit simplification, not calibrated biology.

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

Deploy the contents of `dist/` to a static host. Pages, artwork, styles, scripts,
workers and licence links use relative paths, including at
`https://robertchaba.github.io/emergence/`. The source HTML also uses relative
links, so GitHub Pages publishing directly from the repository root works.
The browser suite checks both arrangements under a strict subdirectory mount.
Preview is a local verification server.

Google tag `G-YWYZTQZ4V3` loads only on the HTTPS origin
`https://robertchaba.github.io` under `/emergence/`, including the world page.
Local development, previews, forks and other hosting paths do not load the tag.

## Project layout

```text
index.html               Landing page
world.html               World setup and accessible workspace controls
src/
  simulation/            Headless generation, drainage, climate, and regions
    life/                Common life-model boundary and observation contract
      v1/                Preserved first life model and historical research
      v2/                Preserved cohort life model and its research
      v3/                Active population model, 22 genes, rules and validation
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
Theme changes use a brief neon-like power flicker with uneven dimming and an
edge glow. Reduced motion switches immediately; rapid choices never stack effects.

The landing page presents the original logo over subtle circular lines, with
paper grain in light mode and a quiet green glow in dark mode. Theme and language
preferences occupy a small utility row. The theme icon opens System / Light / Dark
choices. **EN / PL** switches between English and Polish on the landing page,
during setup, and during atlas playback. Language selection is remembered when
storage is available. Switching language preserves the world, day, playback,
camera, selected layer, and pinned hex. Without JavaScript, static copy is English.

The **About this project** link in the landing and setup footers opens the project story in a
scrollable dialog, in English or Polish, with a GitHub profile link for contact.
Close it with **Close** or **Escape** to return to the page.

## Explore a world

1. Select **Create a world** to open the separate **World setup** page. Every
   entry gets a fresh seed, including returning from the atlas. Enter a seed to
   reproduce a world, or use **Randomize** beside the seed field.
2. Choose size, geography, land fraction, and **Lakes and rivers**. Changes update
   the preview automatically after a short input delay. Generation runs in a
   browser worker so the controls remain responsive. Sizes are Small (24 × 16),
   Medium (42 × 28, the default), and Large (60 × 40). The water slider increases
   spring abundance; actual rivers and lakes follow drainage and basins rather
   than an exact count.
3. The map previews the seasons automatically at 20 days per second. Select
   **Start** to open the atlas on **day 1**, paused. Both views
   start zoomed to fill their frame.
4. Drag to pan, scroll or pinch to zoom up to 32×, and click to
   pin a hex. Focus the map and use arrows to inspect neighboring cells, `+` / `−`
   to zoom, and `Escape` to clear the pin. East/west panning and inspection wrap
   endlessly around the cylinder; the poles remain separate. Minimum zoom adapts
   to the viewport so no hex appears twice, even partially at opposite edges.
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
   map at that minimum zoom. Zooming out otherwise preserves the zoom anchor.
   Use the logo menu's **Return to World setup** to build another world, then
   **Back to Emergence** to return to the landing page.

Use **Save world to file** in the logo menu to pause and download an
`emergence-day-….json` file. Any day batch already in progress finishes first;
the saved world stays paused. The file includes the world settings, complete
life checkpoint and history, day, speed, map layer, camera and pinned hex.
It also works before life has been introduced or after extinction.

Choose **Tree of life** in the same menu to pause and open the evolutionary
ledger. Lifespan lines connect every living and extinct species to its ancestors;
select a row for its description, population, family links and active genes.
Expand the time axis to inspect crowded branches. Earlier introductions are
available under **Explore other life introductions**, below the tree.

Click an active gene to trace the selected species back through its ancestors to
the gene’s first recorded appearance, without moving the screen. A labelled ring
marks that first appearance; bold names, coloured bands and connecting curves
follow its inherited path. Ancestor bands stop at the relevant split, excluding
later parental changes. Numerical labels and stepped widths show level changes.
**Show gene in all species** explicitly expands the highlight across the whole
tree. Every new gene or species selection returns to the ancestry view.
Categorical expressions use equal widths. Inactive periods stay uncoloured, and
missing history is marked explicitly. **View highlight in tree** offers an
explicit jump when the chart is offscreen; **Clear highlight** restores energy
colours.

A short summary identifies the first recorded presence in the selected ancestry.
**Open lineage history** opens a separate view with 20 records per page, including
inheritance, expression changes, losses and reappearances. **Back to tree** (or
**Escape** in history) restores the tree's selection and scroll position. History
follows the parent's genome at branching, including extinct ancestors; the chart
shows later parental changes only when **Show gene in all species** is enabled. New accepted
genomes are retained in save files; compatible older saves explicitly label
unrecorded history instead of inventing it. The ledger records established
species genomes, not hypothetical adaptation directions.
**Back to atlas** or **Escape** from the tree returns to the same atlas view,
resuming at the previous speed if playback was running when you entered. If it
was already paused, it stays paused. Theme and language controls remain available
throughout.

Choose **Restore a saved world** from the landing page, World setup or the logo
menu, select the downloaded file, then restore it. The landing-page button uses
the same light panel styling as World setup and opens the dialog over the
landing page. Cancelling or an invalid file leaves that page in place; a valid
upload opens the restored atlas directly. The restored world opens
paused; choose **Play** to continue. Invalid or incompatible files leave the
current world intact. Cancel also keeps it intact and paused. File handling
stays on your device and does not require browser storage or an account.
Theme and language follow your current preferences. Notebook disclosures and
trait highlights reset. Saves require compatible generator, weather and V3
rules versions; automatic migration from older simulation versions is not provided.

A year has 360 days, beginning at the northern spring equinox. Hydrology and
geographic regions stay fixed while temperature, land moisture, water surfaces and
ice cover respond to seasons and bounded seeded weather. The coastline remains fixed. Once
life is introduced, V2 executes **three biological turns per ten physical days**.
At 10×, temperature/calendar playback still targets 20 days/s while biology targets
6 turns/s (the previous 3× biological pace). This ratio applies at every speed.
A one-day step advances the climate; biology runs when its next turn is due.
Higher speed requests more days without changing event probabilities.

Pin any hex and select **Start life here** in the notebook.
The model introduces a small plant colony and chooses its initial habitat and
temperature traits from the selected location. There is no population-size input.
Ice, high mountains and energy-poor sites also accept founders; normal habitat
and energy rules determine whether they survive. Successful introduction sets the
speed to **10×** and starts playback automatically; **Pause** and the one-day step
control let you inspect descendants.

Living populations cannot be reset or replaced. If every organism dies, **Start
life here** becomes available again for an explicit new beginning on the same
world at the current day. Life is never introduced or restarted automatically.

The notebook shows the living-species count and its chart over the last 180
completed days of the current life attempt. The chart stacks photosynthesis, plant
feeding, animal feeding, and Other (mixed strategies or no acquisition system),
with current counts in its legend. Each living species counts once. Older saves
begin the breakdown from restoration; missing historical shares are not inferred.
Extinct species and the percentage of all hexes occupied appear as counts only.
Pinning a hex reveals compact physical readings and all species living there, or
an explicit empty-hex message. Species receive stable generated names. Each entry
shows a size label (for example, **Small** or **Large**) alongside its energy labels,
wrapping as needed, even when collapsed. Click a
name to open its total population, population on the selected hex (both in compact
notation, e.g. 21K), and present genes, and outline its whole occupied range;
click it again to clear the highlight and collapse its details. A sole local
species starts expanded with its range highlighted and can also be collapsed;
that choice survives live updates and theme/language changes. Reopening highlights
its range. The selected hex has a thick gold rim above the species and adaptation
highlights.
Coloured energy labels distinguish photosynthesis (green),
plant feeding (brown), and animal feeding (red); mixed feeders show each source.
When the selected hex uses its entire available light budget, each photosynthesis
label also shows that species' share of the light. Shares describe current light
capture before grazing; they disappear whenever any light remains unused. River
hexes must use both their land and water portions before showing percentages.
Established traits describe the whole species. Up to three
possible adaptations appear in a collapsed **Possible adaptations** section.
Expand it to see brief changes and estimated hex counts (`~`). Click a direction
to highlight those hexes; click again to clear it. Collapsing the section keeps
the current highlight; playback, language and theme changes preserve its open state.
These are prospective evolutionary directions, not exact carrier populations.
A major feeding-strategy change must establish a distinct lineage before it
affects living populations. Binary inherited traits show their carrier percentage;
selected controls use dark green in both themes. The common notebook still
supports partial carrier observations from the preserved older models.
Genomes list energy sources first, then body size, sexual reproduction when present,
and the remaining traits. Body size uses words only, from tiny to enormous, in both
languages. Live numerical readouts ease between observations over a brief transition;
reduced-motion preferences show each new value immediately. Selecting another hex
or species shows its values immediately. This animation only changes presentation.

Life always appears on the map as vivid green producer coverage at every body
size. Plants and animals retain separate size bands so abundant tiny organisms
cannot hide larger bodies. Zoom in to reveal 28 silhouette families, with separate
land and water forms: rosettes, ferns and branching canopies; aquatic ribbons,
fans and pads; stout walkers, segmented crawlers, streamlined swimmers and
bell-shaped drifters. Larger animals look bulkier and move with a slower cosmetic
pace and gait. Mixed feeders use violet for plant + animal feeding, teal for
photosynthesis + plant feeding, and rose for photosynthesis + animal feeding;
all three retain the earlier mauve. Mobile land groups follow curved paths;
water groups swim with undulating tails and fins. Bodies face their direction of
travel. Wide views keep simple coloured marks; details grow with body size and
zoom, without dark outlines.
Stationary plants and consumers stay still. Plants have a separate drawing budget
and appear beneath animals. Animation stops while paused, hidden, or using reduced motion, with smoother
motion at closer zoom. The marks are illustrative population samples, not tracked
individuals, measured anatomy or exact journeys; they stay inside occupied hexes.
Bare land keeps its softly warm stone greys in both themes.
On phones, pinning scrolls the local record into view; the
notebook scrolls independently. Theme and language changes preserve the run and
selection. Returning to setup and starting another world resets to day 1.
The notebook always reserves its vertical scrollbar, keeping its content width
steady as species details open and close.

The preview's land budget counts the non-marine footprint before freshwater
lakes; dry land is reported separately. Spring discharge and runoff use reference
flow units. Humidity is a land-moisture index, with no value on sea or lake hexes
in the physical model. The notebook displays water as **100% (water)**; this
presentation convention does not change the model's moisture readings.
Region colours and marked passes are geographic diagnostics; they do not prescribe
future organisms' movement or species. Neutral areas in the region view indicate
hard reference barriers such as permanent ice, high ridges, and wide deep ocean.

### Performance and workers

Playback sends a compact census/map snapshot. Opening a species loads its
inherited traits; expanding **Possible adaptations** calculates that species'
estimated ranges. Short loading messages are available in both languages.
Automatic playback publishes at most ten complete revisions per second, batching
the same simulated days without changing speed targets or biological updates.
The notebook reuses its chart when only inspection or selection changes.

Run **`npm run debugdev`** for detailed browser-console performance reports.
Edit [`degugdev-config.json`](degugdev-config.json) to select measurements and
console output separately, then restart the command and reload. Reports identify
simulation phases, observation/copying, helper work, UI updates and drawing, with
call counts, total/average/worst time and completed-world workload. Optional
detail covers genes, climate, grazing and hunting. Switches control diagnostics;
they never disable biological calculations. Normal dev and production stay quiet.
See the [profiling guide and optimization suggestions](docs/PERFORMANCE.md)
for individual phase overrides, timing interpretation and overhead limitations.

Playback uses up to **four life workers**: one coordinator owns the simulation,
and up to three helpers calculate independent adaptation-range scores for the
notebook. Dense workloads share that work; sparse worlds stay on the coordinator
because message preparation can cost more than it saves. The pool respects the
browser's reported concurrency, starts helpers lazily and falls back to one
worker if helpers fail. World generation still uses a separate temporary worker.

Worker count does not change biological rules, random draws, completed days or
save files. Movement and evolution remain ordered on the coordinator. This is
not a promise of fourfold speed or GPU acceleration.

To compare one worker with the adaptive four-worker path in Chromium:

```sh
npm run build
node scripts/benchmark-life-workers.js 4320
```

To compare full observations, collapsed details, inherited traits and open
adaptation ranges using identical production-worker simulations:

```sh
npm run build
node scripts/benchmark-life-observations.js 4320
```

This reports request/reply timings and snapshot sizes and checks exact checkpoint,
census and requested-detail equivalence. It excludes Canvas/DOM work and includes
a deliberately dense fixture, so its ratios are workload-specific.

The script checks complete state and observation equality. It reports production
worker timings including transport for an evolved small world and a deliberately
dense mixed-community fixture. It excludes map/DOM rendering; the fixture is a
computational stress case, not evidence of an evolved or balanced ecosystem.
See [decision 069](docs/ARCHITECTURE.md#069--adaptive-four-worker-observations--2026-09-24)
for measurements, boundaries and further optimization options.

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
import { createLifeModel, restoreLifeModel } from './src/simulation/life/v3/model.js';

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
locations. Checkpoints retain the complete biological PRNG, population reserves,
candidate directions and their persistence; a world seed alone cannot resume a
run. The browser save file wraps this checkpoint with world settings and view
state. V3 checkpoints are independent of V1/V2;
there is no automatic conversion or model-selection control.
See [V3 rules](src/simulation/life/v3/docs/RULES.md) for the aggregate demographic
calculation, evolutionary pressure, species criteria and experimental coefficients,
and [validation](src/simulation/life/v3/docs/VALIDATION.md) for measured limits.
V3 revision 5 modestly increases hunting effort and rewards larger grazers through
better access to tall plants. Small food retains an incentive for smaller bodies;
larger prey can favour larger predators through the existing prey-size limit.
It retains revision 4's adaptation to reachable empty land and rewards consumer
movement through foraging and a free first movement level, and supports smaller
viable carnivore populations with food-directed dispersal. Mixed-feeding costs
from revision 3 remain. Saves from earlier V3 rules are incompatible; start a new
world to use the revised biology.
Species diversity remains an outcome of the world;
there is no fixed count cap. To inspect a 60 × 40 world (now Large) through
80 simulated years,
run `node scripts/check-life-v3-balance.js 28800 large emergence water`.
Earlier validation records use the previous world-size names and generator version.
Run `node scripts/benchmark-life-v3.js 1440` (or `4320`) for the same-world
V2/V3 comparison and a fixed-record population-scaling check. It measures different
ecological trajectories, not identical outcomes or a universal speed guarantee.

Snapshots record the generator version, settings, selected candidate, hash
inputs, physical hex fields, drainage basins, regions, and their connections.
They contain ordinary serializable values. UI and rendering treat snapshots as
read-only. Save-file restoration regenerates this fixed geography from its
versioned settings and verifies the checkpoint's physical-world identity.

Generation is synthetic geography with a fixed, established groundwater-flow
approximation. It models neither tectonics nor erosion, evaporation, infiltration,
rainfall discharge, or progressive filling. Climate and barrier coefficients are
documented provisional defaults, not scientific calibration. A bounded search
reports failure if it cannot produce coherent land, rivers, and useful regions.

## Author and licence

Created by **Robert Chaba** — [find me on GitHub](https://github.com/robertchaba).
Repository: [robertchaba/emergence](https://github.com/robertchaba/emergence).

Licensed under the [BSD-3-Clause licence](LICENSE), copyright © 2026 Robert Chaba.
The build includes the full licence as `dist/LICENSE`, linked from the footer.

## Documentation

Shared world rules and the decision record stay in **`docs/`**, despite the
original brief's `/documents` path. Life/evolution and approximation research is
now under **`src/simulation/life/v1/docs/`**, with gene descriptions in
**`src/simulation/life/v1/genes/docs/`** and gene code in the enclosing
**`genes/`** directory. V2 research remains in its own sibling directory.
Active V3 has rules in **`src/simulation/life/v3/docs/`** and its gene catalogue
in **`src/simulation/life/v3/genes/docs/GENES.md`**, while keeping the same physical
world and common UI data contract.
Research filename suffixes retain their original revisions; they are separate
from the enclosing life-model version.

- [Architecture and decision record](docs/ARCHITECTURE.md)
- [Contributor contract](AGENTS.md)
- [Shared world, climate, and playback rules](docs/evolution_simulation_summary_v6.md)
- [Life-model ownership and versioning](src/simulation/life/README.md)
- [Universal life observations and UI commands](src/simulation/life/CONTRACT.md)
- [Active V3 model](src/simulation/life/v3/README.md)
- [V3 rules](src/simulation/life/v3/docs/RULES.md)
- [V3 genes](src/simulation/life/v3/genes/docs/GENES.md)
- [V3 validation](src/simulation/life/v3/docs/VALIDATION.md)
- [Preserved V2 model](src/simulation/life/v2/README.md)
- [V2 rules](src/simulation/life/v2/docs/RULES.md)
- [V2 genes](src/simulation/life/v2/genes/docs/GENES.md)
- [V2 validation and pacing](src/simulation/life/v2/docs/VALIDATION.md)
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
rules; V2's rules and validation record describe current biological defaults and limits.
V1's `DECISIONS.md` and implementation remain preserved unchanged by the V2 step.
The original research remains preserved. The common contract defines consistent
world/species/hex counts without fixing another model's biology.
