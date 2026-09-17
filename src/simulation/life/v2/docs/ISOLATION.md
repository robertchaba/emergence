# V2 habitat, dispersal and species identity

These are V2 rules, written independently of the retained V1 reference. The
physical atlas remains shared and read-only. Habitat occupancy, biological
effects of weather, movement capabilities and species identity belong to V2.
The coefficients below are simulation choices, not measured biological constants.

## Residence and environmental performance

There are water and land habitats, sometimes both on a river hex. Water exists
on sea/lake hexes or where runoff is positive. Land exists on physical dry-ground
hexes. Permanent ice cannot support residence. Land at or above 5,500 m cannot support
residence; lower high ground still pays ordinary temperature and moisture costs.

| Land adaptation | Water performance | Land moisture target |
| --- | --- | --- |
| 0 | 1 | Unsupported |
| 1 | 0.92 | 0.80 |
| 2 | 0.58 | 0.50 |
| 3 | Unsupported | 0.25 |

Land's base performance is `min(1, moisture / target)`. Direct accessible water
raises effective moisture to at least 0.85: runoff on the current hex, or an
adjacent unfrozen permanent-water or river hex with a surface step below 1,000 m.
The latter tests permanent ice, not a temporary seasonal freeze. Land-adaptation
mutations move between adjacent states; states 1 and 2 maintain viable overlap
for repeated land-to-water or water-to-land reversals. They have different costs
and performance, so amphibious flexibility is not free.

Current shared climate can supply `iceCover` and `waterExposure`, each in [0, 1].
V2 multiplies habitat performance by `1 − 0.65 × iceCover`. Water additionally
multiplies by `1 − 0.8 × waterExposure`. Missing fields imply no extra penalty.
These rules reduce acquisition without rewriting water type, land elevation,
water-level datum, permanent-ice state or shared climate.

Temperature performance is 1 inside the genome's temperature interval, declining
linearly to 0 at 12 degrees outside it. The engine multiplies temperature and
habitat performance. Reaching a site does not promise survival there.

## Normal connections

A normal connection needs adjacent hexes, residence supported at both ends,
and no permanent ice. Switching water/land within a river hex is possible when
the genome supports both. Water-to-water movement follows adjoining permanent
water or an actual upstream/downstream river link; deep seabed elevation does
not form a swimming cliff.

Neighboring ground or shoreline transitions with a surface step of at least 1,000 m, or
touching ground at or above 3,500 m, are delayed routes. Lower terrain, rivers,
destination temperature and moisture can reduce normal passage probability.
`canCross` describes only normal connections. Returning false does not declare
that a geographic barrier is permanently impossible to cross.

An adult with movement, outside transit, attempts at most one route per turn
with probability `min(0.30, 0.06 + 0.035 × speed) × current environmental performance`.
It selects uniformly among route descriptions, including a same-hex habitat
change on a river hex. A valid affordable attempt costs
`0.10 × cells × (1 + 4 × difficulty)` from stored energy before feeding, even if
the passage roll fails. A missing route or insufficient stored energy leaves
the organism in place without charging a cost. No alternative route is rerolled.

For normal adult movement, difficulty is the maximum of destination temperature
loss, destination habitat loss and terrain difficulty, clamped to [0,1]. Ground
terrain difficulty uses the maximum of positive elevation divided by 5,500,
river runoff difficulty `min(0.5, 0.1 × log2(1 + runoff))`, and surface step
divided by 1,500. Water-to-water movement omits this terrain term. Passage
probability is `1 / (1 + 4 × difficulty)`. Adult moves therefore sample current
conditions as well as static terrain; offspring route descriptions use the
static terrain probability specified below.

## Slow barrier crossings

`dispersalRoutes(genome, source, habitat, hexes)` returns routes containing a
destination hex/habitat, delay in biological turns, success probability and
difficulty. It is a pure query: it creates no population and consumes no random
draws. Normal adjacent routes have zero delay. Barriers instead have:

