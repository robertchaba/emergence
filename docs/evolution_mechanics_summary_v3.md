# Evolution Simulation - Evolution Mechanics - v3

## Purpose

These are the reference rules for individual organisms: inheritance, mutation, selection, drift, dispersal and species identity.

This version replaces `evolution_mechanics_summary_v2.md` and is paired with `evolution_simulation_summary_v6.md`. It retains the slow mutation rate and existing branching thresholds, incorporates the starting gene catalog, and aligns dispersal and spatial connectivity with habitats and physical barriers.

Environmental conditions, energy acquisition, resource competition, upkeep, starvation, movement and offspring establishment follow the simulation summary v6. Spatial rules must not be taken from the unrestricted water/land dispersal paragraph in an older version.

Population aggregation, representative sampling, prediction, caching and browser optimizations remain outside this document. Later approximations should reproduce these individual-level rules rather than redefine them.

All numerical settings are simulation-design choices, not empirically calibrated biological constants. Evolution is intended to be gradual; time compression is the way to observe longer periods.

## 1. Inheritance

Reproduction is asexual: one parent produces an offspring without a mate or recombination.

An offspring inherits its parent's complete genome and species identity. Unless a mutation occurs, the offspring's genome is identical to its parent's. The parent does not mutate when it reproduces.

An organism does not genetically adapt during its own lifetime. Temperature, hunger and other conditions affect its ecological performance, not the contents of its genome.

There is one copy of each genetic trait, with no dominant/recessive alleles. Gene presence, expression and size are inherited. Stored energy, location, occupied habitat and environmental conditions are not genetic traits.

A successfully established offspring starts with zero stored energy and becomes active on the following simulation turn. It cannot feed, actively move or reproduce during its birth turn. Reproduction eligibility and costs belong to the ecological rules.

A newly mutated offspring uses its own habitat capabilities when establishing, not its parent's capabilities. Its genome is not changed again when it cannot establish.

## 2. Mutation probability and number of mutations

```text
mutationProbabilityPerOffspring = 0.0001 = 0.01%

99.99% probability: unchanged genome
 0.01% probability: exactly one valid mutation
```

There are never two or more mutations in the same offspring at birth. Several differences can accumulate through successive reproductive events in a descendant line.

This is one roll per offspring, not one roll per gene, per organism per turn or per rendered frame. Expanding the catalog does not increase the total mutation probability. It redistributes that probability over more eligible traits.

The probability remains fixed during a run. It does not increase because an organism is starving, poorly adapted, isolated or near extinction. There is no guaranteed mutation after a long wait and no global quota.

These are mutations of model traits, not a simulation of individual DNA changes.

For B offspring produced before dispersal/establishment losses:

```text
expected mutant offspring = B * 0.0001
```

| Offspring produced | Expected mutants |
|---:|---:|
| 1,000 | 0.1 |
| 10,000 | 1 |
| 100,000 | 10 |
| 1,000,000 | 100 |

These are averages, not scheduled events. A mutant can fail during dispersal, die after arrival or leave no descendants. The frequency among surviving organisms need not equal the mutation probability.

## 3. Choosing a mutation

When the mutation roll succeeds:

1. Identify traits with at least one valid one-step change, including absent genes that can be acquired.
2. Choose one eligible trait uniformly at random.
3. Choose uniformly among that trait's valid one-step changes.
4. Apply that change to the offspring only.

Selecting the trait first prevents traits with more possible changes from automatically receiving more mutation events.

The choice does not use temperature, moisture, water/land conditions, energy shortage, dispersal destination or predicted survival. A cold location does not bias temperature mutations toward cold tolerance. A shore does not increase the chance of acquiring land adaptation.

A valid mutation respects genetic bounds and prerequisites. It does not have to be useful or survivable. Losing the only energy-acquisition ability is allowed when prerequisites permit it. Ordinary ecological consequences then apply.

If a genome has no valid changes, leave it unchanged. Do not invent a beneficial fallback.

## 4. Genetic traits and allowed changes

The starting catalog contains eight traits. Their ecological effects and costs are defined by simulation summary v6 and the starting gene document where not superseded.

### Size

```text
integer size: 1 through 10
default: 3
one mutation: size - 1 or size + 1
```

Only changes within the bounds are available. Size is an intrinsic trait, not another active gene charged separately. Its body-cell count affects costs through the ecological rules.

### Photosynthesis

```text
absent <-> present
```

Acquisition and loss each take one mutation. There is no strength state initially.

### Trunk

```text
absent <-> 1 <-> 2 <-> 3 <-> ... <-> 10
```

