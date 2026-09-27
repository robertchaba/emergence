# V5 validation — 2026-09-27

## Current revision 2 — predator establishment and aquatic hunting

Rules `v5-populations-2` retain model V5 and its browsing rules, add streamlining
as the 45th trait, extend animal filtering, raise hunting effort from 3.6 to 4.2,
and permit smaller prey-funded founding groups. Earlier V5 saves require their
earlier project revision. Historical revision-1 measurements below remain
preserved; they do not describe the current seeded trajectory.

### Focused checks and interpretation

The new checks cover modest hunting relief, paid aquatic specialization,
unchanged capture defenses and size eligibility, no food without appropriate
prey, finite tissue/effort under source splitting, and selection for camouflage,
herding and poison only when actual hunting pressure rewards their costs.
Founding fixtures exercise fewer than 20 real predator founders, singleton
transfers with retained parents, continued parent support, no-prey rejection,
ordinary 20-founder branches, unused animal-feeding genes, population
conservation and saved continuation. All 45 genes are required in current,
candidate and historical genomes; earlier V5 rules are explicitly rejected.

In an ideal shallow-water probe with 100,000 size-1 animal prey, a moving pure
hunter with maximal filter feeding and streamlining improves net score from
0.1677 at size 7 to 0.1787 at size 8 (and 0.1999 at size 10). Without those traits,
extra size lowers the score on the same small prey. A single filter-feeding
step is advantageous for a size-7 hunter; a single streamlining step is
advantageous for a size-8 hunter. These comparisons demonstrate a selectable
conditional route rather than assigning a preferred size.

That deliberately abundant prey fixture isolates collection efficiency; it is
not a food-web equilibrium. With only ten size-1 prey, the large specialized
hunter has a negative score. Finite light, trophic transfer, local prey limits
and the integer census strongly restrict sustainable large-animal density.
No current check demonstrates a persistent natural whale-like lineage.

### Paired seeded observations

The pre-change revision-1 source is commit
`1217490e6f90c3b48d7eead3230fe0e8f37a4c1b`. Both revisions use Small worlds,
world seed `emergence`, biological seed `emergence:life-v5`, and samples every
3,000 elapsed days. The comparison runs the same harness against each source
revision; the current harness's added diagnostic can evaluate either revision's
saved census using that revision's ecology implementation.

```sh
node scripts/check-life-v5-balance.js 15000 small emergence water v5 emergence:life-v5 3000
node scripts/check-life-v5-balance.js 15000 small emergence land v5 emergence:life-v5 3000
```

Final day-15,000 observations:

| Introduction / rules | Organisms | Living / extinct species | Pure grazers / predators / mixed | Animal-feeding body cells | Current animal intake / turn |
| --- | ---: | ---: | ---: | ---: | ---: |
| Water hex 168, revision 1 | 73,913 | 50 / 36 | 24 / 1 / 4 | 774 | 267.47 |
| Water hex 168, revision 2 | 29,255 | 51 / 55 | 23 / 4 / 3 | 592 | 347.83 |
| Dry land hex 173, revision 1 | 68 | 4 / 6 | 2 / 0 / 0 | 0 | 0 |
| Dry land hex 173, revision 2 | 181 | 5 / 2 | 0 / 0 / 0 | 0 | 0 |

Water-start animal feeders (including mixed acquisition) number 94 organisms
in seven species, versus 360 in five before; their share of consumer body-cell
biomass is 2.23%, versus 2.18%. The revised sample has about 30% more current
animal intake and four pure predator species instead of one, but lower absolute
animal-feeder biomass and fewer organisms. Expected current prey removals are
119.53 versus 210.12 per biological turn across 33 versus 39 hunted hexes.
These measures describe different aspects of the food web; none alone establishes
greater stability or universal predator success.

In the revised water-start panel, aquatic animal eaters remain sizes 1–2.
Pure land predators reach size 3, while mixed land feeders reach size 4. Neither
of the two living streamlining carriers eats animals. No whale-like lineage
emerged. Animal feeding is already present at the day-6,000 revised sample
(three mixed species), versus none then in revision 1, but the dry-land panel
retains only producers. Adding a trait changes mutation options, draw use and
later history even before hunting starts. These paired runs are observational,
not an isolated causal test or a guarantee that consumers persist in every seed.

The harness's `currentPredation` re-evaluates the completed census and climate
without advancing the simulation. It reports expected allocated energy and prey
withdrawals per biological turn, not historical intake or realized integer
deaths. The existing cumulative `predationDeaths` floors local expectations and
can undercount small-population predation; it is retained with this limitation.

