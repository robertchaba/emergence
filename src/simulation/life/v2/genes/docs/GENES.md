# V2 genes, inheritance and ecological trade-offs

Written for life model V2 on 2026-09-17. This is a new specification of the
implemented model, not an amendment to V1 research. All coefficients below are
experimental game-model choices; they are neither measured biological constants
nor predictions about real evolutionary timescales. The implementation is
[`genome.js`](../genome.js) and [`ecology.js`](../../ecology.js). Model scheduling,
resource pools, pressure measurement, movement and classification belong to
[`model.js`](../../model.js) and the [V2 model documentation](../../README.md).

## Representation and founder

A genome has one integer expression for each of 20 traits, except temperature
tolerance, whose absence is `null`. There are no hidden species templates,
intelligence gene, acquired lifetime mutations, dominant/recessive alleles,
chromosome counts or predefined plant/animal species. Names such as producer,
grazer and predator describe the energy systems currently present.

The default genome has size 3, photosynthesis 1, absent temperature tolerance,
aquatic adaptation 0, and all other traits 0. Introduction can match temperature
and habitat traits to the selected site; descendants subsequently inherit and
mutate normally. Genetic keys remain the same in English and Polish.

## Complete gene catalog

| Key | Expressions | Benefit and cost |
| --- | --- | --- |
| `size` | 1–10 | More cells, storage and processing; larger prey refuge and light reach. Both maintenance and construction per cell increase with size. |
| `photosynthesis` | 0–1 | Light acquisition, with construction and maintenance costs. Locomotion and multiple acquisition systems reduce its efficiency. |
| `trunk` | 0–10 | Greater land light weight and canopy height, particularly in larger bodies. Costs maintenance/construction and slows movement and flight. Requires photosynthesis. |
| `temperatureTolerance` | absent, −2…2 | Changes the full-efficiency temperature range; expressed tolerance costs maintenance and construction, and the most extreme preferences cost more. |
| `landAdaptation` | 0–3 | Reversible aquatic, amphibious, terrestrial and dry-land capabilities. Costs increase with expression. State 2 retains reduced aquatic performance. |
| `movement` | 0–4 | Active dispersal, faster pursuit and escape. Superlinear maintenance/construction costs reduce reproduction, and light acquisition becomes less efficient. |
| `plantFeeding` | 0–1 | Accesses edible producer production. Costs upkeep/construction; shares acquisition capacity when other systems exist. |
| `animalFeeding` | 0–1 | Enables encounters, capture and digestion of eligible consumer prey. Costs more than plant feeding; large prey can remain inaccessible. |
| `poison` | 0–3 | Reduces herbivory and the capture of poisonous prey. Can be countered by detoxification. Costs maintenance and offspring construction. |
| `spines` | 0–3 | Reduces edible tissue access and capture. Bite force and consumer armor counter grazing spines; handling counters capture defense. Costs both energy budgets. |
| `detoxification` | 0–3 | Counters plant/prey poison, with no benefit against a nontoxic target. Costs maintenance and construction. |
| `biteForce` | 0–3 | Greater plant reach, spine handling, prey-size limit and capture ability. Increasing strength has a superlinear maintenance cost and construction cost. |
| `skeleton` | 0 soft body, 1 hydrostatic, 2 exoskeleton, 3 endoskeleton | Alternative structures offer different speed, defense, handling and flight support, each with different maintenance/construction expense. The categories are not increasing evolutionary ranks. |
| `armor` | 0–3 | Increasing covering thickness improves protection; costs maintenance/construction and slows movement/flight. The material is set by `armorType`. |
| `armorType` | 0 flexible covering, 1 mineral shell, 2 segmented plates, 3 scales | Shells protect more and impose more drag; plates balance protection/motion; scales are lighter. Nonzero types require construction/maintenance even before armor thickens. |
| `flight` | 0–2 | A wing/flight-system precursor and stronger aerial capability. Needs movement to function, works better with support, and is limited by size, armor and trunk. Has substantial costs even before functional flight; also lowers photosynthetic economics. |
| `eyesight` | 0–3 | Low-cost light sensing through stronger vision: better encounters, pursuit/escape and a small light-orientation advantage. Acquisition can occur directly from absence. Mutations at this locus are three times as frequent as ordinary loci, in both directions. |
| `echolocation` | 0–3 | Active acoustic sensing, the model's interpretation of “radar.” Improves encounters and relative capture/escape; costs more than eyesight. There is no literal radio radar. |
| `thermalSensing` | 0–3 | Thermal detection improves encounters and relative capture/escape. Costs maintenance and construction. No separate thermal-image geometry is simulated. |
| `sexualReproduction` | 0–1 | Enables local mating and recombination of existing adaptive alleles. Adds maintenance, 8% of body-cell construction cost and mate scarcity. Unmated organisms can reproduce clonally while retaining these costs. |