Acquisition starts at strength 1. Each mutation changes strength by one. Reducing strength 1 removes the gene; a stronger trunk must first be reduced step by step.

Trunk requires photosynthesis. Photosynthesis cannot be removed while a trunk is present. Trunk can be inherited in water, but receives no land-light competition benefit there.

An organism may carry both trunk and movement. The trunk prevents active relocation under the ecological rules; it does not cause an automatic genetic deletion or make that genome invalid.

### Temperature tolerance

The absence of this gene differs from expression 0.

```text
absent <-> 0

-2 <-> -1 <-> 0 <-> +1 <-> +2
```

Acquisition starts at expression 0. Expression changes by one step in either available direction.

Removal is available only at expression 0. An organism at -2 must pass through -1 and 0 before losing the gene. This is a reversible model mutation graph, not a claim about molecular genetics.

| State | Full-efficiency temperature range |
|---|---:|
| Absent | 18-22 C |
| -2 | 9-14 C |
| -1 | 13-19 C |
| 0 | 16-24 C |
| +1 | 21-27 C |
| +2 | 26-31 C |

Expression 0 still counts as an active gene for upkeep.

### Land adaptation

```text
absent <-> 1 <-> 2 <-> 3
```

Absence is the aquatic baseline. Acquisition starts at state 1, amphibious. States 2 and 3 are terrestrial and dry-land adapted. Each mutation changes one step; state 1 can be lost in one step. There is no direct absent-to-terrestrial mutation.

Habitat evolution is reversible and independent of feeding strategy. Losing land adaptation on land is genetically valid, even when the offspring cannot establish there. A mutation is not rejected merely because the parent occupies the wrong habitat for the resulting genome.

The habitat trade-offs, moisture factors and expression-related upkeep are in summary v6.

### Movement

```text
absent <-> present
```

Movement is binary initially. It permits active relocation subject to terrain, habitat, temperature, energy and the trunk restriction. It is not required for offspring dispersal.

### Plant feeding

```text
absent <-> present
```

There is no genetic prerequisite requiring photosynthesis or movement. Ecological feeding capacity and food availability determine whether the gene is useful.

### Animal feeding

```text
absent <-> present
```

There is no requirement to acquire plant feeding first. Photosynthetic predators and other mixed strategies remain genetically possible. Encounters, prey suitability and energy capacity determine ecological success.

### Genetic dependencies

Future genes may require another gene or one of several alternatives, such as `B OR C`.

A mutation is valid only if the resulting genome satisfies every prerequisite. Removing a prerequisite is allowed when another required alternative remains. One mutation must not silently add or remove several dependent genes.

These checks concern genetic structure, not environmental usefulness. An ecologically poor genome is not protected from selection.

## 5. Selection and genetic drift

There is no separate evolution score, compulsory improvement or probability that a useful mutation automatically spreads.

Every organism faces local resource competition, energy acquisition, upkeep, starvation, predation and reproduction. A trait can improve reproduction in one environment and reduce it in another. Its frequency changes through the actual births, movements and deaths of its carriers.

Starvation uses the independent per-organism probability in summary v6:

```text
available = stored energy remaining after movement + net acquired energy
shortage = max(0, upkeep - available)
deathProbability = shortage / upkeep
```

A survivor of a shortage has zero energy left to store or reproduce with that turn.

At this reference level, genetic drift is the change in frequencies caused by random demographic outcomes, including mortality and dispersal. Do not add a separate random genome change or frequency-shuffling rule called drift.

Equally successful variants can have different fates because different individuals survive and leave descendants. Variants may disappear, coexist or replace others; no outcome is forced.

## 6. Dispersal and adult movement

Simulation summary v6, sections 5-8, is authoritative for spatial rules.

For each paid-for offspring:

```text
95%: attempt establishment in the parent's hex
 5%: attempt dispersal to a uniformly selected adjacent hex
```

Choose among all actual neighboring hexes, respecting the cylindrical seam. With no neighbor, use the parent's hex. Do not select the best destination or reroll an unfavorable one.

Inheritance and the possible mutation occur before checking offspring capabilities. Establishment requires a supported, physically available habitat. Neighboring dispersal also requires a valid connection and a successful passage roll. A failed attempt loses the offspring without refunding reproduction or awarding a replacement.

A stationary organism can therefore spread through its offspring. Adults relocate only through the movement mechanic, never because a population or region is automatically redistributed.

Founders carry their particular complete genomes and inherited species labels. Colonization does not create an averaged genome, automatically adapted founder or new species label.

The 5% figure is the probability of a neighboring attempt, not a promise that 5% of offspring successfully migrate.

## 7. Genetic distance

