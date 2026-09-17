# V2 validation — 2026-09-17

V2 is experimentally balanced, not scientifically calibrated. The checks below
separate implementation invariants, browser integration and exploratory evolution.

## Software checks

- `npm run build`: successful static production build, including the full licence.
- `npm test`: 102 headless/rendering checks and 63 Chromium checks passed, with
  the existing duplicate desktop touch test skipped.
- Both themes inspected on desktop and phone, including Polish wrapping,
  all 20 traits, skeleton/armor alternatives, native focus and carrier controls.
- The real browser worker agrees with headless V2 at equal completed time.
  Theme/language, camera, playback and query cadence do not affect biology.
- All 13 V1 files match SHA-256 hashes captured before this task. Existing user
  edits remain preserved; V2 imports no V1 implementation.
- Dependency/determinism review and `git diff --check` passed. Runtime package
  dependencies remain absent; no browser services, unseeded randomness or
  wall-clock reads were added to simulation.

The climate playback browser check uses a fixed seed: under seeded weather, a
random site can legitimately retain the same rounded temperature during a short
interval. The deterministic fixture preserves the visible-change assertion and
passed three repetitions at each viewport.

Focused checks cover reversible gene transitions and all trait costs; baseline
and pressure-dependent mutation; sex/recombination; large-body feeding refuges;
height/light investment; consumer defenses and counteradaptations; specialization;
finite accessible feeding and equivalent-cohort allocation; starvation before
mate selection; exact cannibalistic prey depletion; extinction; delayed passages
and complete checkpoint continuation; overlapping land/water states; persistent
barrier/distance/ecological divergence; no forced branching without divergence;
reconnection and niche-change reset; exact organism/species/hex/carrier counts;
shared seed/day weather, water exposure, and coherent lake surfaces.

A 48-map matrix covers small/medium/large worlds and all combinations of extreme
geography, land fraction and water abundance for two seeds. Every accepted map
has a non-polar coast, ground barriers and a physically explained costly pass,
in addition to the generator's existing acceptance constraints. Rejected worlds
remain explicit failures; a failed candidate is never presented as a valid map.

## Reproducible pacing panel

Run `node scripts/benchmark-life-v2.js`. Optional positional arguments select
seeds. `--land` selects warm non-river land; default introductions use warm water.
`--full` continues every case through day 5,400. The default observes the first
branch, then continues at least another 360 days (in 180-day checkpoints), or
stops at day 5,400 if there was no branch. This checks whether a new identity
persists beyond its naming event, without requiring every world to diversify.

The selected site is the eligible hex closest to 22 °C at physical day zero,
tied by hex ID. Seeds, fixed default geography, small world size, 20 founders,
V2 rules and all weather metadata determine each run. Counts are checked against
`20 + births − deaths`, and every reproduction attempt is reconciled with an
established birth or failed establishment. Timing values printed by the script
are local wall times for tooling only; they never enter simulation state.

The table below records the final implementation, including ecological niche
classification, all construction charges, living-mate selection and functional
flight. A year is 360 physical days. This small, deliberately suitable-site panel
is a regression reference, not a distribution estimate for arbitrary maps/sites.

| Seed | Start | Hex | First branch day | First branch year | Observed through day | Living species then |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `emergence` | water | 244 | 3817 | 10.60 | 4320 | 4 |
| `v2-panel-1` | water | 120 | 3650 | 10.14 | 4140 | 2 |
| `v2-panel-2` | water | 245 | 2890 | 8.03 | 3420 | 6 |
| `v2-panel-3` | water | 134 | 2754 | 7.65 | 3240 | 2 |
| `v2-panel-4` | water | 260 | 4107 | 11.41 | 4500 | 4 |
| `v2-panel-5` | water | 130 | 3550 | 9.86 | 3960 | 4 |
| `emergence` | land | 210 | 3037 | 8.44 | 3420 | 3 |
| `v2-panel-1` | land | 259 | 2520 | 7.00 | 2880 | 2 |

All eight introductions produced a first branch between 7.00 and 11.41 years;
those identities were still living at the final observation. No extinction was
recorded in this selected panel. This meets the requested 5–15-year exploratory
target for these sites without guaranteeing it elsewhere. Earlier trial settings
were rejected after remaining at one species through year 15; the final changes
improve actual inherited divergence and recruitment, not a forced species timer.

The samples were executed locally with Node 26.8.1, sometimes alongside browser
checks. Water panels took roughly 14–169 seconds of local wall time for their
completed intervals. The largest of these small-world populations reached
472,519 organisms, illustrating why counts cannot be rendered as individual dots.
These timings are not controlled device benchmarks. Separate 360-day introductions
on medium/large worlds took about 1.7/0.7 seconds respectively, with roughly
20,291/24,649 organisms; different sites/trajectories make these unsuitable as a
world-size scaling comparison.

A final hunting optimization caches immutable genotype-pair eligibility/capture
and ordered live prey references within each habitat call. It preserves action
order and random draws. Six synthetic food-web seeds, both energy modes and
cross-restored checkpoints produced 36 complete before/after state equalities,
including PRNG state and 5,959 predation deaths. That controlled fixture took
about 5,458 ms before and 4,789 ms after (approximately 14% faster overall);
this does not change the biological panel results above.

The development server also loaded the atlas, introduced V2 life through the
actual worker and paused successfully without browser errors.

## Remaining limits

- A coarse phenotype-based model does not establish biological correctness or
  guarantee that every complex trait evolves in an ordinary run. All traits have
  rule tests; the panel is not evidence that flight or every armor type arose.
- Sexual reproduction has demonstrated recombination and a paid stress advantage,
  but this short panel does not establish its long-run frequency or universal
  superiority. Stable clones can remain successful.
- Stronger pressure increases undirected mutation within a cap. This deliberate
  gameplay approximation is not a universal biological law.
- Energy quantization can change long trajectories; its local rounding bound is
  not an ecological error bound. No independent individual reference or broad
  exact-energy calibration has been completed.
- Weather is bounded and reproducible; basin/coastline topology is fixed. Dynamic
  glacier flow, erosion and conserved weather-driven hydrology are not modeled.
- Rich populations and large food webs can reduce achieved browser speed. The UI
  reports completed days and actual speed rather than skipping biological turns.
- Browser validation covers Chromium desktop and phone layouts, not numerical
  equivalence across every browser/processor.
