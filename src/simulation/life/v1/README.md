# Life model v1 — experimental implementation

V1 is implemented in [`model.js`](model.js). The preserved research below remains
the design history; the user's subsequent implementation request supersedes its
documentation-only status. [`docs/DECISIONS.md`](docs/DECISIONS.md) records the
resolved coefficients, initialization, feeding, continuity and approximations.
The default mode uses exact integer cohorts with stored energy rounded down to
1/64 units; `energyQuantum: 0` retains exact energy for comparison. Neither mode
has empirically calibrated ecological balance.

```js
import { createLifeModel, restoreLifeModel } from './model.js';

const life = createLifeModel(world, { runId: 'world-session-1' });
const result = life.introduce(selectedHexId);
// Inspect result.ok / result.reason; rejected commands do not alter the run.
life.advanceTo(world.day + 1);
const snapshot = life.observe();
const local = life.inspectHex(selectedHexId);
const checkpoint = life.exportState();
const continued = restoreLifeModel(world, checkpoint);
```

Advancement is headless and explicit. The model never calls browser services or
changes the shared world. Observations and checkpoints are detached serializable
data; complete checkpoints include the random stream, genomes, cohorts, species
and classification timers. Queries do not advance the model. A checkpoint is a
model-local continuation representation, not a version-independent saved-world
format. A caller supplies a distinct `runId` for each world session. Introduction
starts a fixed small colony of plants with genes matched to the selected site.
Living runs cannot reset or reseed. After extinction an explicit `introduce`
command may begin a new attempt at the completed physical day, with a new run ID
and archived prior attempt summary. A rejected command never changes state.

## Preserved pre-implementation assessment

This is the first candidate life/evolution model, reserved before implementation.
Its biological and approximation notes were moved from `docs/` on 2026-09-16.
They are proposals preserved for evaluation, not a claim that the model is
complete, implemented or balanced. Later candidates belong in sibling `v2/`,
`v3/`, etc., with the same [shared boundary](../README.md) and
[observation contract](../CONTRACT.md).

## Source map and authority

Model documentation lives in `docs/`. `genes/` is reserved for this model's gene
code, with gene descriptions in `genes/docs/`. No gene code is implemented yet.
The [common layout](../README.md#documentation-map) also applies to later models.

| Document | V1 responsibility |
| --- | --- |
| [Life summary, research v6](docs/evolution_simulation_summary_v6.md) | Habitat and adaptation, barriers as experienced by organisms, offspring dispersal, active movement, energy, feeding integration, daily order and founder proposal |
| [Evolution mechanics, research v3](docs/evolution_mechanics_summary_v3.md) | Inheritance, valid mutation changes, drift, genetic distance and species branching |
| [Starting genes, research v1](genes/docs/evolution_simulation_genes_v1.md) | Eight-trait catalogue and earlier feeding proposals where not superseded by the summaries |
| [Approximation strategies, research v1](docs/evolution_simulation_approximation_strategies_v1.md) | Reference individual model, exact cohorts, batching, optional lossy modes, profiling and validation recommendations |

The enclosing `v1/` is the model version; filename suffixes retain their original
research revisions. Mechanics v3 governs inheritance/classification, and summary
v6 governs ecological/spatial rules within this proposal. Earlier gene prose
does not override them: v6's adaptation factor replaces raw humidity scaling,
trunks prevent active movement, and movement begins as local random search, not
targeted pursuit. Unresolved conflicts require a model decision, not a hidden
implementation choice.

The original combined summary was split without relocating the shared physical
rules. Sections 1–4, the geographic part of 9, physical checks in 12 and shared
speed rules remain in [the world summary](../../../../docs/evolution_simulation_summary_v6.md).
Life-specific paragraphs from 1/4, sections 5–8 and 10–11, the classification part
of 9 and biological checks/examples in 12 are in the local summary. Original
section numbers remain traceable. The original notes' references to older v5/v2
documents and a readiness review are historical; those files are absent here.

## What belongs to this candidate

The proposal includes an aquatic photosynthetic founder, asexual inheritance,
eight traits, per-organism energy, mutation and dispersal probabilities, local
movement, feeding, and a persistent spatial/genetic species classifier. None of
those is a universal requirement on later models. Even the fixed per-hex light
budget and interpretation of geographic barriers are part of this candidate.

Population size and diversity would result from this model's births, deaths,
resource use and classification, not a number assigned by world generation or
rendering. Exact cohorts and statistical batching are proposed calculation
methods inside v1. Energy-bin approximations remain optional research requiring
validation, not a selected default or a shared approximation engine.

## Former open decisions before implementation

These historical open items are now resolved in [DECISIONS.md](docs/DECISIONS.md).
They are retained to explain what the original proposals left unspecified.

- **Start life here:** choose founder population/seeding density and initial
  energy, fully specify site viability and failure reasons, and settle repeated
  introduction/reset behavior. The existing founder genome/habitat is a proposal;
  current button enablement checks selection only, not biological suitability.
- **Production and reproduction:** calibrate the photosynthesis multiplier;
  define eligibility, the size-dependent reproduction cost, offspring count per
  eligible parent and payment rules. The summary explicitly identifies a
  default production/upkeep imbalance at multiplier 1.
- **Feeding:** specify processing capacity, density/encounter parameters,
  target eligibility and selection, conflict ordering, capture and prey energy
  value. Examples and suggested curves do not settle these details.
- **Bookkeeping and reproducibility:** settle deterministic group continuity,
  simultaneous classification ties, actor ordering, PRNG choice and complete
  continuation state before claiming reproducibility.
- **Approximation and display:** select methods only after a working reference
  and measurements; define tolerances and comparison scenarios. Map v1 traits
  and size to the common display observations, with mixed feeding roles and the
  small-plant threshold left for later instructions.

The [approximation note](docs/evolution_simulation_approximation_strategies_v1.md)
provides proposed validation cases. Existing atlas tests do not exercise these
rules. This documentation task does not resolve missing coefficients, authorize
implementation, add a population limit, or promise a particular evolutionary outcome.