### Integration validation

`npm run build` and `npm test` passed: **238 headless/rendering checks and 157
Chromium checks**, with one pre-existing duplicate desktop touch check skipped.
These include 11 new hunting/founding checks, the expanded 45-gene catalogue,
strict revision validation, deterministic continuation and asynchronous scoring.
Browser coverage includes save restore, worker/headless agreement, EN/PL notebook
and tree gene descriptions, and development/source/debug startup.

All 24 focused screenshots (notebook, streamlining help and filter-feeding help
across EN/PL, light/dark and desktop/phone) were inspected: wrapping, focus,
selected states and original artwork remain usable, with no clipping found.
The first browser run exposed a test-only race when scrolling during asynchronous
gene-history replacement; waiting for completed history fixed it. An old
44-trait assertion was updated to the new catalogue count. The final full suite
passes. `git diff --check` and scope/dependency review pass; no V1–V4 engine,
rendering, style or runtime dependency changes were made. Browser verification
is limited to Chromium, and these checks do not establish ecological realism.

## Historical revision 1 — scope

V5 is an experimental extension of V4's population representation. Its specific
balance aim is to leave a scarce food refuge for undersized plant eaters while
favoring increased body size in tall-plant communities. Capped alternatives
should support conditional niches without replacing ordinary full reach.
Neither survival nor a prescribed species/body-size distribution is guaranteed.
The original V4 measurements remain in [V4 validation](../../v4/docs/VALIDATION.md);
changing the gene catalogue also changes seeded trajectories, so those results
are historical context, not validation of this model.

## Historical revision 1 — Focused verification

`npm run build` and `npm test` pass: **227 headless/rendering checks and 157
Chromium checks**, with one existing duplicate desktop touch check skipped.
The headless suite includes eight V5 gene/ecology checks and five V5 model checks:

- All 44 genes, reversible one-step mutation, paid upkeep/construction, strict
  V5 checkpoint identity and rejection of incomplete or older-model genomes.
- Finite food for the smallest browser below the tallest canopy, no food without
  producers, and increasing access/intake/fitness as body size approaches reach.
- Climbing's 15% limit, the shared 25% alternative-route cap, habitat/mobility/
  trunk/bite restrictions, paid loss of benefit at full reach and plant defenses.
- Conservation of production and feeding effort when identical plant or consumer
  populations are divided into additional species labels.
- Small-browser persistence and larger-browser resource competition in controlled
  communities, alongside actual seeded evolutionary runs.
- Deterministic continuation, daily/bulk advancement, detached observations,
  helper-worker agreement, count reconciliation and saved-state validation.

Browser checks cover save restoration, worker/headless agreement, development
and source-worker startup, debug profiling, and English/Polish notebook and tree
descriptions for every new gene. The introduction fixture compares browser
population against the same-day headless V5 result, rather than assuming a seeded
founder must grow on its first turn. Both themes were visually inspected at
desktop and phone widths, including numerical route-limit help, wrapping, focus,
assets and disabled controls, with no overflow or focus issues found.

Scope/dependency review and `git diff --check` passed. V1–V4 engine implementations
and rendering code remain unchanged; no runtime dependency was added. Browser
verification is limited to Chromium.

These checks establish implemented behavior and bounded examples, not universal
evolutionary outcomes, scientific calibration or cross-browser numerical identity.

## Historical revision 1 — Reproducible seeded panels

The observational harness uses `physical-world-4`, explicit introduction sites,
world seed `emergence` and explicit biological seed `emergence:life-v5` for both
versions. Sample days are elapsed physical days after introduction. A `land`
selector chooses a land-surface hex; if it has runoff, introduction still chooses
water. The harness reports the actual introduction habitat to make this explicit;
`dry` excludes runoff and an integer selects a particular hex.

```sh
node scripts/check-life-v5-balance.js 15000 small emergence land v5 emergence:life-v5 3000
node scripts/check-life-v5-balance.js 15000 small emergence land v4 emergence:life-v5 3000
```

On the Small world, the land selector chooses hex 173. At day 15,000:

| Model | Organisms | Living / extinct species | Producer sizes | Pure grazers | Pure predators |
| --- | ---: | ---: | --- | ---: | ---: |
| V4 | 89 | 3 / 2 | 10 | 0 | 0 |
| V5 | 68 | 4 / 6 | 10 | 2 | 0 |

