# V5 representative genes and ecological costs

V5 has 44 heritable trait coordinates: V4's 40 plus four browsing loci.
One accepted genome describes each species; bounded evolutionary directions are
hypotheses, not additional populations of genotype carriers. No trait grants
free organisms, food, guaranteed survival or a scheduled species. The coefficients
below are experimental simulation choices, not empirical biological constants.
Implementation: [genome.js](../genome.js) and [ecology.js](../../ecology.js).

The 40 earlier loci retain V4 costs and interactions. Historical V3 revision
references identify the inherited foundation; V5's browsing section supersedes
V3/V4 canopy-access and effort equations. Original research, tuning history and
measured V4 trajectories remain in the preserved [V4 catalogue](../../../v4/genes/docs/GENES.md)
and [validation](../../../v4/docs/VALIDATION.md); they are not V5 balance evidence.

## Complete catalogue and cost accounting

For size `s`, body cells are `C = 1 + 3s(s−1)`. Add the trait-cost contributions
`T` below, including the mixed-acquisition charge described below. Per-turn upkeep
is `C × [0.42 + 0.016(s−1) + T]`. Construction cost is
`C × [1 + 0.08(s−1) + 1.3T + skeletonConstruction + armorMaterialConstruction
+ 0.035trunk + 0.035paidMovement + 0.035armor + 0.07flight
+ 0.30max(0,n−1) + 0.30PG + 0.06deepRoots + 0.07propaguleDispersal
+ 0.14offspringInvestment + 0.04dormancy
+ 0.018treeClimbing + 0.010fallenForaging + 0.015branchPulling + 0.020longReach]`. Here `n` counts acquisition systems, and `P/G`
indicate photosynthesis/plant feeding. As inherited from V3 revision 4, `paidMovement` is
`max(0, movement−1)` for non-photosynthetic consumers, otherwise `movement`.
This is an explicit basic-locomotion subsidy after losing photosynthesis; the
movement gene must still evolve. Other acquired capabilities and higher movement
levels increase both budgets even when local conditions give no benefit.
These are rate-model energy budgets, not stored energy tracked for each organism.

| Key | Values | Benefit, limitation, and contribution to `T` |
| --- | --- | --- |
| `size` | 1–10 | Sets body cells, prey-size access, grazing reach and canopy potential. Larger size raises absolute and per-cell upkeep/construction through the formulas above. |
| `photosynthesis` | 0–1 | Obtains a share of finite local production, reduced by movement and flight. Cost `0.025x`. |
| `trunk` | 0–10 | Increases land light-competition weight and canopy height; slows movement and flight. Requires photosynthesis. Cost `0.015x`, plus construction above. |
| `temperatureTolerance` | absent, −2…2 | Selects a temperature range with smooth loss outside it. Absent costs zero; expressed cost `0.02 + 0.008×abs(x)`. |
| `landAdaptation` | 0–3 | Aquatic, wet-land overlap, terrestrial overlap, and dry land. Water efficiencies are 1, 0.85, 0.55, 0; land moisture requirements are unavailable, 0.75, 0.45, 0.2. Cost `0.012x`. |
| `movement` | 0–4 | Improves grazing encounters, dispersal, pursuit and escape; enables flight. Reduces photosynthetic efficiency. Cost `0.016paidMovement^1.4`, plus construction above. The first level is free only for consumers without photosynthesis. |
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
| `sexualReproduction` | 0–1 | Stronger density-dependent recruitment, with an isolated-founder disadvantage, described below. Cost `0.009x`. The model does not simulate mates, chromosomes or recombination events. |
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
`exp(−d×insulationFactor/(10×shelter))`. The insulation factor is
`1/(1+0.5insulation)` below the preferred temperature range and
`1+0.18insulation` above it; shelter is `1+0.2burrowing` on land, otherwise 1.
Elevation performance is `exp(−d/1000)`, and depth performance `exp(−d/350)`.
These are soft performance curves, not lethal cutoffs.

On land, moisture performance is `min(1,moisture/requiredMoisture)`, where moisture
is current humidity plus 0.2 for local runoff, capped at 1. Required moisture is
the land-adaptation requirement multiplied by
`(1+0.14leafArea)/(1+0.30deepRoots+0.22waxyCuticle)`. Ice multiplies performance
by `1−0.8×iceCover`; water additionally pays
`1−min(1,(0.8+0.05buoyancy)×waterExposure)`. Permanent ice does not support either
habitat. The environmental score multiplies the applicable factors; shared
geography and climate are never rewritten.