| Route | Base delay | Arrival probability before habitat factor |
| --- | --- | --- |
| Supported neighbor across a cliff/high ground/disconnected channel | `90 + 90 × difficulty` turns | `0.25 + 0.08 × flight` |
| One hostile intermediate hex with supported habitat beyond | 180 turns | `0.16 + 0.06 × flight` |
| One permanent-ice intermediate hex | 240 turns | `0.16 + 0.06 × flight` |

Adjacent barrier difficulty is at least 0.65; intermediate-cell difficulty is
at least 0.75. Here `flight` means derived flight efficiency (0–2), requiring
movement and reduced by body size, trunk, armor and unsupported skeletal form.
Flight expression without movement provides no transport benefit. Delays divide
by `1 + 0.35 × flight`, rounded up, so even capable flight never removes the waiting period. Corridor arrival
probability additionally multiplies by `0.5 + 0.5 × destinationHabitatFactor`.
Normal route probability is `1 / (1 + 4 × terrainDifficulty)`; current ecological
performance and establishment checks are still applied by the engine.
Here static terrain difficulty is the maximum of surface step divided by 1,500
and positive endpoint elevation divided by 5,500, capped at 1; normal water-to-water
routes use zero. The corridor suitability factor uses the supplied destination
fields and treats local runoff as direct water access. The eventual arrival
check separately samples current destination conditions.

A fully terrestrial plant or animal therefore has a possible route across one
water hex to land beyond. An aquatic organism can similarly cross one dry hex
between water habitats. The model treats this as rare transport/establishment,
not ordinary residence in an incompatible medium. Plants do not need a movement
gene for offspring dispersal. Ordinary supported intermediate habitat must be
crossed normally, one hex at a time; two hostile intermediate cells cannot be
skipped. Multiple routes to the same destination retain the shortest delay,
then the highest success probability, with deterministic ordering.

The engine must retain waiting carriers at their source counting hex until a
journey completes. The wait consumes biological turns and remains checkpointed;
survival during it is not assured. Destination suitability is checked again at
completion, and arrival probability is rolled once. An intermediate hex never
receives a second count for a waiting organism. Transport bookkeeping and its
energetic cost remain inside V2. While waiting, it still feeds and faces ordinary
maintenance, predation and mortality at its source, but cannot move, reproduce
or serve as a mate. Delayed offspring first establish in their source habitat;
their birth counts immediately if that establishment succeeds. At arrival the
model subtracts up to `0.30 × cells` from remaining stored energy, stopping at
zero. An unsuccessful arrival leaves a surviving traveller at its source and
ends that waiting attempt, without an extra mortality or arrival-energy charge.
The arrival check requires positive destination performance but does not repeat
producer recruitment competition there.

## Local demes and effective gene flow

Species are historical labels. New mutations inherit their parent's label;
neither a trait nor an elapsed world age creates a new species immediately.

For each species, occupied `(hex, habitat, acquisition signature)` nodes form a
graph. An acquisition signature is the inherited combination of photosynthesis,
plant feeding and animal feeding expression, for example `1:0:0` or `0:1:0`.
Signatures come from living genomes; they are not assigned species, ecological
biomes or predetermined evolutionary stages. The engine's sexual mate pool uses
the same signature as an approximation of mating within a shared feeding niche.
A mutation still inherits its parent's species ID when this signature changes.

Normal graph edges join only the same acquisition signature. A normal edge
requires at least 12% of the living population at **each** end to be capable of
that crossing. A tiny amphibious minority therefore cannot erase an established
barrier for a mostly terrestrial population. Delayed transport is not a normal
edge. Rare migrants can still affect actual allele frequencies and reproduction.

Within each connected graph component, local demes extend at most one graph
step from an occupied anchor. Previous occupied anchors are considered first,
then numeric hex/habitat/signature order. This allows distant parts of a continuous range
to evolve separately instead of collapsing an entire continent into one group.
An old group ID follows the largest overlap of living carriers; ties use older
founding day, stable ID and deterministic component order. Whole-group movement
can retain identity. Changing acquisition signature creates a new group identity,
so an earlier niche's isolation timer cannot be carried into a different niche.
A checkpoint stores anchors, signatures, IDs, founding days and timers.

