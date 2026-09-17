# V2 biological rules — 2026-09-17

This is a new specification of the implemented V2 candidate, not an amendment to
V1's historical research. Its numerical coefficients are game-model choices;
they are not estimates of biological constants. Source modules and focused tests
make these choices reviewable. Species emerge from inherited variation, local
resources, survival, reproduction and persistent isolation. No branch is scheduled.
The current revision is `v2-cohorts-2`. It supersedes the original revision's
unbounded living-genome representation and isolation waiting periods; the
original validation panel remains historical evidence for `v2-cohorts-1`.

## 1. State, time, initialization and accounting

The physical world is copied once and remains read-only. Life uses its explicit
physical day and shared `climateAt` readings, including enabled seeded weather.
Biology completes three whole turns per ten elapsed days: offsets 4, 7, 10 after
introduction, repeated. Play speed changes throughput, never coefficients. The
first accepted introduction places 20 size-3 photosynthetic organisms in the
selected hex with one body-cell-capacity of stored energy. No density control or
implicit reseeding exists. Every valid hex accepts an introduction; hostile sites
can go extinct. An existing living attempt rejects another introduction atomically.
After extinction, an explicit introduction archives the old attempt and starts a
new deterministic stream and identity at the current day.

Founders have no movement, feeding, defense, structure, senses, flight or sexual
trait. The initial habitat is water if sea, lake or river is present, otherwise
land. Land founders use adaptation 1 at effective moisture at least 0.85,
adaptation 2 at least 0.50, and adaptation 3 otherwise; accessible water raises
effective moisture to at least 0.85. These introduction thresholds are distinct
from the later 0.80/0.50/0.25 habitat-performance targets. Temperature expression
maximizes current efficiency, tied in order absent, 0,
−1, +1, −2, +2. This site matching happens only at introduction. Later compacting
can replace represented genomes as described below; it never searches for the
genome best suited to a location.

Each cohort contains an exact integer population with identical complete genome,
species, hex, habitat, component provenance, stored energy and any pending passage.
One organism is counted once on one physical hex. Transit carriers remain at their
source until arrival. Observations aggregate the actual cohorts consistently by
hex, species, variant, gene expression and carrier location. Queries are detached,
read-only data, without biological random draws. **Superseded in `v2-cohorts-2`:**
the original rule that no rare genotype is discarded. Current cohorts represent
bounded local variation, while conserving every represented organism count.

### Compact local variation

After ecology and newborn establishment, before species classification, each
pool retains at most three actual complete genomes. A pool is defined by species,
physical hex, current habitat, acquisition signature and pending passage plan.
Residents and travellers are separate; passage plans must agree on destination
hex and habitat, due turn and arrival probability. Different feeding niches,
locations and species are never folded together. This is three variants **per
comparable pool**, not three per hex, species or world. Multiple niches and
pending plans can require many pools. Energy and component provenance remain
separate cohort records even when they share a representative genome.

Pools with at most three variants retain them all. Larger pools keep the two
most abundant genomes, breaking ties by earlier establishment and stable genome
ID. The third slot uses the lowest `−log(1 − U) / population` among the remaining
genomes. `U` is the first and only draw from a Xoshiro128** substream seeded by
the serialized tuple of attempt seed, `compact-variants-1`, pool key and genome
ID. These inputs are checkpointed, so each ticket is reconstructible without
an additional evolving random stream. The main demographic random state is
unchanged by ticket selection. Day, iteration order and current abundance do
not change `U`; abundance changes the priority denominator. Ties use the same
abundance, establishment and ID order.

The stable weighted slot gives even a singleton a chance to survive compacting
without rerolling all candidates each turn. Retained genomes can continue to
mutate, reproduce, compete and diverge. This preserves opportunities, not every
mutation or candidate: the budget can suppress a useful rare lineage.

Carriers of excess genomes adopt the retained genome with the smallest genetic
distance; equal distances use the abundance order above. No averaged genome is
invented. Their integer counts, species IDs, hexes, habitats, component provenance
and passage plans remain unchanged. Stored energy becomes the smaller of its
previous value and the target genome's capacity, so no reserve is added. This
can change body size and trait investment without a construction payment:
phenotype and embodied body mass are approximate, even though organism counts
remain exact. It can also alter genetic frequencies, local adaptation and later
ecological outcomes. It is not an exact optimization or a calibrated measure of
real biological variation.

