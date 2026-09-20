# V3 validation — 2026-09-19

## Revision 5: canopy browsing, hunting effort and stationary plants — 2026-09-20

`npm run build` and `npm test` passed: 150 headless/rendering checks and 121
Chromium checks, with the existing desktop touch duplicate skipped. Inspected
small, medium and mixed-size plant fixtures in both themes at desktop and phone
widths, plus the real notebook's wrapping, keyboard focus and controls. Existing
browser checks cover EN/PL, assets, disabled controls, save rejection, reduced
motion and worker/headless continuation. No setup/build wiring changed.

New focused fixtures establish that:

- A size-5 mobile grazer can live on size-10, trunk-6 plants, and a single step
  to size 6 improves its net growth score by more than the 0.005 selection
  threshold. Small grazers retain a score advantage on tiny plants in both land
  and water. The benefit comes from real food after the ordinary body costs.
- Splitting tall plants into more source identities cannot supply repeated free
  foraging effort. Splitting short, vulnerable grazers cannot unlock protected
  tall-plant production. Existing finite-budget and conversion checks remain.
- Hunting effort's 12.5% increase improves an effort-limited predator's growth,
  while empty prey pools still give zero intake and negative growth. The existing
  prey-size rule denies size-8 grazers to a size-6 hunter without bite force,
  while a size-7 hunter can feed and grow. Extra size remains a cost where a
  smaller hunter already reaches the available prey.
- A single large stationary plant retains a large rosette beside a million
  tiny producers. Separate drawing budgets remain independent of organism count,
  stationary poses stay fixed, cosmetic-only frames skip static vegetation,
  extinction erases old marks, and maximum-zoom caps retain size differences.
  Browser damage repaint agrees with a fresh frame within the existing small
  antialiasing tolerance, including mobile neighbours and mixed plant sizes.

Revision 4 checkpoints are explicitly rejected; the existing continuation tests
exercise new revision-5 checkpoints with complete PRNG state. All biological
changes stay inside V3. Rendered size bands do not alter the common observations,
species classification, census or biological random stream.

### Same-world comparison

The observational panel compares pre-change revision 4 and revision 5 on
`physical-world-4`, seed `emergence`, Medium (42 × 28), with identical life seeds
and introduction sites: sea hex 546 and river hex 555. Both actually introduce
life in water. Each runs 14,400 elapsed days (40 years), sampled every decade,
without seeded consumers or supplied candidate directions. The script now also
reports `sizesByHabitat`: counts of pure producer/grazer/predator species at
each body-size level 1–10. A species occupying both habitats appears in both
habitat histograms; these are species counts, not population-weighted averages.

| Source / revision | Living species | Pure predators | Predator hexes | Land grazers size ≥4 / all |
| --- | ---: | ---: | ---: | ---: |
| Sea 546 / 4 | 60 | 1 | 4 | 2 / 11 |
| Sea 546 / 5 | 84 | 6 | 123 | 5 / 25 |
| River 555 / 4 | 91 | 4 | 42 | 3 / 27 |
| River 555 / 5 | 89 | 7 | 162 | 2 / 29 |

Final land grazer size histograms, levels 1–10:

- Sea / 4: `7,1,1,1,0,1,0,0,0,0`; sea / 5: `8,10,2,2,2,1,0,0,0,0`.
- River / 4: `10,9,5,2,1,0,0,0,0,0`; river / 5: `12,7,8,2,0,0,0,0,0,0`.

The sea run retained size-6 land grazers in both revisions, with more medium
and larger grazing identities in revision 5. The river run did **not** show a
uniform shift to larger grazers (maximum 4 rather than 5), and its plant
community remained mostly small. Final predators occupied size levels 1–3 in
both revised runs; the controlled prey-size fixture demonstrates the potential
for larger hunters, not an observed giant-predator outcome in this panel.
Final revision-5 organisms/occupied hexes were 194,139/744 and 551,107/784.
Photosynthesis-plus-grazing was absent at every revised decade sample; transient
lineages between observations are not excluded.

Reproduce the current panel:

```sh
node scripts/check-life-v3-balance.js 14400 medium emergence water
node scripts/check-life-v3-balance.js 14400 medium emergence land
```

