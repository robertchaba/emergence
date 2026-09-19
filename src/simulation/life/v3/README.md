# Life model V3

V3 is the active population-based life model. V1 and V2 remain preserved in their
own directories; V3 imports neither implementation and cannot restore their
checkpoints. It uses the same physical world, climate, 360-day calendar, three
biological turns per ten days, and browser playback controls.

Rules: `v3-populations-2`. Checkpoint: `emergence-life-v3-checkpoint-1`.
Revision 2 tunes hunting, movement and ecological distinction; revision 1
checkpoints are rejected rather than silently continued under different rules.

- [Population, ecology and evolution rules](docs/RULES.md)
- [All 22 genes and their tradeoffs](genes/docs/GENES.md)
- [Validation and performance measurements](docs/VALIDATION.md)

```js
import { createLifeModel, restoreLifeModel } from './model.js';
const life = createLifeModel(world, { runId: 'session-1' });
life.introduce(selectedHexId);
life.advanceTo(world.day + 360);
const observation = life.observe();
const continued = restoreLifeModel(world, life.exportState());
```

`inspectHex(id)` and `inspectSpecies(id)` expose the same completed observation
revision. Queries return detached data and never consume randomness. The model
owns founder selection, all gene effects, ecological scores, demographic
approximations, movement and species identity. No ecological biome or species is
assigned by geography.

## What is represented

One established genome describes each species. Sparse records hold integer
population and pooled reserves per species, hex and habitat; river hexes can
support separate land/water components. There are no per-organism actions,
per-variant populations, energy cohorts or individual journeys.

Each species retains at most three candidate directions for adaptation across
its entire range. These represent possible genetic variation without claiming
to know carrier counts or locations. Their favourable ranges are estimated from
local ecological performance at the completed observation. The notebook labels
them separately from inherited traits. Directions do not feed, reproduce or
count as species. A feeding-strategy change only enters living state through
an accepted distinct lineage.

The integer census is exact for this represented population. Pooled reserves,
aggregate demographic events, candidate directions, and inferred ranges are
approximations. They do not reconstruct individual variation or promise the
same trajectories as V2. Ecological coefficients are experimental model choices;
survival, diversification and eventual outcomes are not guaranteed.