The V5 land grazer size record is 2 at day 3,000; 4 at days 6,000 and 9,000;
4 and 5 at day 12,000; and 4 and 7 at day 15,000. Its final two producer species
are both size 10. At the final sample, size-7 grazers represent 1,397 body cells
(86.3% of grazer biomass), while size-4 grazers represent 222 (13.7%). This is a concrete seeded example of retained consumers and
subsequent larger browsers beside large plants, not a guarantee for other worlds.
The paired V4 result provides context but does not isolate the browsing formula:
four additional genes alter mutation options, random-draw use and later history.

A second V5 run introduces water life on Small-world hex 168:

```sh
node scripts/check-life-v5-balance.js 15000 small emergence water v5 emergence:life-v5 3000
```

At day 15,000 it has 73,913 organisms, 50 living and 36 extinct species,
24 pure grazers and one pure predator. Living lineages express tree climbing
in one species, fallen-food foraging in three, branch pulling in six and extended
reach in two. Expression is not proof of realized benefit: a trait may be
inherited alongside another useful change or persist outside its useful habitat.

The Medium-world water panel uses the same explicit seeds and interval:

```sh
node scripts/check-life-v5-balance.js 15000 medium emergence water v5 emergence:life-v5 3000
```

It introduces life on sea hex 546 and ends at day 15,000 with 165,323 organisms,
88 living and 76 extinct species, 50 pure grazers and four pure predators.
Living lineages express climbing in 32 species, fallen-food foraging in five,
branch pulling in eight and extended reach in four. Its land grazer species
occupy sizes 1–5 (respectively 5, 13, 3, 2 and 1 species). This varied outcome
shows that the size advantage in a controlled tall-canopy fixture does not mean
all world grazers become large or that alternative traits disappear.

## Historical revision 1 — Controlled canopy competition

The focused fixture uses ideal 20°C humid land, size-10/trunk-10 plants and
moving pure grazers. Against 100 plants, a rare size-1 ordinary grazer has 4.96%
canopy access, 0.820 food energy per body cell and net rate score 0.0521 per turn.
A size-10 grazer has full canopy access, 1.697 food energy per cell and score
0.1019. Body-size steps improve access, per-cell intake and net score through
size 10 in this fixture. In a contested size-2 grazer fixture, growth to size 3
beats each single level-1 route mutation; all four mutations still have a
positive, selectable benefit. Full reach leaves those route costs without an
extra feeding benefit.

A separate controlled expectation experiment starts with 10 plants and one
consumer per strategy, then iterates the same ecological rates for 1,500 turns.
Deaths precede births as in the model: expected population is multiplied by
`(1−deathRate)(1+birthRate)`. This removes stochastic rounding, dispersal and
mutation to isolate competition; its fractional populations are diagnostic
expectations, not the model's represented integer census. Each consumer strategy
in its own community reaches:

| Consumer strategy | Expected population | Body-cell biomass | Food per turn |
| --- | ---: | ---: | ---: |
| Size 1, ordinary browsing | 62.6 | 62.6 | 32.1 |
| Size 1, climbing 3 | 228.7 | 228.7 | 124.5 |
| Size 1, all route genes 3 and bite force 1 | 292.7 | 292.7 | 187.5 |
| Size 10, ordinary browsing | 3.5 | 939.5 | 648.0 |

Thus small strategies can use real food and persist in the absence of the
full-reach competitor, while even the fully equipped small strategy consumes
less than 29% of the larger strategy's food. When each small strategy shares
this otherwise identical community with the size-10 consumer, the large consumer
excludes it: small expected populations approach zero by turn 1,500. This proves
neither stable minority coexistence on one hex nor a guaranteed whole-world
outcome. Different local environments and traits can change the comparison.

## Historical revision 1 — Limits

The alternative-route caps restrict the proportion of existing edible production
that can be reached; they do not impose a species or organism quota. Small bodies
can outnumber larger bodies while using less biomass and food. Resource intake,
biomass and evolutionary fitness therefore matter alongside population counts
when interpreting dominance. None is guaranteed to have the same ordering under
all environments, predators, defenses and evolved trait combinations.

The low-food floor and collection curve are experimental coefficients. No
independent fallen-food store, fruit season, branch geometry, climbing animation,
individual foraging journey or protected grace period is simulated. Plants still
pay withdrawn food from their real production, and ordinary predation, scarcity
and environmental stress can eliminate small browsers. This sample of seeded
worlds cannot establish universal coexistence, long-run stability or ecological
realism. Browser smoke checks do not validate biological balance.
