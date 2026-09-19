# V3 population rules — 2026-09-19

V3 replaces genotype cohorts with species populations and a bounded search for
ecologically useful adaptations. These are experimental game-model rules,
authorized for this independent version, not measured biological constants.
V1/V2 research remains intact. Shared physics, weather, calendar and speed
meanings are unchanged.

Identifiers: `modelId: v3`, `rulesRevision: v3-populations-1`, checkpoint format
`emergence-life-v3-checkpoint-1`, common contract `life-observations-1`.

## State and introduction

One species record holds its accepted complete genome, ancestry, stable name,
genome revision, and up to three candidate adaptation directions. There is one
integer population record per species/physical hex/habitat, with a mean reserve.
Land and water can coexist on river hexes. No genotype populations, individual
energy states, deme graph, variant journeys or historical rejected-genome
registry are retained.

Every known hex accepts explicit introduction of 20 photosynthetic founders.
Water is selected if present, otherwise land. Habitat, temperature, elevation
or depth traits are initially matched to local conditions; one to three random
legal single-gene changes are then attempted among viable photosynthetic choices.
The same locus is not randomized twice. Costs are expressed in normal upkeep
and construction. A hostile site may have no viable additional choice and may
go extinct; matching does not guarantee survival. See the gene catalogue for
selection criteria and the full trait ranges.

Introduction while life survives is rejected without changing state or random
stream. After extinction, explicit introduction archives the previous attempt
and starts another deterministic attempt at the current physical day. Invalid
hexes are rejected atomically. Playback never introduces life implicitly.

## Demographic calculation

There are three complete biological turns per ten elapsed physical days, at
offsets 4, 7, 10 after introduction. Each turn computes ecology from the resident
population at its start, applies aggregate deaths and births, disperses surviving
adults, and periodically assesses adaptation. Newborns cannot feed, reproduce
or disperse on their birth turn.

`evaluateCommunity` supplies each resident's environmental performance, retained
production, food received, predation loss and net growth score. For intake `I`,
upkeep `U`, and reproduction cost `R`:

- Starvation pressure is `clamp(1 − I/U, 0, 1)`.
- Birth rate is `clamp(max(0, I−U)/R × 0.18 × sexualBenefit, 0, 0.3)`.
- Death rate is `clamp(0.008 + 0.14 × starvation + predationLoss, 0, 0.9)`.
- Ecological score is birth rate minus death rate.
- Sexual benefit is 1 without the trait, otherwise
  `1 + 0.12 × (1−environment) × localPopulation/(localPopulation+20)`.

Deaths are stochastically rounded from `population × deathRate`; births are
rounded from `survivors × birthRate`. Stochastic rounding takes the integer part
plus one Bernoulli draw for the remainder. Its cost does not grow with organism
count. It deliberately has less demographic variance than independent individual
trials; it is not a binomial sampler or an exact V2 optimization. Actual counts
remain nonnegative integers and all queries reconcile to those same counts.

Mean reserve records surplus after upkeep and construction, clamped to body-cell
capacity. Merging pools takes a population-weighted mean. It is coarse bookkeeping;
it does not fund extra births or override the rate-based starvation calculation.
Population changes are authoritative, while body biomass and individual energy
histories are not conserved. Expected prey transfers and rounded demographic
losses are an aggregate approximation, not a reconstructed kill ledger.

## Environmental score

Temperature performance decays as `exp(−distanceOutsidePreferredRange / 10)`.
Permanent ice does not support residence. Temporary ice multiplies performance
by `1−0.8×iceCover`; exposed water also pays `1−0.8×waterExposure`.

Water adaptation states 0/1/2 have performance 1/0.85/0.55; state 3 cannot live
in water. Water depth is current water surface minus bed elevation, clamped at
zero. Depth preference multiplies performance by
`exp(−distanceOutsideDepthRange / 350)`. This is an abstraction of the whole
water hex; vertical layers and individual swimming depths are not simulated.