The conditional size-selection fixtures and these two introductions do not
establish universal large herbivores, permanent carnivory, or calibrated rarity.
Plant communities, demographic paths and size distributions also change through
feedback; a local advantage is not a guaranteed full-world trajectory. No runtime
speed improvement or cross-browser numerical equivalence is claimed. More
stationary marks increase bounded full-frame work, while plant-only cells avoid
cosmetic repaints. The original artwork, world physics, V1/V2 and dependencies
are retained. Final `git diff --check` and scope/dependency review passed.

## Revision 4: habitat expansion, consumer movement and predator establishment — 2026-09-20

`npm run build` and `npm test` passed: 146 headless/rendering checks and 121
Chromium checks, with the existing duplicate desktop touch check skipped.
Light/dark notebook screenshots were inspected at desktop and phone widths;
light chart bands are pale with distinct outlines, and dark fills retain their
previous colours. Existing browser checks cover EN/PL wrapping through 320 px,
visible keyboard focus, disabled controls, original artwork, save rejection and
browser/headless continuation. `git diff --check` and the dependency/determinism
review passed. The pre-existing package version edit was preserved.

New controlled fixtures establish that:

- A persistent land-adaptation direction can settle a reachable shore or the
  land component of its river hex, transferring existing organisms and retaining
  its aquatic parent. Opportunity queries leave state and PRNG unchanged, and
  saved/restored continuation agrees.
- Absent land, permanent ice, a steep connection with inadequate settlement
  support, and an insufficient parent pool do not receive a new land population.
- Basic consumer movement has zero additional maintenance/construction cost,
  while higher levels and photosynthetic movement remain paid. Moving grazers
  obtain a selectable advantage from real plants, and moving hunters from prey;
  empty food pools still give zero intake.
- Mobile grazers and predators send more than five times as many emigrants to
  a food-bearing neighbour as to an otherwise comparable empty neighbour in the
  fixed one-turn fixture. Census totals still reconcile to births minus deaths.
- A carnivore branch can establish at a smaller viable density when a quarter
  of its parent pool would overpopulate the prey niche. Actual post-transfer
  growth is positive and total population is conserved.

Existing defended-tissue, finite-budget, conversion-loss, label-splitting,
branch-novelty, candidate-budget and deterministic replay checks also pass.
Revision 3 checkpoints are explicitly rejected; no biological state migration
or automatic species conversion is tested or offered.

### Same-world comparison

Pre-change revision 3 and final revision 4 used `physical-world-4`, seed
`emergence`, current Medium (42 × 28), identical life seeds and introduction sites,
with no seeded consumers or supplied adaptation directions. Both ran for 14,400
elapsed days (40 years), observing each decade. The sea selector chooses hex 546;
the land-surface selector chooses river hex 555, whose founders actually occupy
**water**. Thus these are two aquatic introductions, not an aquatic-versus-dry-land
experiment. The script now reports `introductionHabitat` to make that distinction
explicit; its historical site selection remains unchanged.

| Source / revision | Living species | Occupied land hexes | Mobile / all pure grazers | Pure predators | Hexes with pure predators |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sea 546 / 3 | 27 | 0 | 0 / 16 | 0 | 0 |
| Sea 546 / 4 | 60 | 285 | 27 / 27 | 1 | 4 |
| River 555 / 3 | 26 | 0 | 0 / 13 | 1 | 33 |
| River 555 / 4 | 91 | 324 | 50 / 50 | 4 | 42 |

At year 10, the revised sea run already occupied 326 land hexes; its baseline
occupied none at all four samples. By year 20 the revised sea run had 33 pure
grazer species, all mobile, and one pure predator. At year 30 it had three pure
predators on 15 hexes, declining to one on four hexes at year 40. The revised
river run's four final pure predators were all mobile; cumulative recorded
predation deaths were 511,950 versus 79,598 before. Final organisms/occupied hexes
were 138,550/733 for the revised sea run and 264,154/770 for the river run.
Photosynthesis plus grazing was absent at all eight revised decade samples;
transient lineages between samples are not ruled out.

Reproduce the current panel:

```sh
node scripts/check-life-v3-balance.js 14400 medium emergence water
node scripts/check-life-v3-balance.js 14400 medium emergence land
```