## Inherited acquisition, structure and interactions

The acquisition and structural rules in this section are inherited through V4.
Later sections specify contextual interactions and V5's changed browsing rules.

With `n` acquisition systems, each receives
`allocation = 1/[n×(1+0.08(n−1))]`. Photosynthesis additionally divides its share
by `1+0.06movement+0.06flight+0.05shadeTolerance+0.04waxyCuticle+0.04burrowing`,
then multiplies by `1+0.16leafArea`. A genome without an acquisition system has zero
intake. Mixed acquisition has one coherent representative genome and pays the
costs of every system; it is not a hidden mixture of producers and consumers.

Mixed acquisition adds `0.06max(0,n−1) + 0.16PG` to `T`, paid regardless of which
resources are currently available. The normal `1.3T` construction contribution
and the additional machinery charges above both apply:

| Acquisition combination | Extra upkeep per cell/turn | Extra construction per cell |
| --- | ---: | ---: |
| A single system, or none | 0 | 0 |
| Photosynthesis + plant feeding | 0.22 | 0.886 |
| Photosynthesis + animal feeding | 0.06 | 0.378 |
| Plant + animal feeding | 0.06 | 0.378 |
| All three | 0.28 | 1.264 |

No acquisition combination is invalidated. These inherited charges reduce net
growth and ecological acceptance, especially for photosynthetic grazing. Exact
prevalence depends on the community and evolutionary path; these coefficients
remain experimental tuning.

Land light weight is `(1+0.12size×trunk)×(1+0.012eyesight)`; canopy height is
`size×(1+0.12trunk)`. Water receives neither land canopy competition nor free
production from a trunk. Flight efficiency is zero without movement; otherwise
it is `flight×flightSupport/[1+0.12(size−1)+drag×armor+0.15trunk]`.
Speed is `movement×(1+skeletonSpeed)×(1+0.2flightEfficiency)
/[1+0.18trunk+drag×armor+0.05(size−1)+0.18ambush+0.20burrowing+0.06insulation]`.
Defense is `0.6armor×protection+0.42spines+skeletonDefense`; handling is
`0.7biteForce+skeletonHandling`. Sensing sums the three sensory contributions.

V5 browsing separates accessible quantity from collection efficiency. For
`reach = consumerSize×(2.2+0.3biteForce+0.1flightEfficiency)` and
`r = min(1,reach/plantHeight)`, direct access is `d = 0.04+0.96r²`. Four paid
alternatives add capped relief `a`, defined below; total canopy access is
`d+(1−d)a`. Collection efficiency is `e = 0.40+0.60[r+(1−r)a]`. The 4% quantity
floor and 40% efficiency floor represent scarce low/shed production, providing
an opportunity for small populations to persist rather than guaranteed food.
Ordinary size gains improve both constraints up to full reach.

The defended fraction is canopy access multiplied by
`min(1,(1+0.05leafArea)/(1+0.8unmatchedPoison+0.6unmatchedSpines+
0.15plantArmorProtection+0.12warningSignals×min(2,unmatchedPoison+unmatchedSpines)))`.
Unmatched poison is `max(0,plantPoison−detoxification)`; unmatched spines are
`max(0,plantSpines−0.7biteForce−0.2consumerArmor)`. Leaf area offsets tissue
defenses only, never the canopy cap. The allocator uses nested accessibility
bands, so additional consumer identities cannot unlock protected production.

Successful foraging demand is limited by `remainingEffort×e×filterFactor`, and
withdrawal spends `removedFood/(e×filterFactor)` of remaining grazing effort.
Access supplies the competition weight, not a second independent food budget.
When ordinary reach equals plant height, canopy access and collection efficiency
both become 1; route genes still cost maintenance and construction but provide no
further browsing benefit. Tissue defense and filter effects remain separate.

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
Hunting retains V4's coefficient 3.6 on
`population×cells×predationShare×environment×activity`.
Grazing effort multiplies its existing 2.2 factor by
`1 + 0.7speed/(1+speed)`: moving grazers encounter more real production, with
diminishing returns. Stationary feeding remains possible. These efforts do not create prey or food.
Capture therefore scales population-proportional effort; splitting unchanged
hunters into more species cannot multiply their source access allowance.
After a withdrawal, attempted effort `eaten×preyTissue/captureProbability` is
deducted, including failed captures. Splitting otherwise identical prey into
more source species therefore does not provide repeated free attempts.
Additional predator identities can create actual interspecific prey links
because same-species feeding remains excluded.

