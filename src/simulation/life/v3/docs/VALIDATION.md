# V3 validation — 2026-09-19

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
