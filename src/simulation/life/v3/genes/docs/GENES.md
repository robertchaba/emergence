# V3 representative genes and ecological costs

V3 has 22 inherited trait coordinates. One accepted genome describes each species;
the bounded evolutionary directions are hypotheses, not additional populations of
genotype carriers. No trait grants free organisms, food, guaranteed survival, or a
scheduled species. The coefficients below are experimental simulation choices,
not empirical biological constants. Implementation: [genome.js](../genome.js) and
[ecology.js](../../ecology.js).

## Complete catalogue and cost accounting

For size `s`, body cells are `C = 1 + 3s(s−1)`. Add the trait-cost contributions
`T` below, including the mixed-acquisition charge described below. Per-turn upkeep
is `C × [0.42 + 0.016(s−1) + T]`. Construction cost is
`C × [1 + 0.08(s−1) + 1.3T + skeletonConstruction + armorMaterialConstruction
+ 0.035trunk + 0.035movement + 0.035armor + 0.07flight
+ 0.30max(0,n−1) + 0.30PG]`. Here `n` counts acquisition systems, and `P/G`
indicate photosynthesis/plant feeding. Thus every acquired
capability increases both budgets even when the local conditions give no benefit.
These are rate-model energy budgets, not stored energy tracked for each organism.

| Key | Values | Benefit, limitation, and contribution to `T` |
| --- | --- | --- |
| `size` | 1–10 | Sets body cells, prey-size access, grazing reach and canopy potential. Larger size raises absolute and per-cell upkeep/construction through the formulas above. |
| `photosynthesis` | 0–1 | Obtains a share of finite local production, reduced by movement and flight. Cost `0.025x`. |
| `trunk` | 0–10 | Increases land light-competition weight and canopy height; slows movement and flight. Requires photosynthesis. Cost `0.015x`, plus construction above. |
| `temperatureTolerance` | absent, −2…2 | Selects a temperature range with smooth loss outside it. Absent costs zero; expressed cost `0.02 + 0.008×abs(x)`. |
| `landAdaptation` | 0–3 | Aquatic, wet-land overlap, terrestrial overlap, and dry land. Water efficiencies are 1, 0.85, 0.55, 0; land moisture requirements are unavailable, 0.75, 0.45, 0.2. Cost `0.012x`. |
| `movement` | 0–4 | Improves dispersal, pursuit and escape; enables flight. Reduces photosynthetic efficiency. Cost `0.016x^1.4`, plus construction above. |
| `plantFeeding` | 0–1 | Accesses finite edible production from other species, subject to height and defenses. Cost `0.022x`. |
| `animalFeeding` | 0–1 | Accesses consumer prey within the size limit; hunting removes represented prey and loses energy in conversion. Cost `0.038x`. |
| `poison` | 0–3 | Reduces grazing access and capture unless opponents have detoxification. Cost `0.025x^1.2`. |
| `spines` | 0–3 | Reduces grazing access and adds capture defense. Bite force and consumer armor counter grazing spines. Cost `0.018x`. |
| `detoxification` | 0–3 | Counters plant/prey poison, without an automatic benefit against nontoxic food. Cost `0.02x`. |
| `biteForce` | 0–3 | Improves canopy reach, spine handling, prey-size access and capture. Cost `0.025x^1.2`. |
| `skeleton` | 0 soft, 1 hydrostatic, 2 exoskeleton, 3 endoskeleton | Alternative support structures affect speed, defense, handling and flight. Costs in the structure table. These are categories, not evolutionary ranks. |
| `armor` | 0–3 | Improves defense and reduces edible tissue access; slows movement/flight. Cost `0.023x^1.3×protection`, plus construction above. |
| `armorType` | 0 flexible, 1 mineral shell, 2 segmented plates, 3 scales | Changes covering protection, drag and costs, as listed below. Material has a cost even before thickness is added. |
| `flight` | 0–2 | Gives a coarse barrier-dispersal bonus even before active flight. Aerial pursuit/escape require movement and structural support; size, armor and trunk reduce that efficiency. Lowers photosynthetic efficiency. Cost `0.065x^1.4`, plus construction above. |
| `eyesight` | 0–3 | Adds `0.24x` sensing and a small land light-competition benefit. Cost `0.006x`. |
| `echolocation` | 0–3 | Adds `0.28x` sensing. No acoustic propagation geometry is tracked. Cost `0.02x`. |
| `thermalSensing` | 0–3 | Adds `0.20x` sensing. No thermal-image geometry is tracked. Cost `0.015x`. |
| `sexualReproduction` | 0–1 | Aggregate stress-recruitment benefit, described below, with cost `0.018x`. V3 does not simulate mates, chromosomes or recombination events. |
| `elevationTolerance` | 0–4 | Shifts preferred land elevation; models nonthermal highland stress independently of temperature. Specialization loses lowland performance and pays `0.035x`. |
| `depthTolerance` | 0–4 | Shifts preferred water depth; deep specialists lose shallow-water performance and pay `0.025x`. It does not create light in deep water. |