These observations support the intended direction in two sites of one world.
They do not prove universal colonization, eventual mobility in every lineage,
persistent carnivory, or a species-count target. Colonization expands the
available range and can increase diversity and simulation work. The movement
subsidy, settlement weights and ecological scores are explicit game-model
approximations, not biological measurements. Browser validation covers Chromium;
no cross-browser numerical identity or runtime speed improvement is claimed.

## Historical revision 3: mixed-feeding maintenance and construction

`npm run build` and `npm test` passed: 136 headless/rendering checks and 83
Chromium checks, with the existing duplicate desktop touch check skipped.
Both themes were visually inspected at desktop and phone widths, including
EN/PL species disclosure, focus, wrapping and intermediate theme-effect frames.
The full suite also covers unavailable storage, disabled controls, original
assets, live playback, responsive bounds and browser/headless agreement.

The focused ecology fixture evaluates all seven nonempty feeding combinations
in the same shallow-water resource setting. Single-system scores and resource
access match revision 2. Compared with the same phenotype under revision 2's
costs, photosynthetic grazing's net growth falls by more than 60%, other dual
strategies by more than 20%, and all three systems remain viable with supplied
food. These are controlled score comparisons, not measured mutation probabilities
or expected prevalence in every world. Empty-food versions of those mixed
fixtures have negative growth; hypothetical candidates receive no free food.

The branching fixture now uses a two-step specialist grazer direction and 100
parent organisms, which can support the proposed founding population under the
finite local food budget. It still checks persistent qualification, separate
lineage identity, population conservation and replay. The crowded 600-organism
fixture still rejects a rare advantage that cannot support the actual split.
Revision 2 checkpoints are explicitly rejected. No mutation-search, resource,
species-novelty or population-transfer rules were relaxed to pass these checks.

### Same-world observations

`physical-world-4`, seed `emergence`, current Medium (42 × 28); introductions at
water hex 546 and land hex 555. The pre-change panel ran revision 2 to 7,200 days.
The final revision 3 panel ran to 14,400 days, with no seeded consumers or forced
branches. At 7,200 elapsed days (20 years):

| Introduction | Rules revision | Species | Mixed feeders | Photosynthesis + plants | Plant + animal feeding | Pure predators |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Water | 2 | 32 | 4 | 1 | 3 | 3 |
| Water | 3 | 16 | 0 | 0 | 0 | 0 |
| Land | 2 | 29 | 3 | 1 | 2 | 1 |
| Land | 3 | 18 | 0 | 0 | 0 | 0 |

At 40 years, revision 3's water run had 27 species, including 16 pure grazers,
and no mixed feeders or predators. The land run had 26 species, 13 pure grazers,
one plant/animal omnivore and one pure predator. One species had movement, and
cumulative predation deaths were 79,598. Neither final community contained
photosynthesis plus grazing. All eight decade checkpoints had zero photosynthetic
grazers; this does not rule out transient lineages between checkpoints.

Reproduce the final panel:

```sh
node scripts/check-life-v3-balance.js 14400 medium emergence water
node scripts/check-life-v3-balance.js 14400 medium emergence land
```

The script now reports acquisition-pair counts and pure grazers. Pair counts
overlap for three-system genomes; `mixedFeeding` counts each species once.
Selection costs also slow some routes toward specialist consumers and can alter
diversity, predation and extinction trajectories. These two introductions in one
seeded world support the intended direction, not calibrated rarity, a species
target, a guarantee of carnivory, or universal long-term balance.

## Revision 2: trophic tuning and ecological distinction

Validated `v3-populations-2` with `npm run build` and `npm test`: 135
headless/rendering checks and 67 Chromium checks passed; the existing duplicate
desktop touch check remains skipped. New regressions establish that movement
can pay for itself through hunting available consumer prey and improve escape,
while maintaining trait costs and negative growth without prey. A viable,
population-supported feeding change that duplicates its parent's grazing niche
is rejected; the same controlled fixture branched under revision 1. Existing
finite-resource, label-splitting, checkpoint and inspection-independence checks
continue to pass.

Browser checks cover the collapsed native adaptation disclosure, keyboard
expansion, retained selection, EN/PL changes, short approximate counts, disabled
directions, absent portraits and responsive bounds through 320 px. Inspected
light/dark screenshots at desktop and phone sizes, including large producer
coverage and dots, focus, wrapping and disabled entries. The development server
completed actual V3 introduction and pause without page errors. Locale-key parity,
documentation links, dependency direction and diff checks passed. No runtime
dependencies, V1/V2 files, supplied artwork or licence files changed.