A deme's representative is its most abundant **complete living genome**, with
oldest establishment and stable ID breaking ties. No exact genome must exceed
50% of the deme. Representatives are never constructed by combining unrelated
trait averages. Changing the representative is allowed if qualifying divergence
persists.

## Branching criteria

Both compared demes must have at least 20 living organisms of the same species.
Three kinds of separation are recognized:

| Separation | Representative genetic distance | Consecutive biological turns |
| --- | --- | --- |
| Barrier | At least 2 legal mutation steps | 240 |
| Distance | At least 3 legal mutation steps | 420 |
| Different acquisition signatures | At least 3 legal mutation steps | 360 |

A barrier comparison uses the same acquisition signature in different
effective-flow components **and** no normal
physical habitat path between the anchors for either representative genome.
The physical-path test includes currently unoccupied cells, so an empty nearby
plain does not become a barrier. Delayed transport does not remove a barrier.
Otherwise, distance qualification needs anchors at least four physical hex
steps apart, including cylindrical map neighbors. Distance is deliberately a
weaker cause of separation: it needs more genetic divergence and persistence.

Different acquisition signatures can qualify as ecological isolation even in
the same hex. Each niche must independently sustain at least 20 living organisms
and three mutation steps of representative divergence for 360 turns. A minority
feeding lineage can therefore diverge while surrounded by many more organisms
that it eats. A single gained feeding gene is insufficient. A distinct signature
does not automatically imply a new species, and changing food preferences without
continued survival does not establish a branch. This is a coarse approximation
of ecological and assortative reproductive isolation, not a claim that feeding
genes alone determine real biological species.

Timers advance only when the engine performs a biological turn. With three
turns per ten physical days, 240 turns mean 800 days (about 2.22 360-day years),
360 turns mean 1,200 days (about 3.33 years), and 420 turns mean 1,400 days
(about 3.89 years), **after** qualifying divergence is present. Loss of population,
insufficient divergence, close spatial reconnection, loss of the distinct feeding
signature or changing isolation criteria resets the corresponding timer.
The desired first branch around 5–15 simulated years includes spread and genetic
change before this interval; it is a calibration target, not a scheduled event.

For barrier/distance qualification, the smaller deme receives a new child-species
ID. For ecological qualification, compare the total populations of the two
connected niche components and rename the smaller component with a single new
species ID. This lets a contiguous new feeding lineage retain one identity
instead of creating a separate species for every local deme it occupies. Equal
populations select the younger qualifying group, then the larger group ordinal.
Other members of the old species keep their label. Comparisons resolve in stable order and
cannot rename the same deme twice in a turn. Species are not merged when they
later meet, and their labels give no competitive advantage. Classification
creates no organisms and deletes none.

## Validation and limitations

`tests/headless/life-v2-isolation.test.js` covers reversible habitats, delayed
one-cell transport for plants and animals, flight delays, reverse water transport,
the route-distance bound, deterministic queries, species divergence without an
exact-genome majority, rare immigrants, reconnection, weaker distance thresholds,
no branching from geographic isolation alone, persistent minority feeding niches,
ecological timer resets, and a single identity for a connected feeding lineage.
Integrated transport survival,
checkpoint continuation and timing panels belong to the V2 model tests.

This is a spatial and ecological lineage classifier, not a biological proof of
reproductive isolation. Assortative feeding niches are discrete combinations of
three quantitative model capabilities; they omit many real mating mechanisms.
Demes have hex-scale resolution, modal representatives can change,
and strong population shifts can reset timers. Normal physical topology uses
static terrain/habitat; temporary weather changes selection and survival rather
than rebuilding geography. Barrier permeability represents rare passive or active
transport with a bounded corridor, not explicit rafts, seeds, currents or animal
journeys. There is no promise that every introduction diversifies or survives.
