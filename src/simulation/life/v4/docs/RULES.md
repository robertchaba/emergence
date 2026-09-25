# V4 population rules — 2026-09-25

V4 preserves V3's population representation, ecological search and established
feeding/dispersal behavior. It adds 18 context-dependent genes and stronger
selection for sexual reproduction. A small allocation change makes better-adapted
competitors displace weaker ones sooner when resources are contested. There is
no global species-count quota, scheduled extinction or assigned ecological biome.
The request to retain V3's successful dynamics takes priority over forcing a
specific census at a specific date. All coefficients are experimental game rules.

Identifiers: `modelId: v4`, `rulesRevision: v4-populations-1`, checkpoint format
`emergence-life-v4-checkpoint-1`, common contract `life-observations-1`.
V1/V2/V3 implementations and research are preserved. Shared geography, climate,
calendar and speed meanings do not change.

## State, introduction and timing

Each species has one accepted complete genome, ancestry, a stable name, accepted
genome history, and at most three hypothetical adaptation directions. Sparse
records hold an integer population and mean reserve per species/hex/habitat.
River hexes can hold both land and water pools. There are no per-individual
pairings, allele cohorts, social-group records, ages or delayed journeys.

Explicit introduction places 20 photosynthetic founders on the selected hex,
using water if present, otherwise land. Habitat, temperature and elevation/depth
preferences are locally conditioned; one to three seeded viable single-gene
changes are attempted at distinct loci. The founder is not forced to acquire
sexual reproduction or any new strategy. A hostile site can go extinct.
Introduction while life survives or at an invalid hex is rejected atomically.
After extinction, an explicit new introduction archives the previous attempt;
playback never reseeds it automatically.

Three biological turns occur per ten physical days, at offsets 4, 7 and 10 after
introduction. Each turn evaluates the resident community, rounds deaths/births,
disperses surviving adults and periodically assesses adaptations. Newborns
cannot feed, reproduce or disperse on their birth turn. Stochastic rounding is
the integer part plus one Bernoulli draw for the fractional remainder, not an
individual binomial process. Its cost is independent of organism count.

## Reproduction and demographic rates

Let `I` be intake, `U` upkeep, `R` construction cost, `E` environmental performance,
`D` dormancy level, and `P` the actual local conspecific population:

- Activity is `1 / (1 + 0.55 D (1−E))` and scales photosynthetic/feeding effort.
- Effective upkeep is `U / (1 + 0.75 D (1−E))`.
- Starvation is `clamp(1 − I/effectiveUpkeep, 0, 1)`.
- Mate support is `max(0,P−1) / (max(0,P−1) + 8/(1+0.8 mateAttraction))`.
- Sexual recruitment is `0.90 + 0.80 support + 0.12 (1−E) support`; without the
  sexual-reproduction gene it is 1. Sexual maintenance remains paid.
- Stress is `clamp(1−E + predationLoss/0.12, 0, 1)`; offspring investment multiplies
  recruitment by `1 + 0.32 offspringInvestment × stress`, with additional
  maintenance/construction cost even in benign conditions.
- Open space is `1 / (1 + local body-cell biomass / habitat light budget)`.
  Stationary asexual photosynthesizers receive `1 + 0.28 clonalGrowth × openSpace`;
  other strategies receive no clonal recruitment benefit.
- Propagule investment multiplies recruitment by
  `1 + 0.22 propaguleDispersal × openSpace`, with paid construction and upkeep.
- Birth rate is `clamp(max(0,I−effectiveUpkeep)/R × 0.18 × sexualRecruitment ×
  offspringBenefit × clonalBenefit × propaguleBenefit, 0, 0.3)`.
- Death rate is `clamp(0.008 + 0.14 starvation/(1+0.3 D starvation) +
  predationLoss, 0, 0.9)`; score is birth rate minus death rate.

The sexual advantage is broad at established local populations, including good
conditions. Sparse founders can favor asexual reproduction; costly mate attraction
helps sexual reproduction at intermediate density. Clonal growth is a paid
sparse-site specialist, with reduced dispersal and crowded-light performance.
These are recruitment approximations, not explicit mating or recombination.
Recruitment multipliers only act on resource-funded surplus; they never create
food or allow births without it. Offspring investment approximates establishment
under stress rather than inventing age-structured survival records.

Parent and candidate intake are evaluated with equally rare resource probes,
preserving V3's selection for body size under competition. Within-species probes
use actual resident conspecific support for sexual reproduction/cooperation.
For a consumer exposed to an actual distinct predator, a second finite-community
counterfactual substitutes its phenotype at the parent's local density to estimate
predation hazard. Only that hazard enters the rare-resource demographic score;
counterfactual food is never added. The same calculation applies to the unchanged
parent. This makes defensive traits selectable without a one-organism prey probe
receiving either no attack or the full withdrawal cap. It also avoids penalizing
a size increase as if every resident instantaneously grew before resource sharing.