Inherited sexual expression multiplies otherwise-funded births by
`0.90 + 0.80m + 0.12(1−E)m`, where `E` is environmental performance and
`m = max(0,P−1) / [max(0,P−1)+8/(1+0.8mateAttraction)]` for local conspecific
population `P`. Dense populations approach 1.7 even in benign conditions;
an isolated organism receives 0.90. Mate attraction helps most at intermediate
density, always costs maintenance, and increases exposure to hunters. No actual
mates, chromosomes, recombination events or individual offspring are tracked.
A within-species hypothesis keeps V3's one-organism resource probe while using
actual local conspecific population for social and reproductive support.
An independent-lineage hypothesis uses a one-organism food probe and prospective
social support `max(probePopulation,floor(localParentPopulation/4))`, if a parent
exists. This is only a diagnostic founding approximation: projected companions
are not bodies, food, or extra resource demand. Every accepted branch is checked
again at its real transfer density after withdrawing actual parent organisms.
Unrelated residents never supply mates or pack members.

## Eighteen contextual loci inherited from V4

Every locus in this section has reversible integer levels **0–3**. Each entry below gives its
addition to per-cell trait maintenance `T`; all also pay `1.3T` in construction.
A gene can remain expressed outside its useful context and still pays its costs.
None creates a food pool, a new physical field, a species, or a guaranteed outcome.

| Key | Cost in `T` | Contextual benefit and tradeoff |
| --- | --- | --- |
| `leafArea` | `0.018x` | Raises photosynthetic potential by `1+0.16x`; moisture requirement rises by `1+0.14x`, and grazers can access up to `1+0.05x` more tissue (capped at all accessible production). |
| `shadeTolerance` | `0.014x` | Crowded light merit gains `1+0.38x×crowding`. Photosynthesis divides by an additional `0.05x`, so open-site production is lower. |
| `deepRoots` | `0.024x` | Moisture requirement divides by `1+0.30x+0.22waxyCuticle`; extra construction `0.06x` and reduced dispersal remain on wet sites. |
| `waxyCuticle` | `0.012x` | Reduces moisture requirement with roots, but adds `0.04x` to the photosynthetic denominator even where water is abundant. |
| `buoyancy` | `0.018x` | Water light merit gains `1+0.4x×depth/(depth+15)`, dividing the existing light pool. Water-exposure loss rises from `0.8exposure` to `(0.8+0.05x)exposure`, capped at 1. Crossing improves; no new water or light appears. |
| `propaguleDispersal` | `0.009x` | Improves route conductance/crossing and funded recruitment into open local space. Pays extra construction `0.07x`; little local recruitment benefit remains in crowded communities. |
| `camouflage` | `0.016x` | Reduces capture especially for slow prey; predator senses counter it. Also supports ambush. Maintenance is paid when hunters are absent. |
| `warningSignals` | `0.010x` | Amplifies unmatched poison/spines against grazers and hunters. Undefended prey becomes more conspicuous, and a signaling hunter loses stealth. |
| `ambush` | `0.015x` | Improves capture most against moving prey for a slow, camouflaged hunter. Adds `0.18x` to the speed denominator, making pursuit/escape/dispersal less effective. |
| `cooperativeHunting` | `0.022x` | Conspecific companions improve capture and accessible prey size. Solitary hunters retain its costs without its benefit. Companions are not extra prey or free food. |
| `herding` | `0.014x` | Conspecific companions reduce capture. A solitary animal gains no protection and still pays for the strategy. |
| `burrowing` | `0.022x` | Land shelters reduce outside-range thermal distance and capture. Adds `0.20x` to speed and `0.04x` to photosynthetic denominators. Water provides no shelter benefit. |
| `filterFeeding` | `0.020x` | Raises foraging effort on existing water photosynthesizers of size 1–3. Feeding on larger plants or land plants is slower; it requires plant feeding and creates no plankton/detritus resource. |
| `dormancy` | `0.018x` | Under environmental stress it reduces upkeep more than activity; starvation mortality is also reduced. Less activity produces less food in favorable parts of a stressful site. Extra construction is `0.04x`. No seed bank, hidden organisms or stored-energy withdrawal exists. |
| `insulation` | `0.018x` | Divides cold stress by `1+0.5x` but multiplies heat stress by `1+0.18x`; adds `0.06x` to the speed denominator. |
| `offspringInvestment` | `0.008x` | Multiplies funded recruitment under climatic or predation stress by `1+0.32x×stress`; extra construction `0.14x` reduces benign-condition reproduction. There is no age-structured population. |
| `mateAttraction` | `0.012x` | Lowers the mate-density half point from 8 to `8/(1+0.8x)`. Ineffective without sexual reproduction or when wholly alone; capture increases by `0.018x`. |
| `clonalGrowth` | `0.025x` | Stationary asexual photosynthesizers multiply recruitment into open space by `1+0.28x×openSpace`. Dispersal falls and crowded light merit divides by `1+0.1x×crowding`. Sexual/mobile/nonphotosynthetic organisms retain costs without this recruitment benefit. |