Temperature ranges, in degrees Celsius:

| Expression | Full-efficiency range |
| --- | --- |
| Absent | 18–22 |
| −2 | 9–14 |
| −1 | 13–19 |
| 0 | 16–24 |
| +1 | 21–27 |
| +2 | 26–31 |

These are preferred ranges, with soft performance loss outside them in habitat
rules. They are not lethal-temperature cutoffs. For habitat adaptation, states
0/1/2 support water; 1/2/3 support land. State 2's partial aquatic performance
provides a reversible route back to water rather than requiring an all-or-nothing
habitat mutation.

## Mutation, drift and inheritance

Each selected mutation changes one trait by one reversible step. Ordinary
strengths change by ±1 within bounds. Temperature absence connects only to 0,
and −2↔−1↔0↔1↔2 is the remaining graph. Skeleton and armor-material alternatives
connect through state 0: 1↔0↔2 and 3↔0. A switch between two nonzero types therefore
takes two mutations. Trunk cannot be acquired without photosynthesis, and
photosynthesis cannot be removed while a trunk remains. A mutation may remove
the last energy-acquisition system; the model does not rescue an unviable genome.

Eligible loci have weight 1, except eyesight with weight 3. Choose a locus by
those fixed weights, then uniformly choose one of its legal changes. Eyesight's
weight and low precursor cost are an explicit model choice intended to make
sensing accessible. Its gain, strengthening, weakening and loss receive the
same locus weight. Mutation choice never examines what the environment needs.

For normalized pressure `p` clamped to [0,1], per-offspring mutation probability
is `0.0016 × (1 + 7p)`, from 0.16% to 1.28%. This bounds stress acceleration and
retains baseline variation in relaxed conditions. Pressure affects frequency,
not the trait or direction selected. Genetic drift also arises from stochastic
birth establishment, dispersal and mortality. There is no compulsory improvement,
periodic species grant or population-frequency shuffling. This stress response
is a gameplay approximation, not a claim that biological stress reliably induces
useful mutations.

Asexual offspring inherit the complete parental genome before a possible
mutation. Sexual offspring choose each locus from either parent with probability
one half. Photosynthesis and trunk form one linked block taken from the same
parent, retaining their prerequisite without invented repair mutations. All other
loci can recombine independently, so useful traits from two parents can meet
without waiting for sequential mutations. Mutation then acts on that child.
Parents and noninherited traits remain unchanged.

Mates must survive that turn's mortality and be local, same-habitat sexual
members of the same species with the same combination of photosynthesis,
plant-feeding and animal-feeding systems.
This coarse assortative rule limits mixing across different trophic strategies
without reading species names or assigning a beneficial mate. Mating opportunity is
`N / (N + 2)` for `N` other eligible individuals; selfing and waiting travellers
are excluded. The reproductive parent pays construction; a partner contributes
inherited alleles. For an offspring that
actually recombines, establishment viability is `0.82 + 0.14p`; a clonal child
uses 0.82. This explicit V2 approximation gives recombination a pressure-dependent
benefit, with no bonus at zero pressure. It is bounded at 0.96 and is applied
before other establishment constraints. Mating, recombination and this viability
effect do not ensure sexual lineages always replace efficient clones. With an
available mate, pressure 0.5 and a controlled 45.6-energy test budget, an otherwise
default sexual founder's expected established offspring per construction-energy
budget slightly exceeds its clonal counterpart even after the extra maintenance
cost. At zero pressure it is lower. This arithmetic comparison isolates a paid
advantage under moderate pressure before any additional value of recombining
different adaptive alleles. It does not establish a realized advantage at every
food supply or climate, and scarce mates can erase it.

Genetic distance sums shortest mutation paths at each locus, including absence
versus zero and two steps between structural kinds. It measures present
differences, not all historical mutations. Recombination may bridge several
differences in one birth; it does not rewrite the distance definition.

## Complete energy cost accounting

Let `s` be size and `C = 1 + 3s(s−1)` body cells. Per-biological-turn upkeep is
`C × [1 + 0.04(s−1) + M]`; construction of one offspring is
`C × [1 + 0.12(s−1) + R]`. Costs apply whether a trait currently finds a use.
All fractional costs in the following table add to `M` or `R`.

`T = 0` for absent temperature tolerance, otherwise `1 + 0.18 × |expression|`.
`P` is the armor protection multiplier from the structural table below.

