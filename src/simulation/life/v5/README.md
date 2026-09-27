# Life model V5

V5 is active. It extends the preserved V4 population model with four browsing
traits (44 genes total) and a limited food refuge for undersized plant eaters.
Small browsers can obtain scarce food from tall plants, while increasing body
size improves both the accessible food fraction and collection efficiency.
V1–V4 remain independent, unchanged implementations. Shared geography, weather,
the 360-day calendar, three biological turns per ten days and playback speeds
retain their meanings.

Rules: `v5-populations-1`. Checkpoint: `emergence-life-v5-checkpoint-1`.
V5 rejects V1–V4 checkpoints; no genomes or random streams are silently migrated.
The active browser starts and restores V5 runs only. Start a new world to use V5;
older saves remain usable with their preserved model implementation.

- [Complete rules and approximations](docs/RULES.md)
- [44 genes and their tradeoffs](genes/docs/GENES.md)
- [Validation and balance limits](docs/VALIDATION.md)

```js
import { createLifeModel, restoreLifeModel } from './model.js';
const life = createLifeModel(world, { runId: 'session-1' });
life.introduce(selectedHexId);
life.advanceTo(world.day + 360);
const observation = life.observe();
const continued = restoreLifeModel(world, life.exportState());
```

Tree climbing, fallen-food foraging, branch pulling and extended reach each
partially offset the height mismatch, with context restrictions and paid costs.
Climbing can access at most 15% of otherwise unreachable production; all four
routes together are limited to 25%. They share the plant's existing production,
so neither adding traits nor adding species creates a separate food supply.
Once ordinary reach matches plant height, height penalties disappear and these
traits provide no further browsing benefit while continuing to incur costs.
These are selection pressures, not guaranteed survival or a prescribed outcome.

One established genome describes a species. Integer populations and pooled
reserves occupy species/hex/habitat records. Up to three hypothetical adaptation
directions compete for acceptance across the whole species; they are never
counted as organisms. All resource allocation, gene effects, movement, selection
and species identity stay inside this version. Sexual reproduction remains an
aggregate recruitment strategy, not individual pairing or allelic recombination.
No predefined species, assigned biomes or species cap is introduced.

The V4 public API remains: `observe`, `observeAsync`, `inspectHex`,
`inspectSpecies`, `observeTree`, `inspectGeneHistory`, `exportState` and explicit
introduction/advancement. Compact observations, requested gene/tendency details,
local light shares, morphology and accepted-genome histories keep their common
meanings. The four new traits appear through those same read-only observations
and English/Polish descriptions. Queries return detached data, do not advance
evolution and consume no randomness. Diagnostic listeners read no clocks and
cannot change results. Asynchronous helpers execute detached model-owned jobs;
worker timing and completion order cannot change the biological state.

The integer census is exact for represented state. Pooled energy, demographic
rates, density support, stress dormancy and candidate ranges are approximations.
There is no explicit soil nutrient pool, detritus or fruit store, seed bank, age
structure, individual social group, mating pair or individual recombination.
Browsing strategies describe access to current production, not physical branch
geometry. Costs and access coefficients are experimental game rules, not measured
biological constants. Earlier V4 balance measurements do not validate V5, and
no cross-browser numerical equivalence or universal evolutionary result is claimed.