`crowding = clamp(totalPhotosyntheticDemand/lightBudget−1, 0, 1)`.
`openSpace = 1/[1+sum(localPopulation×bodyCells)/habitatLightBudget]` is a coarse
local occupancy proxy, not a new resource or a predicted destination. Propagule
recruitment multiplies otherwise-funded births by `1+0.22propaguleDispersal×openSpace`.
Both recruitment mechanisms still require positive energetic surplus and remain
subject to the existing birth-rate ceiling of 0.3. They approximate successful
local establishment; actual between-hex movement transfers existing organisms.

Dispersal multiplier is `(1+0.45propaguleDispersal)/(1+0.30clonalGrowth+0.16deepRoots)`;
crossing multiplier is `1+0.30propaguleDispersal+0.12buoyancy`. The model uses these
in the same bounded conservative route calculations as V3.

Dormancy activity is `1/[1+0.55dormancy(1−E)]`, applied to photosynthesis/grazing/
hunting effort; effective upkeep is `U/[1+0.75dormancy(1−E)]`. Starvation fraction
is computed against that effective upkeep, and its mortality contribution is
`0.14starvation/[1+0.30dormancy×starvation]`. Background mortality stays 0.008.
Offspring stress is `clamp(1−E+predationLoss/0.12, 0, 1)`.

## Contextual interactions inherited from V4

These interactions retain V4's implementation, except that V5 applies leaf-area
and filter effects to its new canopy access and collection efficiency as specified
above. Matching simple formulas earlier in this catalogue include these modifiers.

- Land thermal distance is divided by `1+0.20burrowing`. Insulation multiplies
  cold distance by `1/(1+0.50insulation)`, hot distance by `1+0.18insulation`.
  Distances are still relative to the existing preferred temperature interval.
- Light merit combines canopy, shade, water buoyancy and clonal crowding factors.
  Weight is `demand×merit^1.2×environment^0.2`; individual caps are unchanged.
  Grazing merit `(access×filterFactor)^1.2` and hunting merit `capture^1.2` also
  sharpen contested allocation. Population always stays linear. Abundant pools
  satisfy the same caps, while weaker competitors lose scarce food/light sooner.
  V3's 2,400/2,000 light budgets and baseline/starvation mortality are retained.
- Plant defense adds `0.12warningSignals×min(2,unmatchedPoison+unmatchedSpines)`.
  Leaf-area exposure can offset that defense, but cannot expand canopy access.
- Filter effort multiplies collection efficiency by
  `1+0.50filterFeeding/(1+0.40speed)` for small water plants; otherwise by
  `1/(1+0.25filterFeeding)`. Accessibility bands still limit total tissue; effort
  spent is withdrawn food divided by collection efficiency and this filter factor.
- Social support is `q=max(0,P−1)/[max(0,P−1)+12]`. Cooperative prey-size eligibility
  adds `0.70cooperativeHunting×q` to the existing cell-size ratio limit.
- Capture adds ambush
  `0.11ambush×[0.35+preySpeed/(1+preySpeed)]×(1+0.10camouflage)/(1+0.40hunterSpeed)`
  and pack benefit `0.075cooperativeHunting×hunterQ`; it subtracts
  `0.065herding×preyQ` and, on land, `0.065preyBurrowing`.
- Capture subtracts `0.11preyCamouflage/(1+0.30preySpeed+0.25hunterSenses)`.
  It also subtracts warning deterrence
  `0.055preyWarnings×[min(2,unmatchedPoison+preySpines)−0.5]`; a negative
  deterrence is increased visibility. Hunter warnings subtract `0.025x`, and
  prey mate attraction adds `0.018x`. Final capture stays between 0.02 and 0.95.

