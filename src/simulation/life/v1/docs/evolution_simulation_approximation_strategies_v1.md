# Evolution Simulation - Recommended Approximation Techniques and Strategies - v1

> Relocated from `docs/` on 2026-09-16 as research for life model v1.
> The filename revision is the research revision, not the life-model version.
> See the [v1 index](../README.md) for authority and unresolved decisions;
> this move does not implement or approve the proposed biology.

**Status:** Implementation recommendations, not replacement simulation rules.  
**Reference:** Simulation summary v6 and evolution mechanics v3.  
**Prepared:** 15 September 2026.

## 1. Recommendation

Build a small, straightforward individual-organism implementation first and retain it as the reference engine. Optimize the working engine through shared calculations, sparse local state, compact storage, and groups of genuinely equivalent organisms. Introduce approximations that discard information only when measurements show they are necessary.

The preferred production direction is **local, exact-genome cohorts with integer counts**, preserving differences in stored energy and other consequential state. A cohort is a storage and calculation shortcut, not a new biological entity. It must still represent the outcomes that its individual members could experience.

Do not begin with a world of average species, deterministic population-growth curves, or a small number of weighted organisms whose members all share one fate. Those shortcuts directly affect what this project is intended to demonstrate: mutation, selection, drift, colonization, extinction, and divergence.

The largest specified world is 120 x 80, or 9,600 hexes. Start measurements with 24 x 16, then 60 x 40. World size alone does not establish the computational load: living organisms, distinct local states, feeding interactions, and classification work also matter. No population capacity or speed target has been benchmarked yet. [P1]

## 2. Authority and scope

| Document | Role |
|---|---|
| [Shared world summary](../../../../../docs/evolution_simulation_summary_v6.md) | World, climate, geography, seasons and application speed; physical decisions remain shared. |
| [Life summary v6](evolution_simulation_summary_v6.md) | V1 habitats, energy, movement, dispersal and turn order. |
| `evolution_mechanics_summary_v3.md` | Inheritance, valid mutations, genetic distance, species classification. |
| `evolution_simulation_genes_v1.md` | Starting capabilities and feeding principles where not superseded by the two documents above. |
| [Staged prompts](../../../../../docs/prompts.md) | Application structure, visual direction, interaction, and staged foundation work; newer mechanics take precedence. |
| This document | How to execute and display those rules efficiently without silently replacing them. |

