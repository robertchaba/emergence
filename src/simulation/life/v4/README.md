# Life model V4

V4 is active. It extends the preserved V3 population model with 18 new genes
(40 total), stronger selection for sexual reproduction and modestly fiercer
resource competition. V1, V2 and V3 remain independent, unchanged implementations.
Shared geography, weather, the 360-day calendar, three biological turns per ten
days and playback speeds retain their meanings.

Rules: `v4-populations-1`. Checkpoint: `emergence-life-v4-checkpoint-1`.
V4 rejects V1/V2/V3 checkpoints; no genomes or random streams are silently migrated.
The active browser starts and restores V4 runs only.

- [Complete rules and approximations](docs/RULES.md)
- [40 genes and their tradeoffs](genes/docs/GENES.md)
- [Validation and diversity measurements](docs/VALIDATION.md)

```js
import { createLifeModel, restoreLifeModel } from './model.js';
const life = createLifeModel(world, { runId: 'session-1' });
life.introduce(selectedHexId);
life.advanceTo(world.day + 360);
const observation = life.observe();
const continued = restoreLifeModel(world, life.exportState());
```

One established genome describes a species. Integer populations and pooled
reserves occupy species/hex/habitat records. Up to three hypothetical adaptation
directions compete for acceptance across the whole species; they are never
counted as organisms. All resource allocation, gene effects, movement, selection
and species identity stay inside this version. Sexual reproduction is an aggregate
recruitment strategy, not individual pairing or explicit allelic recombination.
No predefined species, assigned biomes, guaranteed adaptations or species cap
are introduced. The requested 60–70 living species near day 15,000 is a balance
target whose measured scope is reported in validation, not a world invariant.

The full V3 public API remains: `observe`, `observeAsync`, `inspectHex`,
`inspectSpecies`, `observeTree`, `inspectGeneHistory`, `exportState` and explicit
introduction/advancement. Compact observations, requested gene/tendency details,
local light shares and accepted-genome histories keep their common meanings.
Queries return detached data, do not advance evolution and consume no randomness.
Optional diagnostic listeners read no clocks and cannot change model results.
Asynchronous helpers execute detached model-owned ecological jobs; worker timing
and completion order cannot change the biological state.

Map display groups additionally contain `morphology: { form, pattern, social }`.
These describe broad visible expression, without prescribing renderer geometry
or colours. Groups with distinct morphology remain separate. The renderer uses
this optional description to vary silhouette, surface markings and spacing;
older observations retain their existing visual vocabulary. These are illustrative
population samples, not individually tracked bodies.

The integer census is exact for represented state. Pooled energy, demographic
rates, density support, stress dormancy and candidate ranges are approximations.
The model has no explicit soil nutrient pool, stored seed bank, age structure,
individual social groups, mating pairs or individual recombination. Gene costs
are experimental game rules, not measured biological constants. Validation does
not establish cross-browser numerical equivalence or calibrated biology.