| Skeleton | `T` addition | Extra construction | Speed | Defense | Handling | Flight support |
| --- | --- | --- | --- | --- | --- | --- |
| Soft | 0 | 0 | 0 | 0 | 0 | 0.3 |
| Hydrostatic | 0.025 | 0.04 | 0.13 | 0.1 | 0.1 | 0.4 |
| Exoskeleton | 0.045 | 0.075 | 0.1 | 0.7 | 0.3 | 0.9 |
| Endoskeleton | 0.065 | 0.095 | 0.2 | 0.25 | 0.6 | 1 |

| Armor material | `T` addition | Extra construction | Protection | Drag |
| --- | --- | --- | --- | --- |
| Flexible | 0 | 0 | 1 | 0.16 |
| Mineral shell | 0.016 | 0.035 | 1.45 | 0.26 |
| Segmented plates | 0.022 | 0.03 | 1.3 | 0.14 |
| Scales | 0.012 | 0.024 | 1.12 | 0.1 |

## Temperature, elevation and depth

| Expression | Temperature, °C | Land elevation, m | Water depth, m |
| --- | --- | --- | --- |
| Absent temperature | 15–25 | — | — |
| −2 | −15–5 | — | — |
| −1 | 0–15 | — | — |
| 0 | 10–25 | 0–1200 | 0–15 |
| 1 | 20–35 | 700–2600 | 10–80 |
| 2 | 30–45 | 1800–4000 | 50–300 |
| 3 | — | 3000–5600 | 200–1400 |
| 4 | — | 4400–8000 | 900–6000 |

For distance `d` outside the preferred interval, thermal performance is
`exp(−d/10)`, elevation performance `exp(−d/1000)`, and depth performance
`exp(−d/350)`. These are soft performance curves, not lethal cutoffs. On land,
moisture performance is `min(1, moisture/requiredMoisture)`, with moisture equal
to current humidity plus 0.2 for local runoff, capped at 1. Ice multiplies
performance by `1−0.8×iceCover`; water additionally pays
`1−0.8×waterExposure`. Permanent ice does not support either habitat. The
environmental score multiplies the applicable factors; shared geography and
climate are never rewritten.

## Acquisition, structure and interactions

With `n` acquisition systems, each receives
`allocation = 1/[n×(1+0.08(n−1))]`. Photosynthesis additionally divides its share
by `1+0.06movement+0.06flight`. A genome without an acquisition system has zero
intake. Mixed acquisition has one coherent representative genome and pays the
costs of every system; it is not a hidden mixture of producers and consumers.

Revision 3 adds `0.06max(0,n−1) + 0.16PG` to `T`, paid regardless of which
resources are currently available. The normal `1.3T` construction contribution
and the additional machinery charges above both apply. Compared with revision 2:

| Acquisition combination | Extra upkeep per cell/turn | Extra construction per cell |
| --- | ---: | ---: |
| A single system, or none | 0 | 0 |
| Photosynthesis + plant feeding | 0.22 | 0.886 |
| Photosynthesis + animal feeding | 0.06 | 0.378 |
| Plant + animal feeding | 0.06 | 0.378 |
| All three | 0.28 | 1.264 |

No combination is invalidated and mutation sampling is unchanged. The charges
reduce net growth and ecological acceptance, especially for photosynthetic
grazing. Single-system feeding, intake allocation, prey/plant access and finite
resource budgets retain revision 2 behavior. Exact prevalence depends on the
community and evolutionary path; these coefficients are experimental tuning.

