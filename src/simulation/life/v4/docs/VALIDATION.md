# V4 validation — 2026-09-25

V4 is an experimental extension of V3's population representation. The user's
60–70 living species preference applies around day 15,000 and is a tuning aim,
not a cap, extinction instruction, or universal seed-independent assertion.

## Focused checks

`node --test tests/headless/life-v4.test.js` passes ten model integration checks:

- V4 introduction and rejection are atomic, physical state stays unchanged,
  V3 checkpoints are incompatible, and all 18 added loci must be present and
  valid in V4 checkpoints.
- Complete random state and partial turn credit reproduce continuation. Daily
  and bulk advancement agree through 1,440 days; inspection frequency and
  mutation of returned observations do not change biology.
- Counts reconcile across global, species, location, trait and display summaries
  after demographic growth, movement and selection. Candidate genomes have no
  population, and the per-species direction budget remains bounded.
- Equal-sized plants with different supplied morphology remain separate display
  groups while retaining exact organism and species counts. Appearance records
  are detached from model state.
- Propagules increase realized source departures; deep roots reduce them.
  Propagules improve difficult crossings without removing their rarity. Strong
  mobility still obeys the 0.12 total conductance limit, apart from bounded
  per-route integer rounding. Movement conserves the represented population.
- Independently scheduled observation jobs, reversed completion order and
  mutated transport copies agree with serial observations and continuation.
- Sexual-birth statistics count actual births from an accepted sexual phenotype,
  while births from asexual populations do not enter that statistic.
- Seeded two-locus proposals occupy the same bounded direction budget, change
  two distinct loci and do not create intermediate carriers. A persistent
  consumer endpoint can cross a losing mixed-feeding intermediate, but still
  fails without food or when its actual founding transfer exceeds the available
  food supply. Successful branching conserves population.

These checks establish implementation properties, not ecological calibration.
`npm run build` and `npm test` pass: 212 headless/rendering checks and 157
Chromium checks, with one existing duplicate desktop touch check skipped. These
include gene-specific trade-offs, finite-resource accounting, the corrected
larger-body probe, worker/headless continuation, saves, source/static/development
workers, profiling and localization. The final browser run took approximately
2.4 minutes; this is a check-run duration, not a simulation speed claim.

The new morphology and notebook were visually inspected in light and dark at
desktop and phone widths, including Polish wrapping, keyboard focus, assets and
disabled controls. Source/development loading passed as part of the browser
checks. `git diff --check` and the dependency/layer review passed; no application
runtime dependency was added. Browser checks cover Chromium, not cross-browser
numerical reproducibility or universal ecological balance.

## Reproducible paired panel

The panel uses `physical-world-4`, Medium (42 × 28), world seed `emergence`, and
the **same explicit biological seed**, `emergence:life-v3`, in both versions.
Sea hex 546 and river hex 555 each introduce 20 organisms into water. The
historical `land` selector chooses a land-surface river hex; it is not a dry-land
introduction. The harness also accepts `dry` or an explicit hex ID.

```sh
node scripts/check-life-v4-balance.js 15000 medium emergence water v3
node scripts/check-life-v4-balance.js 15000 medium emergence water v4
node scripts/check-life-v4-balance.js 15000 medium emergence land v3
node scripts/check-life-v4-balance.js 15000 medium emergence land v4
```

Optional arguments following the version set the explicit biological seed and
sample interval. Default observations are every 3,600 days and at the horizon.
The first day with more extinct than living species is reconstructed from all
recorded origin/extinction events, so a temporary crossover between samples is
not missed. It may reverse after subsequent diversification. The harness also
reports sexual species and organisms, diet counts, occupied land, new-locus
presence and body-size distributions; these are observations, never pass/fail
quotas.

At day 15,000 the preserved V3 baseline has:

| Introduction | Living | Extinct | First extinct > living | Sexual species |
| --- | ---: | ---: | ---: | ---: |
| Sea 546 | 92 | 87 | Day 14,277 | 0 |
| River 555 | 95 | 57 | Not reached | 0 |

The accepted V4 implementation with competition exponent **1.20** reaches:

| Introduction | Living | Extinct | Sexual species | Sexual organisms | Pure grazers / predators |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sea 546 | 63 | 59 | 54 | 87.3% | 23 / 2 |
| River 555 | 90 | 51 | 81 | 82.5% | 35 / 2 |

Both runs retain predation and plant body sizes up to 8. The river run has land
grazers at sizes 1–4; the sea run's final grazers remain aquatic. Fifteen of the
18 added loci occur in living sea lineages and all 18 occur in living river
lineages. Gene presence is not proof that every occurrence was adaptively
selected: some expression can be inherited with another useful change.

Living counts fall relative to V3 in both paired runs, and one reaches the
preferred 60–70 range. **Neither V4 run has an extinction-count crossover by
day 15,000.** The direct competition fixture demonstrates quicker displacement
under shared scarcity, but these aggregate trajectories do not yet demonstrate
an earlier first day with more extinct than living species. The exact numerical
target and crossover must not be reported as universally achieved.

