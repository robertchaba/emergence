# Common life-model contract

This is the semantic contract `life/vN/` implementations must expose to UI
and rendering. It defines meanings and required queries, not JavaScript function
signatures, private state layouts, a worker protocol or a save-file schema.
V1, V2 and V3 implement these semantics; the active API is documented in
[v3/README.md](v3/README.md), with preserved implementations in
[V2](v2/README.md) and [V1](v1/README.md). The [ownership rules](README.md) apply to every version.

## Commands and simulated time

The UI sends the intent to introduce life, the selected physical hex ID, and
explicit model settings. The selected model validates the request and decides
founder genomes, numbers, habitat, initial energy, eligibility and any effect on
existing life. It returns success or a structured rejection reason that UI can
translate. A rejected request leaves life, physical state and random state
unchanged; UI must not silently choose a different hex, edit traits, or seed again.
Repeated-start policy and extinction behavior must be documented by each model.

World setup's **Start** continues to open the atlas. **Play/Pause** and speed
remain shared browser controls. They must not implicitly seed, replace or reseed
life. **Start life here** is the separate biological intent described above;
the implemented UI sets the maximum target speed and requests playback after
successful introduction (architecture decision 044). Entering a
new atlas starts at day 1, paused; preview time is separate. This supersedes the
original UI choice to leave introduction paused (architecture decision 037).

Future advancement supplies explicit simulated days and the matching shared
environment. Each model completes its own required biological updates before
reporting that time as completed. Faster playback changes throughput targets,
not parameters or per-event probabilities. Climate-only `setDay` does not advance
life. Queries and snapshots must never advance time or consume biological random
state. Internal phases and approximation methods belong to the versioned model.

## One consistent observation

Every observation identifies the life run, physical world, generator version,
model ID and rules revision, common contract version, completed simulated day,
and snapshot revision. World identity is more than a seed: different settings or
generator revisions can produce different maps from that seed. Snapshot revision
also distinguishes accepted commands at the same day.

Publish only completed states, including completed initialization. World totals,
hex details, species records and display summaries must refer to the same
revision. If a query is asynchronous, its reply identifies that revision and run
so UI can discard stale replies after stepping, changing models or worlds.
UI must not combine totals from one day with occupancy from another.

Data crossing this boundary is serializable and treated as read-only. Models may
use individuals, exact cohorts or another documented representation internally.
The common consumer must not need to know that layout, import a version's code,
or recreate its classification and counting logic. Snapshot ownership must keep
later engine work from silently changing an earlier observation.

## Required observations

| UI question | Required answer from the model |
| --- | --- |
| Has life been introduced? | Distinguish not introduced, living population present, and extinct after introduction. This is separate from Running/Paused playback. |
| How many organisms and species exist now? | Global living-organism total, extant-species total, and occupied-hex count, with count quality as defined below. |
| Which species exist? | Extant species records with stable IDs, display names and current population totals. Historical/extinct records and their total are explicitly separate. |
| What lives on this hex? | Total living population and one row per present species with its local population; include a separate unclassified population if applicable. |
| Where does this species live? | All occupied physical hex IDs for that species and its population on each hex. |
| How much of this species is on a given hex? | The same local count used by both the hex query and species-location query. |
| What should the map depict? | Hex-associated abundance, body-size and derived role summaries sufficient for the [rendering brief](../../rendering/LIFE.md); no CSS colours or Canvas commands. |

Use the physical world's stable `hex.id` values. Species IDs are opaque,
locale-independent and stable within a run; they are not region IDs, genome IDs,
array positions or translated names. A species may span many hexes and many
genomes; a hex may contain many species. IDs from different runs/models must not
be treated as the same species. Each model owns the criteria for creating,
changing or retiring a species identity, and documents them.