### Medium-world ecological panel

Repeat the current rules from the repository root:

```sh
node scripts/check-life-v3-balance.js 28800 medium emergence water
node scripts/check-life-v3-balance.js 28800 medium v3-compare-b water
```

Introductions use the benchmark's stable suitable-site selection: water,
nonpermanent ice, 15–30 °C, closest to the equator, then hex ID. The resulting
sites are 1140 and 1142. Both founders have no movement, plant feeding or animal
feeding; consumer and movement traits arise during the run. The final rules
were advanced through 14,400 days, checkpointed, then continued to 28,800 days.
The replay suite separately verifies continuation independence. Years below
mean elapsed 360-day years. Counts are living species, with carnivores including
mixed feeders; pure predators use only animal feeding. Mobility is movement
greater than zero, regardless of diet, so these columns overlap.

| Seed / rules | Elapsed years | Species | Carnivorous | Pure predators | Mobile |
| --- | ---: | ---: | ---: | ---: | ---: |
| `emergence` / revision 1 | 40 | 98 | 0 | 0 | 0 |
| `emergence` / revision 2 | 40 | 54 | 11 | 3 | 7 |
| `v3-compare-b` / revision 2 | 40 | 41 | 6 | 3 | 5 |
| `emergence` / revision 2 | 60 | 60 | 6 | 2 | 6 |
| `v3-compare-b` / revision 2 | 60 | 45 | 7 | 4 | 5 |
| `emergence` / revision 2 | 80 | 65 | 11 | 3 | 7 |
| `v3-compare-b` / revision 2 | 80 | 53 | 8 | 3 | 6 |

At year 80, the first world had 138,010 organisms across 811 hexes and the
second 295,256 across 913 hexes. Both contained three pure predator species.
The ten-year observations from years 40–80 ranged from 54–68 species in
`emergence` and 41–53 in `v3-compare-b`; they do not establish an equilibrium.

The baseline is the unchanged model at commit `b6277a8`, with identical physical
settings, site, life seed and elapsed days. Its medium-world counts at years
10/20/30/40 were 39/78/97/98, with no carnivorous or mobile species at those
observations. This is not a reproduction of the user's 175-species world, whose
seed and age were unavailable. A small-world land introduction (`emergence`,
hex 173) had five species and no carnivory or movement after ten years under
revision 2, illustrating that the tuning does not force feeding transitions.

Species counts are measured outcomes, not a hard cap or a guaranteed equilibrium.
Stricter novelty can reject subtle niches; hunting changes population and
extinction trajectories. These few worlds do not prove global ecological
balance, permanent coexistence, or a 50–60-species result for every seed.
No runtime speed comparison is claimed for this panel.

## Historical revision 1 verification

Validated `v3-populations-1` on Node 26.8.1, Apple M1 / arm64. The model is an
experimental ecological approximation. Software checks establish the properties
below, not biological calibration or equivalence to the preserved V1/V2 models.

## Completed checks

- `npm run build` passed; the static build includes the full root licence.
- `npm test` passed: 134 headless/rendering checks, 67 Chromium checks, and the
  existing duplicate desktop touch check skipped.
- Development-server atlas startup, actual V3 introduction and pause completed
  without browser errors.
- Inspected the new adaptation controls in both themes, at desktop and phone
  widths, in English and Polish. Browser checks cover wrapping through 320 px,
  keyboard focus, selected and disabled directions, estimated-range highlighting,
  established trait display, and preservation of population/day through switches.
- Existing worker/headless agreement, playback, extinction/reintroduction,
  storage failure, original assets and rendering checks continue to pass.
- `git diff --check`, localization-key parity, local documentation links and
  dependency-direction review passed. V1/V2 source and research, original artwork,
  licence, package manifest and lockfile are unchanged; runtime dependencies
  remain empty.

## Focused model checks

The 13 tests in `tests/headless/life-v3.test.js` cover atomic introduction and
rejection, independent checkpoint identity, biological cadence and partial turn
credit, replay across batching/inspection/checkpoints, detached observations,
population conservation, species/hex reconciliation, unique population pools,
global candidate bounds, estimated ranges without invented carrier counts,
and ordinary extinction/restart.