Land requires adaptation state 1/2/3, with moisture requirements 0.75/0.45/0.20.
Effective moisture is shared humidity plus 0.2 on a river hex, clamped to [0,1].
Its performance is `min(1, effectiveMoisture/requirement)`. Elevation preference
multiplies performance by `exp(−distanceOutsideElevationRange / 1000)`, separately
from temperature. Higher-altitude tolerance carries ongoing cost even on low
ground. This produces a tradeoff at equal temperature without changing geography.

## Other species and finite resources

Land has a 2,400-unit photosynthetic resource budget. Water has
`2000/(1+depth/180)`. River hexes allocate 70% of the land budget and 30% of the
depth-adjusted water budget to their respective habitats. These are biological
allocation choices; they do not create separate physical worlds or duplicate a
full budget on each habitat.

Photosynthetic demand is population × cells × photosynthetic share × 1.6 ×
environmental performance. Weighted capped allocation shares the finite budget;
land canopy competition affects weight. Grazers receive at most 45% of a source's
gross production, subject to access, poison, spines, armor and reach. Nested
accessibility bands are shared once across all eligible consumers: adding more
vulnerable species cannot unlock defended tissue. Grazing subtracts source
production and transfers 60% of removed energy to consumers.

Predators consume eligible feeding species, with size limits and capture affected
by movement, sensing, flight, defenses, poison and handling. Per-source withdrawal
is bounded at 12% of prey population each turn; capture accessibility and demand
further constrain it. Tissue accounting uses `1.4 × prey body cells`, with 60%
conversion. Feeding demand is population × cells × acquisition share ×
environmental performance × 2.2. Same-species feeding is excluded. Finite resource
allocation is shared across consumers; it never loops over individual hunters.
Pairwise ecological work can still grow with the number of coexisting species.

Successful predation requests are capped at remaining effort divided by prey
tissue, multiplied by capture probability. An allocated withdrawal spends
`withdrawal × tissue / captureProbability` of that effort. Failed capture effort
therefore cannot be retried for free against each additional prey label. Splitting
an unchanged hunting effort or prey supply into more species cannot by itself
increase extraction from that source. Distinct identities can still create
additional interspecific prey links because same-species feeding is excluded.

Genes partition acquisition capacity and pay upkeep/construction costs.
Successful strategies depend on actual competitors, food and predators. There
is no independent positive score that creates resources, guaranteed niche slot,
predefined species, or fixed ecological biome.

## Aggregate dispersal

Surviving adults disperse over physical neighbor connections. Base per-route
conductance is `0.004 + 0.003 × movement`; a same-hex river habitat switch uses
half that rate. Total outward conductance is capped at 0.12. Destination habitat
must be supported; poor but nonzero performance permits arrival and subsequent
demographic loss.

Ground steps of at least 1,000 m, surfaces at least 3,500 m, permanent ice and
disconnected water channels are difficult connections. Their conductance is
multiplied by `0.006 × (1+0.25×flight)`. One unsuitable intermediate cell can be
crossed at `0.001 × (1+0.25×flight)` of normal conductance. Alternative routes to
one destination use the strongest connection once. Routes and updates have
stable ordering; movement subtracts each emigrant from its source exactly once.
Normal moves retain 95% of mean reserve; difficult moves retain 75%.

Unlike V2, no individual delayed passage is retained. Rare aggregate crossings
can arrive on the current turn. Conductance approximates population transport,
including passive dispersal by otherwise stationary lineages. This deliberately
changes barrier and founder-effect dynamics.

## Genetic pressure and bounded directions

Every 12 biological turns (40 physical days), each living species samples up to
12 occupied population locations. Sampling retains temperature, humidity,
elevation and actual-water-depth extremes, supplemented with stable positions.
It is deterministic and not driven by camera or inspection. Small refuges can
enter the sample even when most organisms live elsewhere.