Species display names are locale-independent cosmetic labels, separate from opaque
IDs and biological classification. V1 stores deterministic generated names without
consuming biological randomness. Its `counts.extinctSpecies` and completed-day
`history[].extinctSpecies` count retired identities in the current life attempt.
Explicit restart begins a new attempt; older attempts remain archived separately.

V1 additionally exposes `species[].traits`: present trait keys, carrier totals,
and each present expression with its carrier count and model-derived units/ranges.
Consumers can show shared versus partial expression without inspecting genomes.
The species population is the denominator for carrier percentages. Display groups
optionally declare `mobile`; only the model decides whether mobility is enabled.
Cosmetic motion supplied to rendering never changes biological position.

V1's optional `species[].variants[].locations` and each trait expression's
`locations` contain exact carrier populations by physical hex, scoped to that
species and observation revision. Their populations sum to the variant/expression
population. These are detached observations, not cohort access. UI may hide rare
expressions or round displayed counts without removing carriers from observations,
changing count quality, or altering biological state. Carrier highlights use these
supplied locations; consumers must not infer them from genome internals.

If useful, models can also expose parent IDs, trait descriptions, habitat
breakdowns or organism inspection. These are optional, explicitly described
extensions with units/availability; generic UI must not depend on v1's gene names
or invent missing detail. A model with cohorts need not fabricate individually
addressable organisms. Engine IDs and saved state are never translated; visible
labels and number formatting belong to English/Polish UI.

## Counting and availability

“Organism count” means the number of living organisms represented by the model,
not body cells, biomass, cohort records, rendered dots or cumulative births.
Established living newborns count even before their first active turn. Failed
establishment and dead organisms do not. Each organism's population contribution
belongs to exactly one physical hex at a completed snapshot. Any future model
with distributed bodies must document its counting location so it cannot inflate
totals by occupying several hexes.

“Species count” means distinct model-assigned species IDs with a positive living
population in the queried scope. A species on three hexes counts once globally.
Species-level sums include all its living genomes, not just a representative.
Unclassified organisms, if a model permits them, remain in a separate count and
are included in organism totals without inventing a species ID. An exact cohort
of 800 organisms contributes 800 organisms, not one.

Before introduction, a known empty world has zero living counts and the explicit
not-introduced status. Extinction also has zero living counts, with a different
status; UI does not infer a new seeding command from this status. An empty valid
hex returns zero and an empty species list. An unknown hex/species ID is an invalid
query, not an empty population. An extinct species retained in optional history
has zero population and an empty current location list.

Counts declare whether they are exact counts of represented state, estimates,
or unavailable. Exact organism counts are non-negative integers. Estimates
identify their method and uncertainty/error bounds where known; unknown
uncertainty is stated. Unavailable is never encoded as zero. A required count
cannot be silently omitted by a new model: its support must be declared and UI
must show unavailable until supplied. Incomplete/paged results state their scope
and cannot masquerade as the complete species or location list.

Approximation metadata is distinct from count quality. A model with approximate
energies may still count its represented organisms exactly. That does not make
its biological trajectory exact. Model rules, approximation mode and validation
status remain explicit; no model may label guessed or sampled totals as exact.

## Consistency checks for future implementations

For complete exact observations of the same revision:

- The global organism total equals the sum over all hexes, and the sum of species
  totals plus any unclassified population.
- A species' global population equals the sum of its per-hex populations.
- A hex total equals its species rows plus its unclassified population. Its
  species count equals the distinct positive-count species IDs in those rows.
- The global species count is the union of positive-count IDs across hexes,
  never the sum of the hex species counts. Occupied-hex count includes each hex
  with positive total population exactly once.
- Habitat or display-size breakdowns, when provided as partitions, reconcile
  with their parent count. Overlapping descriptive roles are labelled and are
  not added as though they were disjoint populations.

Estimated results must derive from one consistent estimate for that revision,
with any rounding/error tolerance documented; separate queries must not resample
and disagree. Extant species detection under approximation is a model rule, not
a UI rounding threshold. Population capacity, carrying limits, extinction and
speciation decisions belong in each model, never in query or rendering code.

