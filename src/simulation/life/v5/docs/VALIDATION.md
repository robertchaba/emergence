# V5 validation — 2026-09-27

V5 is an experimental extension of V4's population representation. Its specific
balance aim is to leave a scarce food refuge for undersized plant eaters while
favoring increased body size in tall-plant communities. Capped alternatives
should support conditional niches without replacing ordinary full reach.
Neither survival nor a prescribed species/body-size distribution is guaranteed.
The original V4 measurements remain in [V4 validation](../../v4/docs/VALIDATION.md);
changing the gene catalogue also changes seeded trajectories, so those results
are historical context, not validation of this model.

## Focused verification

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

## Reproducible seeded panels

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

## Controlled canopy competition

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

## Limits

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