Classification then evaluates the compact represented population. A full pool
does not force speciation, merge species or stop future mutation. Historical
genome records, including extinct or unestablished variants, are retained;
compacting bounds active representatives rather than the historical registry.
`stats.variantReassignments` accumulates the population reassigned at each pass;
the same carriers can contribute more than once, so it is not a count of unique
organisms. Observation approximation metadata identifies `local-representatives`,
the pool definition and the three-slot budget. There is no new UI control or
setting to switch this representation off.

## 2. Turn order and energy

1. Complete due delayed passages; surviving failed travellers remain at source.
2. Attempt simultaneous adult movement, charging attempts before feeding.
3. Allocate the one shared 2,000-unit light budget per occupied hex.
4. Share accessible plant production across eligible grazers, then resolve hunts.
5. Pay maintenance; sample starvation and independent background mortality.
6. Pay for at most one offspring per surviving eligible parent; choose a mate,
   recombine, mutate and attempt establishment/dispersal.
7. Join newborns after adult actions, cap/round stored energy, compact local
   variants, classify species, and merge identical resulting cohorts.

No newborn feeds, moves or reproduces on its birth turn. A body contains
`1 + 3 size (size − 1)` cells. Maximum stored energy is its cell count. See the
gene catalogue for the complete maintenance and construction formulas. Larger
bodies require more absolute and per-cell maintenance/construction; speed,
defenses, senses, structural support and every other expressed capability also
cost energy. These costs reduce surplus and therefore fertility. Losing a trait
saves costs but loses its function; there is no universally beneficial upgrade.

When available energy is below upkeep, starvation probability is
`1 − available/upkeep`. Combined mortality is
`1 − (1 − starvation) × (1 − 0.006)`. Background mortality supplies demographic
turnover even in benign conditions. Surviving hungry organisms have zero reserve;
others keep energy after upkeep and any paid birth cost. Reproduction is energy
limited; there is no forced global carrying capacity or protected species count.

Stored energy rounds down to a multiple of 1/64 after each turn. Loss from this
rounding per living organism is less than 1/64 per turn, but this is **not** a bound on long-run
population, extinction or branching error. `energyQuantum: 0` is a comparison
mode with identical rules and unrounded energy. Both modes still compact variants;
the separate reserve cap during reassignment can lose more than 1/64. Counts
remain exact for the represented population in both modes.

## 3. Light competition, size and specialization

Weighted capped water filling shares 2,000 light units across all organisms in a
hex, including both habitats of a river hex. Each producer's light cap is its
cells times its photosynthetic allocation. Land weight multiplies this cap by
its derived light-competition score; body height/trunk invests in shade priority.
Water producers use the cap directly. Unused light is redistributed without
exceeding any producer's cap. Production is absorbed light × 2.4 × temperature
factor × habitat factor.

Trunks, large bodies and structural investments are costly, but taller land
producers acquire more contested light. Small bodies are economical, while large
plants gain a feeding refuge from consumers unable to reach their foliage. There
is no predefined tree or herbivore species. Roles in the notebook describe
current acquisition systems, not taxonomic classes.

Multiple energy systems divide allocation and pay an additional specialization
penalty. Movement and flight additionally reduce photosynthetic efficiency.
Mobile producers, photosynthetic grazers and other mixed forms are valid, but
a focused strategy is more efficient at its chosen pathway. Its success still
depends on food, climate, predators and competition. A trunk slows movement rather
than prohibiting it outright.

## 4. Grazing and plant defenses

Grazers and plants share a hex and habitat. A consumer cannot reach a plant taller
than its body-size/handling/flight-dependent reach. Poison, spines and armor reduce
edible production; detoxification, bite force and armor supply counteradaptations.
`grazingAccess` defines the complete fractions. At low light saturation the base
accessible fraction is 0.44, declining to 0.20 at saturation. Thus abundant plants
never offer all their production as food. Sparse vegetation can lose a larger
fraction of its growth, making costly defense more useful under feeding pressure.

