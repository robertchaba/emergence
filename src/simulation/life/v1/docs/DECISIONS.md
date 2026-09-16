# V1 implementation decisions — 2026-09-16

The user authorized implementation and judgement on unresolved choices, including
performance approximations. This record resolves the open items in the preserved
research; numerical values are model choices, not measured biological constants.
The implemented identity is `v1`, rules revision `v1-cohorts-1`.

1. **Introduction — revised by the user's subsequent direction.** Begin with
   one plant lineage of 20 size-3 photosynthetic founders; colony count and body
   size are internal constants, with no player density or size setting. Founders
   have no trunk, movement or feeding genes and start with their 19-cell reserve.
   Match the starting genes to the selected site's current conditions: sea, lake
   and river sites use aquatic habitat; ordinary land uses the least land-
   adaptation state providing full moisture efficiency (1 at ≥0.85, 2 at ≥0.50,
   otherwise 3). Coastal direct-water access counts normally. Temperature tolerance
   maximizes the current efficiency, tied in order absent, 0, −1, +1, −2, +2.
   This is a deliberate introduction choice; later inheritance and mutation never
   retune a living organism to its surroundings. Reject permanent ice, unsupported
   high land, or conditions preventing positive uncrowded production after upkeep.
   Crowding and future weather can still cause extinction. Living runs cannot be
   reseeded or reset. After extinction the user may explicitly start again at the
   same completed physical day: a new attempt gets a new run identity, fresh
   deterministic random stream and counters/history. Archive the previous extinct
   attempt's metadata, species and lifetime counters. Rejected attempts preserve
   all state and randomness. No attempt starts automatically. This supersedes the
   earlier aquatic-only, configurable-density, manual-reset implementation decision
   and the research's fixed unadapted aquatic founder.

2. **Production and births.** Photosynthesis multiplies absorbed light by 2.4
   and the research temperature/habitat factors. This permits the uncrowded founder
   to cover its 20-unit baseline upkeep (adaptation adds its normal gene cost).
   Each parent can pay for at most one asexual birth
   daily after upkeep, at `cells × (1 + 0.1 × (size − 1))` energy. Larger bodies
   thus pay a larger per-cell construction cost. The full cost is spent before
   mutation or dispersal. Newborns have zero energy and join after all adult
   actions. They first act the next day. There is no hidden capacity, demographic
   growth formula, lifespan, forced mutation, or guaranteed surviving lineage.

3. **Grazing.** Consumers and food must occupy the same habitat. Each grazer
   independently finds food with `D² / (D² + 20²)`, where D counts local producers
   excluding itself. Only successful grazers share food, in proportion to their
   processing capacity `4 × cells × acquisition share`. Producers supply at most
   20% of their own current production. When supply is limited, all producers lose
   the same proportion of that allowance; successful consumers receive the same
   proportion of their individual capacity. Conversion is 60%, then the consumer
   temperature/habitat factor applies once. This explicit local-pool approximation
   avoids pairwise grazing while retaining separate successful/failed consumer
   energies and the combined producer-loss cap. Mixed producers can graze peers;
   a lone producer cannot feed on itself. It is not an individual target-choice
   model and does not claim to reproduce one.

4. **Predation.** A predator attempts at most one hunt a day. Eligible prey have
   a feeding gene and a strictly smaller body; photosynthesis-only producers are
   grazed instead. Encounter uses the same count-density curve and uniform choice
   among eligible individuals. Capture probability is
   `clamp(0.6 + 0.2 × (predator mobility − prey mobility), 0.1, 0.9)`, where mobility
   requires movement without trunk. A kill provides 60% of the smaller of the
   predator's processing capacity and `prey cells + prey stored energy`, then the
   consumer's climate/habitat factor. The entire prey dies; unused food is lost.
   Hunters act in a seeded uniform individual order, depletion is immediate, and
   killed pending hunters cannot act. Ten size indexes bound prey lookup. Failed
   hunters remain in cohorts; matching successful energy outcomes immediately
   recombine. Empty-food habitats skip hunting. This preserves one kill per prey
   without expanding the whole population into individual records.

5. **Spatial rules and order.** Research v6's actual neighboring/drainage links,
   permanent-ice exclusions, 3,500 m ground limit, 1,000 m cliffs, adaptation states,
   moisture factors, passage probabilities, movement costs and trunk restriction
   apply. Neighbor selection includes blocked choices, with no reroll or refund.
   Water-to-water swimming ignores seabed relief. River habitats share one 2,000
   light-unit budget but have separate feeding pools. A complete day computes its
   climate, simultaneous one-action movement, shared light, grazing, predation,
   upkeep/starvation, reproduction/mutation/dispersal, storage and classification.
   Advancing to day N completes every intervening day; speed does not alter rules.