Missing ecological coefficients must be resolved in the reference model and recorded as explicit model decisions. They must not emerge accidentally from an optimization. In particular, the current documents still require a complete reproduction and feeding specification before those operations can be optimized faithfully. The previously cited `evolution_simulation_codex_readiness_v1.md` is absent from this checkout; see the [v1 open decisions](../README.md#open-decisions-before-implementation).

No new genes, biomass system, age-dependent biology, global fitness score, or predefined ecological classes are introduced here. Algorithms, storage layouts, and internal module choices remain implementation decisions within the project's browser-first, plain-JavaScript constraints. [P1-P4]

## 3. Distinguish three kinds of acceleration

**Rule-preserving optimization** avoids repeated work or stores the same information more efficiently. Examples include genome interning, cached geometry, sparse occupied-hex lists, and lower rendering frequency. It should not change simulation outcomes merely because the camera or processor speed changes.

**Distribution-preserving batching** replaces many random trials with an equivalent count draw. For example, independent deaths with the same fixed probability can be counted using a binomial distribution. This preserves their probability law, not necessarily the exact sequence produced by a different random-number implementation with the same seed. Equivalence must include the resulting state and relevant correlations, not only expected population totals.

**Lossy approximation** discards information or replaces a probability law. Examples include energy buckets, frozen rates over several days, or representative sampling. These require explicit error controls and validation against the reference engine.

Recommended priority:

| Technique | Classification | Recommendation |
|---|---|---|
| Cached geography, shared genome definitions, local indexes | Rule-preserving | Use early. |
| Fewer render updates, cached map layers | Presentation-only | Use early. |
| Exact-state cohorts | Potentially lossless state compression | Add after a working reference and profiling. |
| Binomial/multinomial event counts | Distribution-preserving under stated assumptions | Add phase by phase with tests. |
| Approximate energy distributions | Lossy | Optional later experiment. |
| Multi-day ecological leaps or predicted populations | Lossy, high risk | Exclude from the first implementation. |
| Average genomes, artificial carrying-capacity clamps, discarded rare variants | Changes the model | Do not use. |

## 4. Properties every implementation must preserve

Keep the actual hex grid and habitat connections. Never turn a region label into a biological wall or shortcut. Rivers can contain both habitats, with one shared light budget but habitat-local feeding. A one-hex strait, a drainage connection, and a wraparound neighbor remain meaningful at every display zoom. [P1, sections 3-9]

Keep complete genomes and integer numbers of living organisms. Absence of temperature tolerance is not expression zero. Species identity is historical metadata, not a substitute for a genome. A rare genotype with one remaining carrier must remain represented until an actual event removes it. [P2, sections 1-8]

Keep the 0.0001 mutation probability per paid-for offspring, before establishment losses, with at most one valid mutation. Do not increase it because a population is small or an event is visually overdue. Keep the 95% local / 5% neighboring dispersal attempt rule and evaluate the offspring's own capabilities. [P1, section 7; P2, sections 2-6]

Keep individual energy constraints, costs, starvation probabilities, feeding limits, and prey depletion. Members of a cohort cannot donate energy to one another unless a later biological rule explicitly permits it. Newborns start at zero energy and cannot act during their birth turn. [P1, sections 7-11]

Keep daily phase order and the 100-consecutive-turn species qualification rule. Time compression executes more days; it does not multiply per-birth mutation chances, skip ecological updates, or shorten classification timers. [P1, section 11; P2, sections 8-9]

## 5. First optimize without discarding information

### Precompute immutable geography

Compute adjacency, seam handling, drainage links, water availability, static terrain difficulty, and physical edge restrictions during generation. Store enough information to distinguish water-channel connections from ordinary hex adjacency. Reuse these facts throughout the run.

Do not cache one universal `passable` flag: actual access depends on habitat and capabilities. Separate static physical restrictions from daily temperature and adaptation-dependent factors.

### Share genomes and derived traits

Intern each distinct complete genome once and refer to it by an ID. Cache body-cell count, active-gene count, temperature interval, habitat capabilities, acquisition shares, light weights, and valid one-step mutations against the genome and rules version.

When the same genome arises independently, its immutable trait definition may be shared. Its carriers do not automatically acquire the same species identity, ancestry, or establishment date. Retain metadata used by classification and tie-breaking separately.

Compute environmental performance once per distinct relevant combination of genome, occupied habitat, hex, and day. Invalidate a cache when any input changes. Never use an approximately similar temperature or genotype as an exact cache hit.

### Keep occupied state sparse

Use local indexes of occupants and an active set of occupied hexes. Empty hexes need no organism update, but remain possible movement or birth destinations. Evaluate their climate and physical conditions when needed, even when they are offscreen.

Cache the 360-day seasonal signal and static per-hex climate coefficients. This avoids unnecessary trigonometry without replacing daily seasons with monthly averages. A pure `setDay` implementation may share immutable geography across snapshots; it must not mutate an earlier snapshot through a shared mutable buffer. [P1, sections 1-4]

### Reduce allocation and copying

Reuse scratch buffers and compact records where profiling justifies them. Typed arrays are an option, not a requirement to redesign everything before the reference engine exists. Use sufficient precision for ecological calculations; switching to lower-precision numbers is a numerical approximation requiring separate tests.

Maintain derived population totals and local counts incrementally. Remove empty records only at count zero. Do not delete low-frequency living variants to reduce memory use.

## 6. Exact-state cohorts

A cohort may contain several organisms only when all state relevant to the next operation is equivalent. A useful initial key is:

```text
hexId
occupiedHabitat
genomeId
speciesId
storedEnergy
activation state: newborn or active
other action state or historical metadata required by the operation
```

The cohort stores a positive integer count. Genome definitions remain immutable.

For example, 800 active organisms in one water habitat, with the same genome, species label, and exactly 7 energy units each can share a record. Their 40 newborn descendants with zero energy belong in another record. A mutant with one carrier remains a separate genotype record.

Same genome does not imply same state. Grazing, movement costs, hunting results, starvation, or births can give members different energies or action eligibility. Split the affected cohort into the actual outcome groups. Merge again only when the consequential states genuinely match.

An equality-within-tolerance energy comparison is not exact compression. It belongs to the optional approximation mode below.

### Exchangeability is an operation-specific requirement

Compression is safe only when exchanging members does not change how the reference rule treats them. If the individual reference uses randomized actor ordering or target selection, a batched version must reproduce that joint process. Processing an entire cohort before another can grant the first group priority even when all marginal probabilities look correct.

If an operation needs individual treatment, temporarily expand the affected participants or process their events separately. Do not force every operation into a cohort formula. Storage efficiency and event-processing granularity are separate choices.

### Why average energy is unsafe

Consider two otherwise identical organisms whose post-upkeep energy is 0 and 10, with a hypothetical reproduction cost of 8. The second can reproduce and the first cannot. Replacing both energies with the average of 5 prevents that birth, despite preserving total energy.

The same problem applies to movement affordability and starvation. Preserve exact energies initially; a count plus one average is not an adequate general-purpose organism state.

## 7. Shared light allocation

Light competition is a good candidate for grouped algebra because equivalent organisms have the same weight and absorption cap.

For cohort `i`, let `n_i` be its count, `w_i` its per-member competition weight, and `c_i` its per-member absorption cap:

```text
cohortWeight_i = n_i * w_i
cohortCap_i = n_i * c_i
cohortLight_i = min(cohortCap_i, lambda * cohortWeight_i)
```

Choose the allocation multiplier `lambda` so that total allocation equals the smaller of the hex's light budget and total eligible absorption capacity. This implements weighted allocation with cap redistribution. Members receive `cohortLight_i / n_i` when they are equivalent for this phase.

For river-bearing hexes, collect land and water producers into the same allocation problem, using each occupant's habitat-specific weight. Do not accidentally give each habitat 2,000 units, or charge a half-capacity photosynthesizer a full competition weight. [P1, section 10]

This is a mathematical grouping of the specified allocation rule. Floating-point summation order can still differ from an individual implementation; define a numerical tolerance and test cap boundaries rather than describing all reordered arithmetic as bit-identical.

## 8. Batch stochastic events, not expected outcomes

### Independent starvation

After movement, feeding, and upkeep inputs have been resolved, a group of `n` equivalent organisms with the same independent death probability `p` permits:

```text
deaths ~ Binomial(n, p)
survivors = n - deaths
```

The expected deaths are `n*p`, and their variance is `n*p*(1-p)`. These follow directly by summing independent Bernoulli trials.

For 1,000 organisms with death probability 0.05, the mean is 50 and variance 47.5. A single 5% death roll for a weighted representative of all 1,000 has the same mean but variance 47,500: either all members die or none do. It is a different model.

Likewise, always removing exactly 50 eliminates demographic variation. Neither shortcut preserves the intended drift.

Apply binomial batching only after establishing equal probabilities and conditional independence. An average of unequal starvation probabilities does not generally reproduce their count distribution.

### Mutation

First compute the number of offspring actually paid for under the reference reproduction rule. Do not calculate births from pooled cohort energy unless that is algebraically equivalent to each parent's eligibility and payment.

For `B` births from an equivalent parental genome:

```text
mutantBirths ~ Binomial(B, 0.0001)
unchangedBirths = B - mutantBirths
```

For each mutant, choose an eligible trait uniformly, then one valid change within that trait uniformly. Do not choose uniformly from a flat list of all possible changes, which would favor traits with more options. Use the mutation graph and dependencies from mechanics v3. [P2, sections 2-4]

The count includes offspring that later fail to establish. Mutants must be separated before habitat checks, because they can cross different boundaries than unchanged offspring.

Do not use `floor(B * 0.0001)`, fractional mutants, a guaranteed mutation schedule, or one mutation decision for an entire litter/cohort. With 10,000 births, the probability of zero mutation events is `(1 - 0.0001)^10000`, approximately 36.79%; an expectation of one does not mean exactly one occurs.

A suitable exact-distribution binomial sampler is preferable to a Poisson or normal shortcut. Those are approximations and must be identified as such. A simple individual-trial fallback is acceptable until a sampler has been tested.

### Offspring destinations

Within each offspring-genome and parental-location group, destinations can be sampled with a multinomial distribution if all relevant probabilities are the same.

For a location with `k` neighbors, the initial probabilities remain:

```text
local attempt:       0.95
each neighbor:       0.05 / k
```

After habitat and passage checks, keep explicit successful-destination and lost-offspring categories. Do not renormalize probability over only accessible neighbors.

For example, where local establishment is valid and neighbor `j` has passage probability `s_j` after hard checks:

```text
P(establish in neighbor j) = (0.05 / k) * s_j
```

A hard-blocked neighbor has `s_j = 0`. Its share becomes failed dispersal, not additional births at another destination. All outcome counts together must equal the births paid for. Parent energy is not refunded. [P1, section 7]

### Active movement

Batch only equivalent source states. Preserve the distinction between:

- No attempt, an invalid choice, or insufficient stored energy: remain without paying movement energy.
- An affordable attempted crossing that fails: remain with the movement cost spent.
- A successful crossing: arrive with that cost spent.

Different destinations can imply different costs, so outcomes may require several energy cohorts. Same-hex habitat switching is its own destination choice. Use one pre-movement snapshot and commit outcomes together so arrivals cannot move a second time. [P1, sections 8 and 11]

## 9. Feeding is the highest-risk batching area

Finalize the reference feeding rules before choosing a fast algorithm. Density, encounter probability, processing capacity, target eligibility, ordering, capture, and prey value currently need a complete numerical and procedural contract. [P1, section 10; P3]

### Grazing

The reference cap is per producer: at most 20% of that producer's current-turn photosynthetic production across all grazers. The initial conversion factor is 60%. Feeding is habitat-local. [P1, section 10]

A summed grazing pool is sufficient only when the reference allocation rule also determines how losses are distributed across producers. Equal total grazing can have different consequences if one producer loses 20% while another loses none, rather than both losing 10%.

Retain producer-level or equivalent-producer-cohort accounting. Split producers that experience different losses. Retain consumer-level capacity and encounter outcomes. Do not divide food evenly among every grazer simply because this is convenient: that could let organisms reproduce that would have failed to find food.

### Predation

Use local prey indexes, not a search across the entire world. Partition candidates by actual eligibility, such as habitat and allowed size relationship, and apply the reference target-selection law.

A prey organism can be killed once. Remove it from availability immediately in the defined resolution order, and cancel actions it is no longer allowed to perform. If predators compete for a finite prey pool, independent fixed-rate kill draws followed by capping the total are generally not equivalent to depletion-aware encounters.

Where many targets are genuinely interchangeable, sampling without replacement or a proven equivalent grouped algorithm may help. Otherwise, process encounters individually while retaining compact storage for uninvolved organisms.

Preserve the link between a predator's successful consumption and its own energy. Do not spread one kill's energy across a cohort. Do not replace discrete prey deaths with a fractional population or refill a depleted pool to stabilize the ecosystem.

Keep a debug energy ledger for production, grazing loss, assimilation loss, consumed prey value, upkeep, reproduction, movement, and discarded overflow. This is diagnostic accounting, not a new biological biomass variable.

## 10. Optional later approximation: energy distributions

If profiling shows that exact energy states fragment cohorts excessively, test bounded energy distributions for abundant, otherwise identical local states. This mode must remain explicitly distinguishable from the reference and distribution-preserving modes.

Keep exact genomes, locations, habitats, species labels, and integer counts. Approximate only the energy distribution. Prefer several bins with counts and conserved energy totals over one population-wide mean.

Place or refine boundaries around consequential thresholds: movement affordability, upkeep coverage, reproduction eligibility, and storage saturation. Thresholds depend on current environment and actions; a fixed four-bin scheme is not automatically sufficient. Track an error bound and the number of organisms potentially assigned a different decision.

Avoid lossy compression near extinction, in small founder populations, around newly created variants, and wherever small energy changes can alter establishment or a species-classification condition. These are computational fidelity safeguards, not biological protection from death.

Critically, expanding an approximate bin into individual records does **not** recover the original energies. Sampling plausible energies is another approximation. Once information is discarded, keep the run labeled as approximate. An exact comparison requires restarting from an earlier uncompressed checkpoint or the initial conditions.

Use hysteresis when switching representation so repeated expansion and compression do not dominate runtime. Choose density and error thresholds from benchmarks, not from a desire to hide complexity. Keep this feature disabled until it passes the validation criteria in section 14.

## 11. Species classification and geographic isolation

Cache classification inputs and recompute only what changed, but evaluate the required conditions on every simulation day. A classifier that samples once per ten days can miss a one-day reconnection and incorrectly award a 100-day separation streak. [P2, section 8]

Invalidate relevant species components when occupancy, habitat, or the set of present crossing capabilities changes. A mutation can open or close a classification edge even when the occupied hexes and species totals are unchanged.

Component topology and counts have different update needs. If topology is unchanged, component membership can be reused while counts, majority genomes, and qualification conditions are updated. Track component continuity through expansion, splitting, and reconnection with deterministic bookkeeping.

For the first implementation, a straightforward graph traversal on affected species is preferable to a complicated incremental algorithm. Any acceleration must support removal of connections as well as addition.

Count complete genomes to determine majorities. Genetic distance uses valid mutation steps, not averaged traits or the accumulated number of ancestral mutations. Cache repeated distance queries and invalidate on changes to the mutation rules. Region IDs remain geographic diagnostics and never replace this graph. [P1, section 9; P2, sections 7-8]

## 12. Rendering and browser execution

Shared pacing and hidden-tab behavior are already adopted in the [world rules](../../../../../docs/evolution_simulation_summary_v6.md#shared-playback-and-time-rules). The following remains execution research; it does not relocate browser adapters into this model or authorize changes to physical APIs. The newer [provisional life rendering brief](../../../../rendering/LIFE.md) supplies the requested initial visual direction.

Run complete daily simulation steps independently of redraws. At high time compression, execute several days and publish the newest completed snapshot instead of rendering every intermediate day. Report both the simulated date and measured execution rate so the interface does not imply an unachieved speed.

A dedicated Web Worker can isolate expensive simulation work from the UI thread; it does not guarantee more raw simulation throughput. Keep its message adapter outside the headless rules. Send compact display summaries and requested inspection details rather than copying every organism every day. [W1]

Transferred `ArrayBuffer` ownership leaves the sender without usable ownership of that buffer. Transfer display buffers or use an explicit buffer-ownership protocol, not the engine's only live state by accident. [W2]

Cache static terrain separately from changing life overlays, selection, and labels. Batch similar drawing operations and skip offscreen drawing. Such canvas-layer and redraw optimizations are described in the browser documentation. [W3]

At low zoom, show a hex summary or aggregated visual marker. At high zoom, show more detailed symbolic organisms and inspection information. This is **display level of detail only**: looking away must not freeze a population, merge habitats, or change its probability of survival.

Use `requestAnimationFrame` for presentation rather than as the definition of a biological day. Browsers commonly pause its callbacks in hidden tabs. Define tab-hidden behavior explicitly; a reasonable initial product choice is to pause and resume without inventing elapsed simulation time. Do not assume a worker guarantees unlimited unattended execution. [W4]

Recommended overload behavior is to reduce redraw frequency, then execute fewer days per real second. If a documented memory safety limit is reached, pause with a clear message and allow a checkpoint. Do not silently delete organisms, simplify genomes, or skip simulated days.

## 13. Shortcuts to reject or defer

**No average-genome organism.** It can invent combinations that never existed and erase which traits co-occur in surviving lineages.

**No deterministic expected births, deaths, or migrants.** Integer stochastic outcomes are essential to drift and founder effects, especially near zero.

**No region-level migration or ecological simulation.** Local hexes, coastlines, river links, and narrow passes must remain operative.

**No fixed population cap masquerading as ecology.** Resource competition and the reference rules determine survival. Performance limits are operational pause conditions, not unexplained culling.

**No population prediction as the authoritative state.** Extrapolated growth can miss season changes, mutants, predator arrival, and colonization. Forecasts may be displayed separately, clearly labeled, but cannot replace completed days.

**No initial multi-day ecological leaps.** Processing 30 complete days in one execution batch is fine. Replacing them with one 30-day population update is a different operation. Births can activate descendants, food can disappear, and classification conditions can reset between the endpoints.

**No weighted representative with a shared fate.** Any super-individual method must reproduce individual variance and interaction constraints, not merely multiply one outcome by a weight. Prefer exact-count cohorts.

## 14. Validation and performance gates

### Three distinct promises

1. **Replay:** The same engine version, settings, initial state, random state, and command sequence reproduce the same results in the supported numerical environment. Save/load must preserve that continuation.
2. **Rule equivalence:** Optimizations preserve the reference semantics, including phase order and resource limits. Bit-identical floating-point results across different browsers or reordered arithmetic need separate evidence.
3. **Statistical agreement:** Different stochastic implementations or lossy modes agree within predeclared tolerances over an adequate collection of runs. One similar-looking world proves neither accuracy nor balance.

Serialize the generator and rules versions, parameters, day, random state, genome registry, local organism/cohort state, pending newborn activation, species labels, establishment/tie-breaking metadata, component continuity, and qualification timers. A seed alone does not describe a run with interventions, changed versions, or an approximate state.

Keep rendering randomness separate from biological randomness. Fix ordering where it is semantically relevant. A changed binomial sampler or cohort traversal can legitimately change a seed's trajectory; document engine-version boundaries instead of promising universal seed identity.

### Required comparison scenarios

| Scenario | What it detects |
|---|---|
| Uncrowded founder in suitable water | Broken production/upkeep balance or unreachable reproduction. |
| Crowded land with mixed sizes and trunks | Incorrect light caps, weights, or cohort allocation. |
| Mixed land/water river occupancy | Duplicate light budgets and cross-habitat feeding. |
| One to a few rare variant carriers | Rounding loss, shared-fate sampling, artificial survival. |
| Known numbers of offspring | Mutation rate, variance, trait-first choice, and no birth-turn action. |
| Blocked coast, cliff, seam, and unlinked river channels | Invalid migration or renormalized destination probabilities. |
| Failed paid movement versus invalid movement choice | Incorrect energy refunds or charges. |
| Several grazers targeting limited producers | Violation of the combined per-producer grazing cap. |
| Several predators and a small prey pool | Duplicate kills, invalid actor ordering, shared consumer energy. |
| Seasonal shortage and recovery | Incorrect frozen climate or skipped daily deaths. |
| Separation, a one-day reconnection, then separation | Incorrect species qualification timers. |
| Save/load, different redraw rates, camera changes | Non-reproducible state or UI-dependent biology. |

Check counts, bounds, light allocations, energy accounting, phase order, and forbidden crossings as invariants. Any positive number of hard-barrier crossings or duplicate prey kills is a failure, not an acceptable average error.

For stochastic comparisons, test elementary samplers against their analytical probabilities and moments. Across ecological runs, compare extinction and establishment probabilities, genotype frequencies, population distributions, colonization times, and branching times. Use uncertainty intervals and enough trials to detect the chosen tolerances. Lack of a statistically significant difference in a small sample is not proof of equivalence.

For a lossy mode, declare acceptable error margins before accepting the optimization. Require tighter control of extinction and rare-lineage establishment than of a decorative chart. If evidence is insufficient, report the mode as unvalidated rather than silently making it the default.

### Benchmark what actually costs time

Measure generation separately from daily simulation, movement, light allocation, feeding, classification, snapshot transfer, and rendering. Record world dimensions, occupied hexes, living organisms, active genomes, cohort count, births per day, memory use, and latency distribution, together with browser and hardware.

Test small, medium, and maximum worlds with different occupancy and diversity. Do not claim that a low-diversity plant-only benchmark establishes predator-rich or mutation-rich performance. Compare implementations at equal simulated time and equivalent workloads, not by frame rate alone.

## 15. Implementation sequence

**First:** Resolve the reference-model gaps listed in the [v1 index](../README.md#open-decisions-before-implementation); the originally cited readiness review is absent. Build the smallest end-to-end individual simulation, deterministic fixtures, inspection, and saved checkpoints.

**Second:** Add low-risk shared calculations, genome interning, local indexes, compact snapshots, and independent rendering. Profile the result.

**Third:** Add exact-state cohorts and separately validated batching for suitable phases. Keep difficult feeding interactions individually resolved until their equivalence is established.

**Fourth:** Optimize affected-species classification and browser execution where measurements show a bottleneck. Retain the reference engine for regression tests.

**Only then:** Experiment with lossy energy distributions or other approximations behind an explicit setting. Measure their error and their actual performance benefit.

Stop when the agreed world sizes run acceptably. A more elaborate approximation system is not a goal in itself.

## Sources and interpretation

Project references are the supplied design documents, not claims about measured biological constants:

- **[P1]** Summary v6, now split between the [shared world sections 1–4 and 9](../../../../../docs/evolution_simulation_summary_v6.md) and [v1 life sections 5–11](evolution_simulation_summary_v6.md), plus the acceptance checks in both parts. Original section numbering is retained.
- **[P2]** `evolution_mechanics_summary_v3.md`, particularly mutation, demographic randomness, and species classification.
- **[P3]** `evolution_simulation_genes_v1.md`, particularly energy-acquisition shares, grazing, encounters, and carnivory.
- **[P4]** [Staged prompts](../../../../../docs/prompts.md), particularly application boundaries, scale, themes, and map interaction.

Browser references checked on 15 September 2026:

- **[W1]** MDN, *Using Web Workers*: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers`
- **[W2]** MDN, *Transferable objects*: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects`
- **[W3]** MDN, *Optimizing canvas*: `https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas`
- **[W4]** MDN, *Window: requestAnimationFrame() method*: `https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame`

The cohort design, batching conditions, priority order, and validation strategy above are recommendations derived for this project. They are not benchmark results. Probability examples are mathematical illustrations, not results from an implemented evolution engine.