Eligible plant density is weighted by accessibility, excluding the consumer
itself. Encounter probability is `D²/(D² + (12/sensoryReach)²)`. Successful grazers demand up to
`5 × cells × grazingShare`. Each plant
source is divided into accessible bands: only sufficiently resistant/reaching
consumers can use each band. Simultaneous requests share shortages proportionally;
remaining demand can seek remaining eligible bands. A rare resistant grazer cannot
unlock protected tissue for vulnerable grazers. Splitting a consumer cohort gives
no allocation priority. Total removal stays within the largest accessible fraction.
This is a pooled feeding approximation, not individually chosen leaves or bites.
Each source loses production only once across the combined demands.

Consumers receive 60% of consumed energy, multiplied by their local environmental
performance. Plants lose the corresponding production before maintenance. Under
scarcity, defenses can preserve growth and fecundity; without meaningful feeding
pressure their costs can outweigh protection. The model has no rule that assigns
a useful mutation because a plant was eaten.

## 5. Predation and arms races

A feeding consumer can be prey. Producers without feeding are grazed rather than
killed. `preyEligible` compares prey cells with predator cells and handling;
a very small hunter cannot consume a very large grazer. Each hunter attempts at
most one hunt per turn, in seeded population-weighted random order. Eligible
individual density determines `D² / (D² + (12/sensoryReach)²)` encounter chance.
The hunter cannot target itself; cannibalism of another individual is possible.

Capture responds to relative speed, senses, flight, size, bite/handling, armor,
spines, poison and detoxification; see the gene specification and `ecology.js`.
Probabilities are bounded, so superior traits confer an advantage without
certainty. Eyed prey detect danger; eyed predators detect prey. Faster prey can
escape but pay upkeep and construction. Stronger hunters can counter defenses
but pay their own costs. These opposing survival/reproductive differences are
the arms race; neither side receives scripted upgrades.

Kills remove one individual immediately, including its pending hunt if applicable.
A kill supplies 60% of the smaller of processing capacity
`5 × cells × predationShare` and prey body cells plus reserve, adjusted by the
hunter's environmental performance. Unused food is lost. Dead animals cannot act;
identical successful outcomes can recombine into cohorts without duplicating prey.

## 6. Inheritance, sex, pressure and drift

All 20 genes, ranges, prerequisites, costs and mutation transitions are specified
in [GENES.md](../genes/docs/GENES.md). A paid offspring ordinarily inherits its
parent's complete genome. Mutations are undirected single allowed trait changes.
Eyesight has a threefold chance of being the selected mutation locus, representing
an easy sensory precursor; gain and loss are both possible. No intelligence trait
is present. Flight and specialized sensing remain costly and can be lost.

The per-offspring mutation probability is `0.0016 × (1 + 7 × pressure)`, bounded
at 0.0128. Pressure is the maximum of local environmental mismatch, lost potential
light, fraction of production removed by grazers, relative maintenance shortfall,
and encounter/hunt stress
(0.8 for targeted prey, 0.6 for a failed hunter). Mortality additionally selects
among existing variants. Pressure raises mutation frequency, not its direction,
and cannot create births in organisms lacking energy. This stress response is an
explicit game approximation; selection does not universally cause mutations in
real organisms. Even at zero pressure, baseline mutation and stochastic deaths,
establishment, dispersal and reproduction maintain drift. Drift is random change
in carrier frequencies, distinct from mutation introducing an allele.

A sexual parent can use another local same-species, same-habitat sexual carrier
with the same inherited photosynthesis/plant-feeding/animal-feeding signature;
selfing is excluded. All mortality is resolved before the mate pool is built;
waiting travellers cannot mate. Mate encounter is `N/(N+2)`. Two genomes recombine by choosing
a parent independently at each locus, with photosynthesis/trunk linked to preserve
their prerequisite. Sex combines existing useful alleles; it does not inspect the
environment or choose the best child. Offspring then face ordinary mutation and
selection. In the absence of a mate, facultative asexual reproduction remains
possible while sexual-trait costs still apply.

Sex adds `0.01 × body cells` energy to maintenance per turn and
`0.08 × body cells` energy to offspring construction, with additional mate-search
failure. Asexual establishment
viability is 0.82; sexual viability is `0.82 + 0.14 × pressure`, at most 0.96,
before local competition and passage losses. This bounded, paid stress-resilience
advantage is a deliberate abstraction of complementary inheritance/provisioning,
not a claim that sex is universally superior in nature. In stable environments
clones retain a cost advantage; under pressure sex gains both recombination and
higher establishment viability. No successful sexual lineage is guaranteed.