Birth rates (including offspring-investment stress) and deaths are recomputed
with this hazard. It is an explicit diagnostic approximation, not an observed
carrier mortality or a reconstructed kill ledger. Actual community updates and
founding-density tests still use their own finite allocations and represented
counts without a hazard override. Inspection cannot mutate either calculation.

An independent lineage still uses a one-organism resource probe. Its diagnostic
social support is the prospective quarter-parent local transfer (at least its
probe population), not an observation of carriers or actual parent mating.
Acceptance always recomputes the community at the actual transferred counts,
removing transferred parents. This prevents the exploratory score from assuming
permanent isolation while ensuring that real establishment cannot borrow mates,
cooperators or food from the parent. Both query and evolutionary scoring use
these same rules. Density assumptions and pooled recruitment are approximations.

Mean reserves retain V3's coarse bookkeeping: surplus after normal upkeep and
construction is clamped to body-cell capacity and merged by population-weighted
mean. Reserves do not fund extra births or override rate-based starvation.
Dormancy changes the effective rates, not a hidden seed bank or stored-energy
withdrawal. Body biomass and individual energy histories are not conserved.

## Environment and new gene effects

Temperature performance is exponential outside the preferred range. Insulation
reduces cold stress but worsens heat stress; land burrows moderate thermal stress.
Land moisture requirement increases with leaf area and decreases with deep roots
and waxy cuticles. Roots/cuticles have ongoing costs even on wet ground. Elevation
preference remains independent of temperature. Water adaptation, pressure/depth,
permanent ice, temporary ice and water exposure retain V3 meanings; buoyant
organisms pay greater exposure loss. No gene edits the shared physical hex.

The [gene catalogue](../genes/docs/GENES.md) specifies all ranges, costs and
interaction formulas. All 18 new loci have reversible levels 0–3. They are not
predefined plant or animal categories: expression can be retained in a context
where it pays its cost without receiving its conditional benefit.

## Finite resources and competition

V3 resource budgets and mortality coefficients are retained: 2,400 land light,
`2000/(1+waterDepth/180)` water light, and 70% land/30% water on river hexes.
Photosynthetic demand is population × body cells × photosynthesis share × 1.6 ×
environment × activity. Photosynthesis share pays the inherited mixed-system,
movement and flight penalties, plus new trait tradeoffs. No shaded or buoyant
species receives a separate resource pool.

Allocation remains weighted and individually capped. V4 raises **per-organism
competitive merit**, never population, to exponent 1.2:

- Light weights are demand × merit^1.2 × environment^0.2. Merit combines land
  canopy competition, crowding-dependent shade tolerance, water buoyancy and
  clonal crowding costs. Crowding is `clamp(totalDemand/budget−1, 0, 1)`.
- Grazing weights sharpen defended access and filtering effectiveness.
- Hunting weights sharpen capture probability.

Supply and each individual's demand caps are unchanged by this exponent. With
ample resources, a species still receives its funded capped demand; under
competition, efficient competitors gain a greater share at the expense of less
suited ones. Population remains linear, so splitting identical non-social demand
into species labels cannot increase extraction. Social traits explicitly depend
on same-species density; dividing a social group can reduce its cooperation.
Other species therefore change the selective environment through actual light,
food and predation, without a global crowding tax or forced elimination rule.

Grazers can remove at most 45% of gross plant production. Nested access bands
prevent multiple poorly adapted species from unlocking protected tissue. Reach
is `consumerSize × (2.2 + 0.3 biteForce + 0.1 flightEfficiency)` and reachable
canopy fraction `min(1,(reach/plantHeight)^2)`. Spines, poison, armor and warning
signals constrain access; large leaves expose more tissue. Water filter feeding
improves effort only on small producer bodies, using the same finite plant pool;
it impairs feeding on larger or land plants. Removed energy is converted at 60%.

Predators consume feeding species other than themselves, with size eligibility,
movement, senses, handling, flight, defense, camouflage, warning signals, ambush,
same-species cooperation, herding and land burrows affecting capture. Cooperative
hunting can make larger prey accessible only with local companions. Per-source
withdrawal remains capped at 12% of prey population each turn, and tissue is
`1.4 × prey body cells`, with 60% conversion. Capture remains within [0.02,0.95]
for eligible prey. Demand and failed capture effort are charged once, preserving
V3's protection against repeated free attempts at differently labelled sources.

Grazing effort remains population × cells × grazing share × environment × activity
× `2.2 (1+0.7 speed/(1+speed))`; hunting uses the corresponding predation share
and coefficient 3.6. The first movement level for non-photosynthetic consumers
keeps V3's free locomotion repurposing; subsequent levels are paid. Mixed-feeding
maintenance/construction penalties and all 22 original trait effects are retained.

## Dispersal

