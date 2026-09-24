# Life model V3

V3 is the active population-based life model. V1 and V2 remain preserved in their
own directories; V3 imports neither implementation and cannot restore their
checkpoints. It uses the same physical world, climate, 360-day calendar, three
biological turns per ten days, and browser playback controls.

Rules: `v3-populations-5`. Checkpoint: `emergence-life-v3-checkpoint-1`.
Revision 5 increases hunting effort by 12.5% and replaces the grazing height
cutoff with partial canopy access: greater reach improves both accessible food
and foraging efficiency on tall plants. Small food still favours smaller bodies;
larger prey already requires sufficient predator size under the existing rule.
Finite resources, defenses, conversion losses and body costs remain in force.
Revision 1–4 checkpoints are rejected rather than continued under different rules.

Retained revision 4 behavior includes reachable habitats in adaptation pressure,
a cost-free first consumer movement level, movement-assisted grazing, food-directed
consumer dispersal, and smaller viable carnivore founding populations.
Revision 3's mixed-feeding changes remain documented in the rules and validation
history.

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

`observeAsync(execute)` optionally delegates detached, read-only observation jobs
to an executor. `observation-jobs.js` owns their ecological calculations and cost
estimate. The browser treats the payload as opaque and schedules up to three
helpers alongside the coordinator. Sparse observations use `observe()` directly.
Commands must be serialized until the query completes; a superseded query is
rejected. Scores never enter checkpoints or consume randomness, and the returned
observation has the same contents as `observe()`. This changes execution only;
rules revision, checkpoint format and synchronous headless APIs are preserved.

The browser's save/restore adapter carries this complete checkpoint without
interpreting population or genome records. Restore validates required metadata,
clocks, counters, histories, PRNG words, species, candidates and populations
before constructing a model. Missing random state is rejected rather than
silently restarting the seeded stream. This validation does not change valid
checkpoint behavior or the rules revision.

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


## Energy-source census

Map display groups also expose `energySources`: the enabled photosynthesis,
plant-feeding and animal-feeding capabilities of the established genome. All
eight combinations remain separate even when role, size, habitat and mobility
match. This detached observation allows distinct mixed-diet colours; it does
not change ecological rules, broad roles, checkpoints or random state.

Current counts and new daily history expose `speciesByEnergy`: photosynthesis,
plant feeding, animal feeding, and other. The model counts each established
living identity once using its existing phenotype role; mixed and zero-system
species belong to other. Candidate directions and occupied locations do not add
species. This observation-only extension leaves the rules revision and random
stream unchanged. Old checkpoints remain compatible; absent past breakdowns
remain unavailable, and new daily samples include the partition.

## Tree of life and inherited gene history

`observeTree()` exposes all introductions and their living/extinct species as
detached, described observations. `inspectGeneHistory(runId, speciesId, key)`
traces an established trait through that introduction's ancestry, including
accepted within-species changes, loss and reacquisition. The parent revision
at branching determines what was inherited; later parental adaptations are
excluded. Candidates have no accepted history and are not included.

Species checkpoints now retain optional `genomeHistory` entries containing the
accepted genome, explicit day, genome revision, event kind and (at branching)
parent genome revision. Founding and accepted adaptations append entries without
random draws or ecological changes. Extinct species and previous attempts retain
them. Restore validates history and acyclic, temporally consistent ancestry.

This metadata extension preserves `v3-populations-5` and checkpoint format 1.
Compatible older checkpoints without gene history remain loadable. Queries show
their earliest available snapshot as incomplete; new accepted changes record
history from that point. Missing ancestral revisions are never reconstructed
from a parent's later genome. History is retained without truncation, so long
evolutionary runs produce larger saves. The tree is fetched on demand rather
than added to every normal playback observation.

Gene inspection also returns compressed expression records for every branch in
the requested introduction, so the tree can highlight presence and level changes
through each species' own lifetime. `quantitative` identifies numerical levels;
structural/habitat categories, thermal preferences and on/off switches use equal
visual weight. The selected ancestry still excludes later parent changes, while
whole-tree branch records preserve them. This is a detached read-only projection;
no biology, checkpoint format or retention policy changes.

The `lineage` projection supplies the default gene highlight: the selected
inherited path beginning with its earliest recorded active expression. Ancestor
segments stop at the inherited split; losses and reacquisitions within that path
remain recorded. Full-lifetime `branches` remain available for the optional
all-species view. Both projections are read-only and share the same completeness
limits as the accepted historical record.