At most eight seeded legal one-gene changes are tried in a search pass. A
candidate and its parent phenotype are both evaluated as equally rare additions
to the same frozen resident community. The parent remains in that community;
competition is not removed to make a candidate look successful. A proposed
distinct feeding lineage may consume existing parent resources, while neither
probe can manufacture its own food.

A direction is retained only if it has positive net growth somewhere and improves
the score by more than 0.001. There are at most three directions for the **whole
species**, regardless of occupied hex count. A retained direction can extend by
one legal gene change when that improves its strongest advantage by more than
0.001; changing its genome resets persistence. This is selection-guided search,
not V2's undirected per-offspring mutation process. It can miss neutral or
temporarily disadvantageous evolutionary paths.

Qualification requires an advantage of at least 0.005, positive growth, and
estimated favourable support corresponding to at least 20 parent organisms.
It must persist across four assessments of the unchanged candidate. Losing
support resets qualification; losing preliminary advantage discards the
direction. Sampled persistence is an approximation and does not certify
uninterrupted superiority between assessments or across a full year.

`stats.mutations` counts admitted or extended analytical directions, not
individual mutation events or carrier births. Failed trial genomes are not
retained in a growing registry.

## Adaptation, novelty and species identity

A candidate with unchanged acquisition systems, at least 80% favourable support,
and mean advantage at least 0.005 can replace the species' accepted genome after
qualification, provided the change preserves ecological distinction from other
extant species. This approximates fixation throughout the species without
maintaining local allele frequencies. Stored reserves are capped to the new
body. All candidate directions are cleared and reassessed later.

A feeding-system change always needs a separate lineage. A same-feeding
specialist can branch only when support is below 80%, there are locations where
the parent wins, and the genomes differ by at least two mutation steps. Gene
distance alone never establishes a species.

Novelty compares a bounded sample of both the parent's and each incumbent's
occupied conditions. Both compared phenotypes use the same independent rare
lineage probe, retaining all existing competition. Exact genome duplicates are
rejected. Otherwise, novelty requires either a mean total-variation difference
of at least 0.15 in realized production/grazing/prey energy shares, or a weighted
standard deviation of score differences of at least 0.008 with locations where
each phenotype wins by at least 0.005. A uniform efficiency offset or different
acquisition bits alone cannot establish a new niche. The same guard applies to
whole-species fixation so adaptation cannot erase that distinction.

Within target hexes, a candidate entering an already occupied acquisition
signature must beat its incumbents by at least 0.005 as well as its parent.

Before branching, all occupied parent locations are checked. Qualifying locations
must have positive candidate growth and advantage at least 0.005. Each proposed
25% transfer is also evaluated at its actual proposed density in the full
recomputed community; the child must retain positive growth after that split.
A branch transfers 25% (rounded down per pool) of parent organisms at the
qualifying locations, requiring at least 20 transferred organisms. Total population is conserved;
candidate evaluation itself never adds organisms. The new lineage is exposed to
ordinary competition and can go extinct. At most one accepted change per species
occurs in one assessment. There is no protected minimum species count or branch
deadline, and established identities are not merged. Changing environmental
conditions can still alter the ecological distinction after establishment.

## Observation, continuation and limits

The accepted genome supplies actual species traits and the portrait. Candidate
directions supply separate descriptions and estimated favourable ranges, with
no exact carrier counts or genetic percentages. Ranges are deterministic
analyses of current occupied locations, not tracked variant territories. Querying
does not advance candidates or consume biological randomness.

Checkpoints include identity/version, full PRNG state, partial turn credit,
populations, mean reserves, accepted genomes, candidate paths/persistence, ID
counters and history. Restore rejects incompatible model/rules/world identity.
Browser timing, theme, locale and queries cannot change a run at equal days.

No per-individual stochastic law, allele frequency, conserved embodied biomass,
reproductive isolation mechanism, or long-run numerical equivalence with V2 is
claimed. Novelty is an operational score criterion, not biological taxonomy.
See [validation](VALIDATION.md) for tested properties and measured performance.