Controlled ecological fixtures verify that hypothetical feeding directions do
not feed or change demographic state, a persistent viable trophic branch can
establish with conserved totals, equivalent and stronger incumbents prevent
redundant branches, and whole-species fixation cannot converge to an existing
genome. A rare candidate that grows positively but would starve after the proposed
25% population split does not receive a species identity.

Nine tests in `tests/headless/life-v3-genes.test.js` cover valid reversible
single-locus mutations, conditioned seeded founder variation, paid trait effects,
independent elevation/depth tradeoffs, finite shared resources, defended grazing,
and consumer/prey label-splitting invariants. These are fixtures of the adopted
rules, not evidence that every transition evolves in an ordinary run.

During performance work, complete 720-day checkpoints and observations from two
seeded fixtures agreed before/after score memoization, including random streams.
Final replay tests verify the completed implementation. No wall-clock performance
assertions are imposed on automated tests.

## Reproducible workload panel

Run from the repository root:

```sh
node scripts/benchmark-life-v3.js 1440
node scripts/benchmark-life-v3.js 4320
```

For each seed and habitat, both versions receive the same generated small world,
site and elapsed days. Site selection is stable: nonpermanent-ice land or water,
15–30 °C, closest to the equator, then hex ID. V3 still has different founders,
demographic rules, evolutionary search and species criteria, so these are
different ecological workloads. Timings measure advancement separately from the
first final observation. There is no render or browser-worker transfer in these
Node timings.

The table records single samples. Unchanged V2 baselines were measured earlier
in the same session and retained while final V3 was measured serially, with no
parallel test jobs. Large ratios on nearly extinct land runs mostly reflect
different living workloads and must not be sold as an algorithmic speed factor.

| Seed / habitat (hex) | 1,440 days V2 / V3 | 4,320 days V2 / V3 |
| --- | ---: | ---: |
| `emergence` / land (173) | 408 / 280 ms | 3,858 / 1,550 ms |
| `emergence` / water (168) | 826 / 351 ms | 15,413 / 13,143 ms |
| `v3-compare-b` / land (168) | 1,092 / 37 ms | 33,000 / 147 ms |
| `v3-compare-b` / water (169) | 947 / 197 ms | 24,130 / 4,479 ms |

Final 4,320-day workload and checkpoint sizes:

| Seed / habitat | Living species V2 / V3 | Population records V2 / V3 | Checkpoint bytes V2 / V3 | First V3 observation |
| --- | ---: | ---: | ---: | ---: |
| `emergence` / land | 8 / 9 | 1,328 / 51 | 281,689 / 41,855 | 2.67 ms |
| `emergence` / water | 10 / 31 | 1,594 / 821 | 335,684 / 156,068 | 60.47 ms |
| `v3-compare-b` / land | 23 / 1 | 4,214 / 3 | 784,607 / 19,195 | 0.15 ms |
| `v3-compare-b` / water | 26 / 22 | 2,604 / 843 | 532,611 / 135,448 | 41.78 ms |

V3 was faster and its serialized state smaller in all eight measured cases.
The busiest water case improved by only about 17%; candidate scoring and complete
estimated-range observations remain material costs with many coexisting species.
The model does not cap species count. All eight final V3 checkpoints had distinct
extant accepted genomes; that does not establish permanent ecological separation
under later environmental changes.

The script also holds 18 population records fixed and increases represented
organisms from 360 to 360,000. Over 300 one-turn runs after 20 warmups, mean times
were 0.0974 and 0.1032 ms respectively. This isolates the absence of individual
action loops. It does not cover increasing the number of hexes, species or
candidate comparisons.

## Limits

Stochastic rounding changes demographic variance; pooled reserve bookkeeping and
expected feeding transfers do not recover individual energy or kill histories.
Estimated adaptation directions are not carrier-frequency estimates. Sampling
can miss small opportunities and changes between assessments. Selection-guided
search can miss neutral or harmful intermediate mutations. Branch acceptance
tests immediate local viability, not permanent coexistence. Ecological novelty
is an operational model criterion, not a taxonomic or reproductive-isolation
claim.

No universal survival, diversification pace, long-run numerical error bound,
performance multiplier or cross-browser numerical identity is established.
Browser verification is limited to Chromium. Larger and more diverse worlds
can require more work even when individual population counts are cheap.
