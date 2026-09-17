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

`modelId: v2`, `rulesRevision: v2-cohorts-1`, checkpoint format
`emergence-life-v2-checkpoint-1`. `energyQuantum: 0` selects unrounded energy
cohorts; the default rounds stored energy down in steps of 1/64. Queries never
advance time or consume the biological random stream. No organisms, species,
biomes, intelligence, or successful evolutionary outcomes are preassigned.

The requested pacing target is a first branch around 5–15 simulated years on a
suitable starting site, with substantial seed variation. This is an exploratory
balance target, not a clock that forces speciation or protects founders.
