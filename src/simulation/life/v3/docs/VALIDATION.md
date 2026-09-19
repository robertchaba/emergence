# V3 validation — 2026-09-19

## Revision 3: mixed-feeding maintenance and construction

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