| Trait expression `x` | Addition to maintenance `M` | Addition to construction `R` |
| --- | --- | --- |
| Photosynthesis | `0.03x` | `0.03x` |
| Trunk | `0.018x × (0.8 + 0.07s)` | `0.045x` |
| Temperature | `0.025T` | `0.01T` |
| Land adaptation | `0.01x` | `0.015x` |
| Movement | `0.035x^1.45` | `0.055x^1.4` |
| Plant feeding | `0.04x` | `0.04x` |
| Animal feeding | `0.055x` | `0.05x` |
| Poison | `0.027x^1.2` | `0.045x` |
| Spines | `0.021x` | `0.035x` |
| Detoxification | `0.026x` | `0.025x` |
| Bite force | `0.03x^1.2` | `0.04x` |
| Skeleton | structural table | structural table |
| Armor | `0.028x^1.35 × P` | `0.04x × P` |
| Armor material | structural table | structural table |
| Flight | `0.10x^1.4` | `0.14x` |
| Eyesight | `0.006x^1.15` | `0.012x` |
| Echolocation | `0.023x^1.2` | `0.04x` |
| Thermal sensing | `0.018x` | `0.03x` |
| Sexual reproduction | `0.01x` | `0.08x` |

An unadapted default founder has 19 cells, upkeep 21.09 and construction 24.13.
At full production, 19 light units converted at 2.4 yield 45.6 energy, enough
for maintenance and one construction. Climate, crowding and grazing reduce that
surplus. Extra construction and maintenance make speed or defense compete with
fertility and reserve accumulation. Small organisms have lower costs per cell,
while larger organisms can gain ecological access or avoid consumers.

An eligible parent first pays its own genome's construction cost. After
recombination and mutation, it must also fund any increase in the child's
construction cost from its own remaining energy. Without that energy the
offspring fails and the initial payment is lost. A cheaper child provides no
refund. Each parent's resulting reserve is retained separately: an expensive
mutant cannot use another parent's energy. Thus the actual payment is the larger
of parent and child construction costs, provided the parent can afford it.

## Acquisition, competition, movement and structures

With `n` active acquisition systems, each receives
`1 / [n × (1 + 0.12(n−1))]` of its potential capacity. No systems means zero
acquisition. Photosynthetic share is further divided by
`1 + 0.16 × movement + 0.10 × flight`. The extra-system penalty makes each
specialist more efficient at its source than a comparable generalist, while a
mixed organism can still benefit from flexibility where sources fluctuate.
Walking producers and photosynthetic grazers remain genetically valid.

Land light-competition weight is
`(1 + 0.04s + 0.028s × trunk) × (1 + 0.008 × eyesight)`. Light allocation still
has each producer's uptake cap and one shared hex budget. Height changes the
share received under competition; it creates no light. Water does not receive
the land trunk advantage. Canopy feeding height is `s × (1 + 0.10 × trunk)`.

| Skeleton | Maintenance | Construction | Speed addition | Defense addition | Handling addition | Flight support |
| --- | --- | --- | --- | --- | --- | --- |
| Soft body | 0 | 0 | 0 | 0 | 0 | 0.25 |
| Hydrostatic | 0.025 | 0.04 | 0.10 | 0.10 | 0.10 | 0.40 |
| Exoskeleton | 0.06 | 0.08 | 0.12 | 0.80 | 0.30 | 1 |
| Endoskeleton | 0.08 | 0.10 | 0.20 | 0.25 | 0.60 | 1 |

| Armor material | Extra maintenance | Extra construction | Protection `P` | Drag `D` |
| --- | --- | --- | --- | --- |
| Flexible covering | 0 | 0 | 1 | 0.16 |
| Mineral shell | 0.018 | 0.04 | 1.45 | 0.25 |
| Segmented plates | 0.024 | 0.035 | 1.30 | 0.14 |
| Scales | 0.014 | 0.025 | 1.12 | 0.10 |

Flight efficiency `F` is zero without movement, otherwise
`flight × flightSupport / [1 + 0.15(s−1) + D × armor + 0.14 × trunk]`.
Derived speed is
`movement × (1 + skeletonSpeed) × (1 + 0.20F)
/ [1 + 0.22 × trunk + D × armor + 0.06(s−1)]`.
Thus a trunk slows movement without making it genetically impossible.

Sensing score `S = 0.23 × eyesight + 0.27 × echolocation + 0.20 × thermalSensing`;
encounter reach is `1 + S`. These are aggregate sensing improvements; the model
does not yet simulate light direction, occlusion, acoustic propagation or prey
body temperature separately. Defense is
`0.65 × armor × P + 0.42 × spines + skeletonDefense` and handling is
`0.70 × biteForce + skeletonHandling`.

## Grazing and arms races