## 7. Establishment and invasion resistance

All parents pay before knowing whether their offspring establishes. Every parent
first spends its own construction cost. If mutation or recombination makes its
child more expensive, that individual also pays the difference from its remaining
energy. A parent unable to fund the difference loses the initial investment and
the child never establishes. A cheaper child receives no refund. Parent cohorts
split by these actual payments, so another parent cannot subsidize an expensive
mutant. This preserves the body-investment cost of acquiring large/complex traits
during reproduction. The later phenotype replacement used for compacting is a
separate approximation and does not preserve that body-investment accounting.
For producers, shared hex light saturation supplies occupancy and established producers supply their
population-weighted competition score within the same habitat: uncrowded
photosynthetic surplus divided by per-cell construction cost, multiplied by land
light priority on land only. Thus smaller economical plants can possess a real
advantage, while trunks confer no fictitious underwater shade advantage. The `establishmentProbability`
function reduces recruitment near full occupancy unless the newcomer has a clear
local competitive advantage. Equal competitors retain a small establishment
chance so demographic turnover and drift are not abolished. This applies to
resident offspring and newcomers alike, rather than privileging a species ID.
Empty sites permit establishment subject to habitat and viability. Consumer
recruitment remains energy/food limited through subsequent maintenance and feeding.
A newcomer receives no free food or displacement of existing adults.

Dispersal and adult movement, travel delay, land/water reversibility and species
classification, including persistent divergent acquisition niches and assortative
mating, are fully specified in [ISOLATION.md](ISOLATION.md). Offspring
choose dispersal with probability 0.045, with destinations sampled uniformly
among model-valid route descriptions; the remainder attempt their source.
Crossing failures and failed recruitment consume the paid birth investment.

## 8. Physical fluctuations

New generated worlds carry `seeded-weather-1` metadata. Shared physical climate,
used by the atlas and V2 alike, adds smooth bounded seed/day-dependent temperature
and humidity anomalies, water-surface variation within existing basins, and
current ice cover. V2 applies the resulting water exposure and ice cover to
habitat performance. Weather draws do not consume the biological random stream.
Different life histories on one world therefore experience the same weather.

The hydrological datum, river network, coastline and permanent geographic regions
remain fixed. Water fluctuations do not regenerate terrain, and seasonal ice
exposure is not a moving, erosion-producing glacier simulation. Weather can alter
selection or eliminate marginal populations; it never creates a species directly.

## 9. Identity, continuation and limits

Xoshiro128** maintains four serialized words. Binomial geometric waiting-time
sampling retains integer demographic variance; stable cohort/action order and
explicit tie-breaking are versioned. Complete V2 checkpoints include biological
turn credit, random state, genomes, species, waiting routes, classification timers,
world/weather identity and attempts. The checkpoint format remains
`emergence-life-v2-checkpoint-1`, with `rulesRevision: v2-cohorts-2`; older V2
rules and V1 checkpoints are rejected rather than converted. The fixed compacting
tickets are reconstructed from saved inputs, not resumed partway through a
second stream. Cosmetic names are deterministic and do not draw biological randomness.
The model publishes only completed states; the last 180 day records are bounded
presentation history, not the full evolutionary record.

This remains a coarse cohort ecology with no age structure, diploid chromosomes,
sex differentiation, individual mate preferences, detailed anatomy, nutrient cycles or individual
positions. Sensing modifies encounters/capture, not a ray-traced scene. “Radar”
means echolocation, not a technological radio organ. Species classification is
an operational spatial/genetic approximation, not a biological species theorem.
Passing software tests is not ecological calibration or proof of cross-browser
floating-point equivalence.

Research context: the recombination motivation is supported by the experimental
study [McDonald et al., 2016](https://www.nature.com/articles/nature17143).
[Wei et al., 2022](https://www.nature.com/articles/s41467-022-32353-6) demonstrates
mutation-rate changes under demographic/environmental conditions in bacteria.
Neither paper supplies V2's constants or validates its universal trait model.