Land light weight is `(1+0.12size×trunk)×(1+0.012eyesight)`; canopy height is
`size×(1+0.12trunk)`. Water receives neither land canopy competition nor free
production from a trunk. Flight efficiency is zero without movement; otherwise
it is `flight×flightSupport/[1+0.12(size−1)+drag×armor+0.15trunk]`.
Speed is `movement×(1+skeletonSpeed)×(1+0.2flightEfficiency)
/[1+0.18trunk+drag×armor+0.05(size−1)]`.
Defense is `0.6armor×protection+0.42spines+skeletonDefense`; handling is
`0.7biteForce+skeletonHandling`. Sensing sums the three sensory contributions.

Grazing reach is `consumerSize×(2.2+0.3biteForce+0.1flightEfficiency)`.
Accessible plant production is divided by
`1+0.8unmatchedPoison+0.6unmatchedSpines+0.15plantArmorProtection`, where
unmatched poison is `max(0,plantPoison−detoxification)` and unmatched spines
`max(0,plantSpines−0.7biteForce−0.2consumerArmor)`. The ecological allocator
uses nested accessibility bands, so multiplying vulnerable consumer species
cannot unlock protected production.

Predators target species with at least one consumer system. Prey cells must be
at most `predatorCells×(1.6+0.6biteForce)`. Capture probability, limited to
0.02–0.95 for eligible prey, is
`0.50+0.14(speedDifference)+0.06(sensingDifference)+0.07predatorHandling
−0.07preyDefense−0.07max(0,preyPoison−detoxification)
+0.07(flightEfficiencyDifference)`. Established species do not feed on their
own identity. A prospective new trophic lineage is assessed separately and can
use the unchanged parent as a possible food source; that advantage must not be
applied as a whole-parent replacement.

For each eligible prey source, successful hunting effort is limited to
`remainingPredationDemand / preyTissue × captureProbability`, where prey tissue
is `1.4×preyCells`. All predators share the same 12%-of-prey withdrawal budget.
Hunting effort is `population×cells×predationShare×environment×2.8`;
grazing retains its 2.2 effort factor. These efforts do not create prey or food.
Capture therefore scales population-proportional effort; splitting unchanged
hunters into more species cannot multiply their source access allowance.
After a withdrawal, attempted effort `eaten×preyTissue/captureProbability` is
deducted, including failed captures. Splitting otherwise identical prey into
more source species therefore does not provide repeated free attempts.
Additional predator identities can create actual interspecific prey links
because same-species feeding remains excluded.

Sexual expression multiplies otherwise-funded birth rate by
`1+0.12×(1−environmentPerformance)×population/(population+20)`.
This is a deliberately coarse benefit from standing heritable diversity under
stress. It does not fabricate gene carriers, free food, or successful offspring
without the ecological surplus needed to fund reproduction.

## Founders and one-gene changes

The initial genome has size 3, photosynthesis and otherwise absent capabilities.
Water begins at land-adaptation 0. Land begins at 1 for humidity at least 0.75,
2 for humidity at least 0.4, otherwise 3. The initializer chooses the thermal
expression and applicable elevation/depth expression maximizing environmental
performance per upkeep at the selected site, with fixed expression ordering
resolving ties. It then samples a target of 1–3 additional one-locus changes.
Each must preserve photosynthesis, leave positive empty-community growth at
that location, and use a locus not already randomly changed. Selection uses the
model's seeded stream; the complete extra trait costs apply. If no viable
change exists, initialization cannot manufacture a viable option. The model's
introduction validation still decides whether the resulting site is accepted.

Normal quantitative mutations are reversible ±1 changes. Temperature absence
connects only to expression 0; expressions −2 through 2 form a line. Skeleton
and armor materials connect via 0, so changing between two nonzero kinds takes
two steps. Trunk cannot be acquired without photosynthesis, and photosynthesis
cannot disappear while a trunk remains. Loss of the last acquisition system is
a legal mutation candidate but normally fails ecological evaluation. Each
proposed mutation changes exactly one locus; repeated pressure assessments
can extend a direction one additional locus at a time. No genotype-distance
threshold by itself entitles a candidate to a new species identity.

The model-level persistence, replacement and speciation rules are described in
[V3 rules](../../docs/RULES.md). Focused tests establish the implemented costs,
reversible mutation graph, deterministic founder variation, independent elevation
tradeoffs, finite transfers and protected grazing. They do not establish
ecological realism, parameter balance or a universal successful transition.