A grazer cannot reach plants with canopy height above
`grazerSize × (2.2 + 0.25 × biteForce + 0.10F)`. This supplies a size refuge;
large trees do not become unlimited food for microscopic consumers.

For light saturation `L` clamped to [0,1], the maximum exposed fraction of current
plant production is `0.44 − 0.24L`: 44% when light is largely unused, declining
to 20% when producers saturate the light budget. Abundance therefore leaves a
larger protected fraction and weakens the potential energy loss driving defense.
The model caps combined grazing losses from all consumers at the source pool;
the fraction is not granted separately to every herbivore. Distinct access
fractions divide source production into nested tissue bands. Only eligible
consumers share a band's energy, so a resistant consumer cannot make protected
tissue edible to a vulnerable one. Simultaneous requests share shortages and
remaining demand seeks remaining eligible bands; cohort splitting creates no
priority.

For each consumer/plant pair, unmatched poison is
`max(0, plantPoison − 0.9 × consumerDetoxification)` and unmatched spines are
`max(0, plantSpines − 0.6 × consumerBiteForce − 0.25 × consumerArmor)`.
Divide exposed production by
`1 + 0.65 × unmatchedPoison + 0.45 × unmatchedSpines + 0.16 × plantArmor × P`.
Food conversion is 60%; the source loses more energy than the consumer obtains.
Defenses can pay under heavy grazing and be a cost under weak grazing. Consumer
counteradaptations likewise pay only where defended food is useful.

Animal feeding targets organisms with either feeding system; pure producers
are handled by grazing. Maximum prey cells are
`predatorCells × (1.6 + 0.55 × biteForce + 0.25 × handling)`.
Conditional on encounter, capture probability is clamped to [0.04,0.94]:

```text
0.53
+ 0.085 × (predatorSpeed − preySpeed)
+ 0.055 × (predatorSensing − preySensing)
+ 0.085 × predatorHandling
− 0.075 × preyDefense
− 0.055 × max(0, preyPoison − 0.9 × predatorDetoxification)
+ 0.045 × clamp(log2(predatorCells / preyCells), −2, 2)
+ 0.09 × (predatorFlightEfficiency − preyFlightEfficiency)
```

Ineligible prey have probability zero. Faster, better-sensing predators improve
capture; faster, better-sensing or protected prey reduce it. Every such change
has the maintenance/construction costs above. Conversion remains 60%, so prey
energy is not duplicated. Arms races arise from resulting energy and survival,
not a script assigning a countertrait whenever its opponent changes.

## Recruitment in an occupied producer niche

Potential producer recruitment fitness compares both light competition and
construction economy:

```text
competitionFitness = lightWeight
  × max(0.02, 2.4 × photosynthesisShare − upkeep/cells)
  / (reproductionCost/cells)
```

`lightWeight` is `landCompetition` on land and 1 in water, so submerged trunks
receive no hypothetical light advantage. This is a dimensionless comparison,
not extra energy. Resident competition is the population-weighted local mean
of the same score among producers in the candidate's habitat. Light occupancy
still uses the shared hex light budget, including both river habitats. Candidate advantage is candidate
score divided by resident score. Under fully occupied conditions, conditional
recruitment is `0.06 + 0.94 × clamp((advantage − 1.08)/0.50, 0, 1)`.
With occupancy `o`, the final helper returns `1 − o + o × recruitment`.
Empty habitat thus permits ordinary establishment, while an invader into an
occupied niche benefits from a clear local advantage. Six-percent neutral
recruitment remains possible, preserving drift rather than making identities
immortal. This comparison uses available producer traits, not species names.
All offspring, including resident recruits, face this comparison; species
identity grants no automatic exemption. It represents recruitment-site scarcity
as well as invasion resistance. Local established adults continue competing for
light and paying their actual maintenance. Environmental performance and passage
conditions separately limit establishment.

## Verification and boundaries

Focused tests cover complete trait validation, 5,000 reversible mutations,
categorical shortest paths, pressure bounds, 1,000 recombinations and linkage,
costs for every capability, small-body economy, conserved crowded light,
mobility/specialization costs, plant/prey size refuges, antagonistic adaptation,
structure/armor alternatives, flight precursors and recruitment economics.

These checks establish implementation behavior, not long-run ecological balance.
Traits approximate interacting capabilities rather than actual developmental
pathways. Vision is intentionally easy to acquire; flight, armor and skeletal
changes are coarsely represented. The model does not guarantee that a particular
lineage evolves a trait, survives a transition or produces a new species by a
deadline. The 5–15 simulated-year branching target is evaluated separately by
whole-model seed runs, not inferred from the mutation rate alone.