Neighbor-route conductance is `(0.004+0.003 movement) × dispersalMultiplier`.
The multiplier is `(1+0.45 propaguleDispersal)/(1+0.3 clonalGrowth+0.16 deepRoots)`.
River habitat switches use half conductance. Total outward conductance remains
capped at 0.12, subtracting each emigrant exactly once. Newborns stay at source.

Ground steps ≥1,000 m, surfaces ≥3,500 m, permanent ice and disconnected water
channels retain the difficult-route coefficient `0.006 (1+0.25 flight)`.
One unsuitable intermediate cell can be crossed with coefficient
`0.001 (1+0.25 flight)`. Both receive crossing multiplier
`1+0.3 propaguleDispersal+0.12 buoyancy`. Unsupported destinations are excluded;
poor but nonzero performance permits arrival and ordinary subsequent loss.
Alternative routes use their strongest connection once with stable ordering.
Ordinary/difficult moves retain 95%/75% mean reserve.

Mobile non-photosynthetic consumers keep V3's food-directed multiplier
`0.15+2.85 clamp((destinationScore+0.008)/0.12,0,1)`, within the same outward cap.
These are aggregate flows, not individual delayed journeys. Propagule recruitment
above supplies a paid local establishment approximation in addition to transport;
the model does not score an unlimited search of possible distant destinations.

## Evolution and species identity

V3's bounded search is retained. Every 12 biological turns (40 physical days),
up to 12 occupied locations represent climate/depth/elevation extremes, habitat
edges and stable supplementary positions. At most eight trial endpoints are
scored per search pass; movement/animal-feeding mutation edges have weight 2,
others weight 1. Six slots use one legal edge; two can take a second seeded legal
edge at a distinct locus. The intermediate need not be advantageous and never
becomes a population. Only the complete endpoint is assessed. This bounded
lookahead permits interacting traits and viable diets beyond a costly mixed
intermediate without prescribing which traits, diets or species must appear.
The three-direction budget is unchanged; checkpoint `steps` counts both edges.

Within-species hazard estimates and independent-lineage probes follow the
reproductive/social and resource-context rules above. Reachable new
habitats enter assessment with source-population × route-weight settlement support.
Directions require positive growth somewhere and >0.001 preliminary advantage.
At most three per species survive. Extensions use the same bounded trials, require improvement
and reset persistence. Qualification needs ≥0.005 advantage, ≥20 supported parent
organisms and four assessments of the unchanged candidate. Lost support resets
qualification; lost preliminary advantage discards the direction.

Same-acquisition candidates with ≥80% favorable support and ≥0.005 mean advantage
can replace the species genome if ecological distinction is preserved. A feeding
change always needs a new lineage. Same-feeding specialists need complementary
locations, <80% support and at least two mutation steps, except newly reachable
habitats need no two-step minimum. Novelty compares both occupied-condition
samples and reachable habitats against every incumbent, including the parent for
a branch. Exact duplicates are rejected. It requires mean energy-share total
variation ≥0.35 or weighted score-difference standard deviation ≥0.03 with places
where each wins by ≥0.005. A uniform efficiency improvement is not a new niche.

A candidate entering an occupied acquisition signature must also beat incumbents
by ≥0.005. All proposed branch destinations are checked at actual founding density,
removing transferred parents and combining incoming transfers before testing
finite food. Ordinary branches test 25% source transfer; animal-feeding candidates
try 25%, 12.5%, 6.25% and 3.125%, using the largest viable choice. At least 20
organisms must transfer overall. Branching conserves population, and new lineages
can subsequently go extinct. No identities are merged or protected from extinction.

Search remains selection-guided and can miss neutral or longer costly paths.
Directions are estimated opportunities, not exact allele frequencies or tracked
carriers. `stats.mutations` counts admitted/extended directions, not individual
mutations. The new loci do not bypass ecological acceptance or novelty gates.

## Observations, continuation and limitations

Full, summary and selected-detail observations reconcile to the same integer
census. Local light shares come from the same allocator, only when the whole hex
budget is exhausted, before grazing. Accepted genomes supply traits and morphology;
prospective directions have only estimated favorable ranges. The tree retains
accepted histories through extinction and explicit restarts, and traces inherited
branch-time expressions without inventing earlier unrecorded history.

Checkpoints contain model/rules/world identity, complete PRNG state, partial-turn
credit, species/genomes/histories, candidates, populations/reserves and counters.
All 40 required loci must validate. V3 checkpoints are incompatible; restore never
fills missing new genes and then continues a different random stream as if equal.
Browser timing, helpers, queries, locale, camera and theme do not affect biology.

The exact census describes represented integers, not exact biology. There is no
individual recombination, mating system, physiological energy ledger, soil nutrient
pool, pollen transport, day/night cycle, nutrient-creating symbiosis, seed bank or
age structure. Shapes are trait-informed illustrations, not predicted anatomy.
See [validation](VALIDATION.md) for tested invariants and observed balance limits.