A further sea-546 run uses the actual V4 UI default biological seed,
`emergence:life-v4`, against the same Medium `emergence` world:

```sh
node scripts/check-life-v4-balance.js 15000 medium emergence water v4 emergence:life-v4
```

At day 15,000 it has 105 living and 62 extinct species, 77 sexual species
(80.7% of organisms), 53 pure grazers and five pure predators, with no
extinction-count crossover. All 18 added loci occur in living lineages.
This additional seed demonstrates why the observed 63-species result cannot
be generalized to every new run or presented as a calibrated 60–70 range.

The user ran this validated 1.20 implementation and confirmed satisfaction with
its dynamics. It remains the active version. The 63–105 living-species range and
absence of an earlier extinction-count crossover in these samples are retained
as measured limitations; no quota or forced extinction was added to match them.

## Diagnostic trial and rejected tuning

An initial V4 trial retained V3's light budgets and background mortality,
sharpened contested allocation with a 1.2 individual-merit exponent and added
the 18 genes. At 15,000 days it had 36/39 living species and 26/28 extinct
species at the two sites, with 10/12 sexual species. Neither run had any consumer
species. This failed the requirement to preserve V3's successful unfolding and
was not accepted as balanced simply because it reduced species counts.

A controlled diagnostic reused V3's actual sea community at day 3,600, filling
the 18 new loci with zero for comparison only. Of 2,293 producer locations, an
initial plant-feeding gain was viable and sufficiently advantageous at 18 in
V3 and 17 in initial V4. Adding only leaf area, shade tolerance or buoyancy at
level 3 removed all viable first steps in initial V4, although the two-step
pure-grazer endpoint remained advantageous at over 1,100 locations. Forcing
sexuality also blocked the initial step because an independent candidate's
single-organism social context was compared with its established parent's
mate-supported context. These synthetic probes diagnose a search/fitness
barrier; they do not migrate V3 state or supply consumers to production runs.

A second trial added two-locus hypothetical paths, stronger sexual recruitment
and whole-parent-density substitution when assessing a within-species change.
Consumers returned without supplied directions: the sea run had 12 grazers and
one predator by day 3,600, while the river run had 12 grazers by day 10,800.
However, all pure producers and consumers in those samples had collapsed to body
size 1. That density-substitution approach was rejected before completing the
15,000-day panel.

The cause was measurable independently of the new genes. On ideal land with
100 size-3/trunk-4 parents and 100 size-2/trunk-0 competitors, a size increase
to 4 improved V3's rare-probe growth score by 0.01829. Whole-parent replacement
instead changed the score by −0.06611: instantly replacing every parent with a
larger body charged the finite resource pool for the entire population's new
body demand. That rejected scoring shortcut erased V3's existing competitive
size benefit. A conditional defense-hazard estimate must not replace the rare
resource probe or create this bulk body-size penalty.

The corrected scorer keeps V3's rare food and production probe. Only a consumer
facing an actual distinct predator receives a separate same-density estimate of
predation hazard; this estimate supplies no food and changes no resident state.
The rate calculation uses that hazard consistently for both death and parental
care's stress benefit. Social context still comes from actual conspecifics for
within-species changes, or the prospective quarter-parent founding size for a
new lineage; real founding transfers are checked again at their actual count.
Two of the existing eight trial slots can propose two legal changes at distinct
loci, with only the final endpoint eligible for ecological assessment. There is
no prescribed feeding transition, automatic sexual conversion or new carrier
population in this analytical search.

## Isolated competition experiment — not adopted

A temporary source copy changed only the individual competitive-merit exponent
from 1.20 to 1.30. The workspace implementation remained 1.20 throughout. The
experiment was stopped after the user accepted the current dynamics; it did
**not** complete the planned 15,000-day horizon.

The last completed samples were at day 10,800:

| Introduction | Living | Extinct | Sexual species | Pure grazers / predators |
| --- | ---: | ---: | ---: | ---: |
| Sea 546 / exponent 1.30 | 87 | 47 | 59 | 42 / 3 |
| River 555 / exponent 1.30 | 76 | 31 | 74 | 41 / 2 |

Neither had an extinction-count crossover by that completed sample. At the same
age the accepted 1.20 runs had 57/42 and 79/16 living/extinct species. Stronger
competitive weighting therefore changed diversification as well as extinction;
it did not imply a uniform reduction in species count. No final-horizon result
or adopted balance improvement is claimed for this stopped experiment.

## Limits

Two introduction sites and two biological seeds in one physical world cannot
establish a universal species range, extinction crossover, sexual majority,
trophic structure or persistence of every new trait. Biological seeds are
explicit and equal for paired comparison, but
adding loci changes random draw use and ensuing trajectories. No cross-browser
numerical identity or ecological realism is claimed. Full-world runs supplement
conditional trade-off fixtures; they cannot replace them.
