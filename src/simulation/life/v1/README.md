# Life model v1 — research candidate

This is the first candidate life/evolution model, reserved before implementation.
Its biological and approximation notes were moved from `docs/` on 2026-09-16.
They are proposals preserved for evaluation, not a claim that the model is
complete, implemented or balanced. Later candidates belong in sibling `v2/`,
`v3/`, etc., with the same [shared boundary](../README.md) and
[observation contract](../CONTRACT.md).

## Source map and authority

| Document | V1 responsibility |
| --- | --- |
| [Life summary, research v6](evolution_simulation_summary_v6.md) | Habitat and adaptation, barriers as experienced by organisms, offspring dispersal, active movement, energy, feeding integration, daily order and founder proposal |
| [Evolution mechanics, research v3](evolution_mechanics_summary_v3.md) | Inheritance, valid mutation changes, drift, genetic distance and species branching |
| [Starting genes, research v1](evolution_simulation_genes_v1.md) | Eight-trait catalogue and earlier feeding proposals where not superseded by the summaries |
| [Approximation strategies, research v1](evolution_simulation_approximation_strategies_v1.md) | Reference individual model, exact cohorts, batching, optional lossy modes, profiling and validation recommendations |

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

## Open decisions before implementation

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

The [approximation note](evolution_simulation_approximation_strategies_v1.md)
provides proposed validation cases. Existing atlas tests do not exercise these
rules. This documentation task does not resolve missing coefficients, authorize
implementation, add a population limit, or promise a particular evolutionary outcome.