All hypotheses keep V3's rare-resource intake. When a within-species consumer
hypothesis faces other resident predators, a separate detached counterfactual
replaces its parent phenotype at the actual parent density to estimate only the
population-weighted predation hazard. That hazard enters both mortality and
offspring-investment stress in the same rate law; all production and food still
come exclusively from the rare probe. Nothing from the replacement calculation
is transferred as food, organisms, or accepted state. This fixes the count-one
prey artifact that otherwise made defense invisible against saturated hunting.
Using whole-parent replacement for intake was rejected: increasing every
resident's body mass before scoring systematically penalized larger bodies.
The combined estimate is an explicit selection approximation; actual population
updates and founding transfers always use the single real community calculation.
The extra hazard calculation is skipped without consumer prey or an unrelated
local predator.

No defenses create invulnerability. Source limits and failed-attempt spending
still apply, and splitting sources does not reset the available hunting effort.

## Four browsing loci introduced in V5

All four have reversible integer levels **0–3** and cost upkeep even when no
useful plant is present. Their `T` contribution also incurs the normal `1.3T`
construction charge, in addition to the extra construction column below.
They work only through plant feeding; another feeding system or a producer can
retain a costly expression without receiving its benefit.

| Key | Cost in `T` | Extra construction | Route contribution and limits |
| --- | --- | --- | --- |
| `treeClimbing` | `0.009x` | `0.018x` | `0.15x/3`, only on land, with movement and a trunk-bearing plant. Maximum climbing contribution recovers 15% of otherwise unreachable production. |
| `fallenForaging` | `0.005x` | `0.010x` | `0.08x/3`, only on land with movement. Finds low/shed material from current plant production; there is no accumulated fruit, litter or detritus pool. |
| `branchPulling` | `0.007x` | `0.015x` | `0.10x/3×(0.5+0.5r)`, only on land with movement, bite force and a trunk-bearing plant. Nearer branches are easier to pull; bite force retains its own cost. |
| `longReach` | `0.008x` | `0.020x` | `0.10x/3`, in either habitat. Represents extended feeding structures without changing body size, predation eligibility, plant height or physical geometry. |

The contributions overlap: `a = min(0.25, climbing+fallen+pulling+extended)`.
They recover at most 25% of the inaccessible portion together. Climbing's own
15% limit therefore never means 15% extra independent food for every climber.
At full reach all extra route benefit is zero. The alternatives cannot remove
the full height penalty, and paying for all of them can waste resources once
the combined cap is reached. Stronger size selection is an intended ecological
pressure to validate; these limits do not guarantee a population or biomass
ranking under every community and environmental condition.

## Read-only morphology

The phenotype exposes `{ form, pattern, social }` as serializable semantic
observations. Pure photosynthesizers select, in priority order, `floating`
(buoyancy), `beaded` (clonal growth), `plume` (propagules ≥2), `needleleaf`
(cuticle ≥2), `broadleaf` (leaf area), otherwise `rosette`. Consumers/mixed feeders
select `filter`, `burrower`, `ambush`, `sail` (buoyancy), otherwise `general`.
Warning signals select `banded`, camouflage selects `mottled`, otherwise `plain`.
Herding, cooperative hunting or clonal growth select `clustered`; otherwise
`solitary`. These are illustrative morphology categories, not assigned species.
Rendering supplies shapes/colors from observations and theme tokens without
reading genomes. Morphology has no biological feedback or extra state.

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
a legal mutation candidate but normally fails ecological evaluation. Every elementary mutation still changes exactly one locus. The inherited bounded search
uses six single-edge trial slots and two compound slots per pass; a compound
trial follows two legal edges at distinct loci. Its intermediate genome is a
hypothesis, never a funded population or accepted adaptation. This permits a
costly mixed-feeding bridge to reach a viable specialist without inventing an
extra mutation coordinate or automatically granting a feeding system. Repeated
pressure assessments can extend candidate paths under the same bound. Only a
qualifying endpoint can be accepted, through the full persistence, ecological
novelty and real founding-density checks. No genotype-distance threshold by
itself entitles a candidate to a new species identity.

The model-level persistence, replacement and speciation rules are described in
[V5 rules](../../docs/RULES.md). See [V5 validation](../../docs/VALIDATION.md)
for completed checks and balance evidence. Inherited V4 evidence alone does not
establish V5 parameter balance or a universal successful transition.