Example: species A has 7 organisms on hex 10 and 3 on hex 11; species B has 2 on
hex 11. World totals are 12 organisms, 2 species and 2 occupied hexes. Hex 11 has
5 organisms and 2 species; species A has 10 organisms across 2 hexes. Splitting
A's storage into more cohorts or drawing fewer dots changes none of these values.

## V2 continuation and observation compatibility

V2 uses the same count, trait, variant, carrier-location, display and history
extensions described above. Its complete 20-trait catalogue supplies ranges and
units; UI localizes keys and categorical skeleton/armor values, without reading
genomes. `modelId` and `rulesRevision` identify V2 explicitly. Pending dispersal
carriers count at their source until arrival and never occupy two hexes at once.
V2 checkpoints include pending passages and niche/spatial classification timers;
V1/V2 checkpoints are intentionally incompatible. Shared weather identity belongs
to world metadata, so life and atlas observe the same explicit-day conditions.

V2 revision `v2-cohorts-2` uses compact local variant representatives. Its
`countQuality: exact` means an exact census of represented integer populations;
it does not claim exact genetic frequencies, phenotypes, body investment or
ecological trajectories. Compaction conserves counts, species identity, physical
location and pending passage while assigning some carriers to retained complete
genomes. Traits, variants and their locations describe that completed represented
state, rather than discarded genetic detail. UI and rendering continue to consume
these observations without implementing compaction or accessing private genomes.

The optional `approximation.variants: local-representatives`,
`maximumVariantsPerPool: 3` and `variantPool` fields describe the model's budget.
It applies per species/hex/habitat/acquisition-signature/pending-passage pool,
not per species, hex or world. `stats.variantReassignments` is the cumulative
population reassigned during compaction passes, not unique organisms, births
or deaths. A full pool does not create a species. These are V2 observations,
not common biological rules or new commands/settings.

V2's `approximation.maximumRoundingStorageLoss` bounds only storage rounding per
biological turn. It replaces `maximumDailyStorageLoss`, which cannot bound the
additional reserve loss when compaction chooses a smaller-body representative.

The format name remains `emergence-life-v2-checkpoint-1`, but continuation also
requires `rulesRevision: v2-cohorts-2`; checkpoints from older V2 rules are rejected.
Stable compacting tickets use one-draw seeded substreams reconstructed from saved
seed, pool and genome identities. The main biological PRNG retains its complete
serialized state, and observation queries consume neither source of randomness.

## V3 established genomes and estimated adaptation directions

V3's `variants` contains the one established representative genome of a species;
its population and trait carrier counts cover the whole represented species.
Actual species locations remain integer census observations. The model performs
aggregate population updates rather than maintaining genotype carrier cohorts.

Optional `species[].tendencies` contains at most three prospective directions
per species. Each has a stable ID, described candidate traits, changed traits,
diagnostic strength, `roleChange`, `rangeQuality: estimated`, and `locations`
containing favourable physical hex IDs. Those locations are estimates of current
ecological opportunity within occupied range, not observations of carriers.
They contain no carrier population and are never included in population totals.
Strength describes pressure, not a carrier percentage or probability of success.

UI may highlight the supplied estimated range, with an explicit estimate label.
It must not derive actual gene frequencies, count directions as living species,
or implement scoring. All tendency observations belong to the same completed
revision as the census. Repeated queries cannot resample or progress a direction.
An established species never mixes a producer genome and a consumer genome as
separately behaving carrier populations. New lineages transfer population from
their parent; merely showing a direction creates no organisms.

V3's exact count quality describes the integer represented census, not exact
ecology. Approximation metadata identifies aggregate populations, pooled energy,
stochastic rounding and estimated directions. V3 owns its independent checkpoint
format and rules revision; V1/V2 continuation is intentionally rejected.