6. **Inheritance and identity.** All eight complete traits use mechanics v3's
   mutation graph and prerequisites, including distinct absent/zero temperature
   tolerance. Each paid offspring has probability 0.0001 of exactly one mutation;
   choose the trait first, then its valid change, without environmental bias.
   Intern identical genomes, but keep species labels separate. A mutant initially
   retains its parent's species. Speciation requires two disconnected habitat
   components with at least 20 members each, strict representative majorities at
   distance ≥3, for 100 consecutive days. Potential hard-rule transfer connects
   occupied nodes; region IDs and soft passage probabilities do not cut edges.
   Representatives are complete living genomes, tied by establishment order.
   Cohorts carry component provenance through movement and births. Largest member
   overlap preserves a continuing component's ID; merges/splits assign each old
   ID at most once. Reconnection removes the pair timer. Rename the smaller
   qualifying branch; ties choose later founding, then larger numeric group ID.
   Resolve simultaneous pairs by code-point ID order; never rename a component
   twice that day. Historical species do not merge on later contact.

7. **Randomness and cohorts.** Xoshiro128** has four serialized uint32 state
   words. Stable iteration and tie order are versioned rules. Independent equal-
   probability events use binomial counts sampled by geometric waiting times
   (with the rarer tail), and destination choices use conditional binomials.
   This retains integer stochastic outcomes, rare carriers and demographic
   variance; there are no weighted shared-fate organisms or expected fractional
   deaths. Cohorts preserve exact genome, species, habitat, hex, component
   provenance and stored energy. No low-frequency genotype is pruned. The entire
   stream, registries, counters, cohorts and classification timers are checkpointed.

8. **Storage approximation.** Default stored energy rounds **down** to multiples
   of 1/64 energy unit, after daily actions and storage capping. The per-organism
   discarded amount is strictly less than 1/64 per completed day; no energy is
   donated between carriers. Counts are exact counts of represented organisms.
   This small local bound is **not** a bound on reproduction, extinction or long-
   term trajectory error. `createLifeModel(world, { energyQuantum: 0 })` retains
   exact floating-point energy cohorts as a comparison mode using the same
   ecological rules. The default is explicitly experimental and uncalibrated.
   This authorized implementation supersedes the research recommendation to defer
   all lossy modes until a separate individual reference is built. There is no
   independent individual reference engine and no established accuracy tolerance.

9. **Other optimizations and observations.** Geography is copied once; shared
   `climateAt` evaluates only occupied/candidate sites at explicit days. Cached
   genomes and sparse occupied locations avoid per-organism work. Weighted capped
   light allocation redistributes unused light exactly up to floating arithmetic.
   No multi-day ecological leaps, population predictions or carrying-capacity
   clamps are used. Detached observations identify world, run, model, revision
   and day; global/local/species/variant/display sums use the same cohorts. Queries
   consume no randomness. World identity includes physical settings and a terrain
   fingerprint, and callers can provide a world-session-specific run ID. Accepted
   post-extinction introduction adds an attempt suffix. Exact counts do
   not imply exact biological trajectories. `restoreLifeModel` is a model-local
   continuation facility, not an application save-format promise.

10. **Presentation metadata.** Roles derive from the acquisition systems:
    producer, grazer, predator, mixed (two or more), or other (none). They are
    descriptions, not organism classes. Size is `(size trait − 1) / 9`; variants
    expose all eight traits, actual temperature interval, cells and supported
    habitats so UI need not reproduce biological formulas. Species and variant
    IDs stay locale-independent. The last 180 completed-day history points are a
    bounded display history; lifetime birth/death/mutation counters remain exact.

## Validation and measured limitations

Focused headless checks cover mutation graphs and temperature absence, hard
habitat/drainage/cliff rules, light cap redistribution, binomial moments and sparse
sampling, rejected-command atomicity, newborn activation, exact accounting and
detached snapshots, ordinary and exact-energy replay/checkpoint continuation,
rare-genotype retention, extinction, predator depletion, persistent branching,
component movement, and a one-day reconnection resetting classification.

Final local Node measurements over 360 days were approximately 65 ms small,
420 ms medium and 986 ms large (respective populations 5,060, 54,217, 130,793).
The large run had 1,676 cohorts across 749 occupied hexes, a 95th-percentile day
of approximately 4.55 ms, and a 2.15 ms observation build. An earlier aquatic-start
medium 3,600-day low-diversity run took approximately 6.1 s with bins versus 10.0 s with exact
energy, with 1,349 versus 1,779 final cohorts. These are local measurements, not
browser speed guarantees or predator-rich benchmarks. That single paired run
ended with different populations (94,129 versus 74,928); it does not establish an
approximation error tolerance. Seed trajectories diverge after rounded thresholds
change random-number consumption. Ecological coefficients, long-term equilibrium,
rare-lineage accuracy and cross-browser numerical equivalence remain unvalidated.

An earlier exploratory 24-seed, 360-day aquatic-start small-world comparison found mean populations
2,897.83 (bins) versus 2,654.79 (exact energy), and mean occupied hexes 18.54 versus
16.96. Neither set went extinct. Mean mutation counts were only 0.417 versus
0.458, so this is not a mutation-rich or adequately powered validation of rare
lineages; the approximately 9.2% population difference is not an error guarantee.
An intentionally dense one-hex predator/prey checkpoint (10,000 of each) completed
one day in approximately 8 ms after size indexing and fed-state recombination;
this synthetic stress check does not represent an ecological equilibrium.
