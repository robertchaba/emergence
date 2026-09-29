# Life model V5

V5 is active. Revision 3 doubles the previous 45-locus catalogue to **90 genes**,
adding conditional environmental, light-harvesting, locomotor, feeding, sensory,
defensive and reproductive strategies. All 45 additions have reversible levels
0–3, paid maintenance and construction, and context-dependent benefits. They
extend the existing finite-resource model rather than adding independent food,
water, oxygen or nutrient pools. The preserved V4 foundation and V5 browsing
refuge for undersized plant eaters remain.
Small browsers can obtain scarce food from tall plants, while increasing body
size improves both the accessible food fraction and collection efficiency.
V1–V4 remain independent, unchanged implementations. Shared geography, weather,
the 360-day calendar, three biological turns per ten days and playback speeds
retain their meanings.

Rules: `v5-populations-3`. Checkpoint: `emergence-life-v5-checkpoint-1`.
V5 rejects V1–V4 and earlier V5 rules checkpoints; no genomes or random streams
are silently migrated. Revision 3 requires a new run, while retaining model V5.
The active browser starts and restores current V5 runs only. V1–V4 saves require
their preserved implementations; earlier V5 saves require the earlier project
revision. Start a new run to use these rules.

- [Complete rules and approximations](docs/RULES.md)
- [90 genes and their tradeoffs](genes/docs/GENES.md)
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

Revision 2 introduced modestly increased hunting effort and smaller predator
founding populations only when actual animal intake funds viable founders.
Paid streamlining improves sustained aquatic hunting increasingly with body
size. Existing filter feeding also improves collection of smaller size-1–3
animal prey by moving water consumers. These traits share finite prey and retain
capture defenses; neither creates plankton or prescribes a whale lineage. Large
hunters still need enough local prey, and empty or depleted water cannot feed them.

One established genome describes a species. Integer populations and pooled
reserves occupy species/hex/habitat records. Up to three hypothetical adaptation
directions compete for acceptance across the whole species; they are never
counted as organisms. All resource allocation, gene effects, movement, selection
and species identity stay inside this version. Sexual reproduction remains an
aggregate recruitment strategy, not individual pairing or allelic recombination.
No predefined species, assigned biomes or species cap is introduced. Expanded
trait combinations can produce speculative organisms, but every trait consumes
existing resources and remains subject to ordinary extinction. The eight-trial
mutation budget is retained, so the larger catalogue takes longer to explore;
no new gene or combination is guaranteed to appear.

The V4 public API remains: `observe`, `observeAsync`, `inspectHex`,
`inspectSpecies`, `observeTree`, `inspectGeneHistory`, `exportState` and explicit
introduction/advancement. Compact observations, requested gene/tendency details,
local light shares, morphology and accepted-genome histories keep their common
meanings. The V5 traits appear through those same read-only observations
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
