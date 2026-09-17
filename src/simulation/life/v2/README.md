# Life model V2

V2 is the application's active experimental evolution model. V1's source and
research remain separately preserved in `../v1/`; V2 neither imports V1 nor
migrates its checkpoints. Both versions use the common physical atlas, explicit
360-day calendar, playback meanings, and detached observation contract.

- [Complete biological rules](docs/RULES.md)
- [Isolation, passage and species identity](docs/ISOLATION.md)
- [All genes, costs and inheritance](genes/docs/GENES.md)
- [Validation and reproducible balance panel](docs/VALIDATION.md)

```js
import { createLifeModel, restoreLifeModel } from './model.js';
const life = createLifeModel(world, { runId: 'session-1' });
life.introduce(selectedHexId);
life.advanceTo(world.day + 360);
const observations = life.observe();
const continued = restoreLifeModel(world, life.exportState());
```

`modelId: v2`, `rulesRevision: v2-cohorts-2`, checkpoint format
`emergence-life-v2-checkpoint-1`. The format name is unchanged, but checkpoints
from `v2-cohorts-1` are incompatible with the current rules and are rejected.
`energyQuantum: 0` selects unrounded energy cohorts; the default rounds stored
energy down in steps of 1/64. Both modes use the compact variant representation.
Queries never
advance time or consume the biological random stream. No organisms, species,
biomes, intelligence, or successful evolutionary outcomes are preassigned.

Each local pool retains at most three complete genomes: the two most abundant
and one candidate selected by a stable seeded, population-weighted ticket.
Pools separate species, hexes, habitats, acquisition niches and pending passage
plans. This is a budget per comparable pool, not a global or per-species limit.
Excess carriers adopt the nearest retained genome without changing their counts,
locations or species IDs. Counts are exact for this represented population;
genetic frequencies, phenotypes and body investment are approximate. Historical
genome records remain available in checkpoints. See the [compact variation
rules](docs/RULES.md#compact-local-variation) for the algorithm and its limits.

Persistent divergence now qualifies after 60 barrier, 90 ecological or 120
distance-isolation turns, with the existing population and genetic-distance
requirements. Filling variant slots never creates a species. The earlier
5–15-year first-branch target and its measured panel belong to `v2-cohorts-1`;
they do not establish pacing for the compact revision. No first-branch deadline
or successful diversification is guaranteed.