Genetic distance is the minimum number of valid one-step mutations required to change one complete genome into another, respecting bounds and dependencies.

With photosynthesis present in both genomes:

```text
size 3 -> 2                    = 1 step
temperature 0 -> -1             = 1 step
trunk absent -> strength 1      = 1 step

total genetic distance         = 3 steps
```

Similarly, absent land adaptation to state 3 requires three steps, not one.

Do not confuse ancestry's total mutation count with current genetic distance. A mutation followed by its reversal leaves no net difference at that trait.

Compare current genomes in living groups, not a permanently frozen founder genome.

## 8. Species identity and branching

Species identity is a historical label, not a trait that grants a survival or reproduction bonus. A mutant initially belongs to its parent's species.

This asexual model uses a simple, persistently separated branching rule. It is a simulation convention, not a universal biological species threshold.

### Local groups for classification

For classification only, form a graph of actually occupied `(hex, habitat)` locations for each species.

Connect neighboring occupied locations when at least one genome currently present in those locations can make the transition in either direction under the hard habitat and physical rules. Also connect occupied habitats within a river hex when an organism present can cross that habitat boundary.

This tests potential local transfer, including offspring dispersal, not whether an adult has movement energy this turn. A soft passage probability greater than zero does not cut the edge. A hard cliff, incompatible habitat or missing river-channel link does.

Groups are connected components of this graph. An unoccupied gap separates groups even when a future lineage could colonize it. Region IDs are not graph edges and do not define groups.

This habitat-aware refinement prevents two populations across a hard boundary from being treated as connected merely because their map hexes touch. It does not introduce population-level simulation or a separate gene-flow approximation.

A group's representative is its most common complete genome. Never construct a synthetic representative by averaging traits independently. Resolve equal-frequency ties using the oldest-established genome, with stable tie-breaking if needed.

### Speciation rule

A separated group becomes a new species when, for 100 consecutive simulation turns:

- It and another surviving group of the same species each contain at least 20 organisms.
- One complete representative genome accounts for more than half of each group's organisms.
- The representatives remain at least three mutation steps apart.
- The groups remain spatially disconnected under the habitat-aware graph above.

Reset the qualifying period if any condition fails. Majority-genome identity may change as long as all conditions remain satisfied.

On qualification, the smaller group receives a new species identity, with the existing species recorded as its parent. For equal sizes, choose the later-founded group. Members of the renamed group and their future offspring carry the new label. Other groups are not renamed automatically.

The timer follows the continuing separated group, not a particular hex. Expansion into adjacent empty habitat does not restart it; reconnection to the comparison group does. Resolve simultaneous qualifying cases in a stable order without renaming one group twice in the same classification step.

```text
one group changes without a persistent second branch
= evolution within the existing species

two established, separated groups persist with sufficient divergence
= branching into separate species
```

Labels do not automatically merge if descendants meet again or converge genetically. Neither branching nor later contact changes ecological rules.

This classifier intentionally does not recognize speciation within one connected habitat group. Geographic barriers can make separation possible; they do not guarantee that a split occurs.

## 9. Time compression and calibration

Mutation probability is tied to offspring production, not wall-clock time.

At 100x time compression, execute more simulation turns per real second. Each offspring still has a 0.01% mutation chance, and the branching qualification period still lasts 100 simulation turns. The neighboring dispersal attempt remains 5%, and active movement retains its per-turn rule.

A large, rapidly reproducing population can produce many mutants even at this low per-offspring probability. Establishment and spread also depend on geography, ecological advantage and random outcomes.

The selected rate is a conservative starting value for the desired pace, not a tested guarantee about visible evolution speed. Calibration should measure offspring production, mutant establishment, trait spread, migration and species branching per simulated time, not mutation counts alone.

## Initial settings

| Setting | Value |
|---|---|
| Reproduction | Asexual; one inherited genome per offspring |
| Mutation probability | 0.0001 per offspring |
| Mutations on a successful mutation roll | Exactly one valid one-step change |
| Trait selection | Uniform among eligible traits |
| Neighboring dispersal attempt | 0.05 per offspring |
| Dispersal distance | One adjacent map hex |
| Failed crossing/establishment | Offspring lost; no refund or reroll |
| Active movement | Only with movement; at most one attempt per turn; ecological costs and barriers apply |
| Initial occupied habitat | Aquatic for the default founder |
| Minimum established group size for branching | 20 organisms in each comparison group |
| Required genetic separation | At least three valid mutation steps |
| Required qualifying duration | 100 consecutive simulation turns |
| Effect of region ID | Diagnostic only; no direct biological effect |
| Effect of time compression | More simulated turns, unchanged event probabilities |
