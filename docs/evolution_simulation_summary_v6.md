# Evolution Simulation - Current Design Summary - v6

## Scope and source of truth

This version replaces `evolution_simulation_summary_v5.md`. It adds world generation, climate, habitat transitions, barriers, offspring dispersal and adult movement. Rules describe individual organisms; population aggregation and browser-performance approximations belong in a separate document.

Source documents:

- `prompts.md`, especially prompts 3 and 4: map structure, generation, hydrology, seasons, visual presentation and geographic isolation.
- `evolution_simulation_summary_v5.md`: size, energy, temperature tolerance, light competition and trunk effects.
- `evolution_simulation_genes_v1.md`: the eight-trait starting catalog, land adaptation, movement and feeding.
- `evolution_mechanics_summary_v3.md`: inheritance, mutation, genetic dependencies and species classification, synchronized with this version.

The numeric defaults introduced here are initial simulation-design choices, not biological constants or tested balancing results. The existing 0.01% mutation probability per offspring remains unchanged.

## 1. What the world represents

The world supplies geography and physical conditions. Organisms supply the ecology.

Generation must not assign forest, desert, grassland, swamp, plant species, animal species or food populations. A dry interior is a moisture pattern, not a predefined desert biome. Ecological names may later describe what actually develops.

Geography and established water flow stay fixed during a run. Temperature and land moisture change with the season. Life does not yet change terrain, climate or hydrology.

### Hex grid and scale

Use a cylindrical odd-row hex grid. The left and right edges wrap; the top and bottom do not. Interior hexes have six neighbors and polar boundary hexes have four. Adjacency, drainage, distances, regions, organism movement and dispersal all respect the seam.

| World size | Dimensions | Hexes |
|---|---:|---:|
| Small | 24 x 16 | 384 |
| Medium, default | 60 x 40 | 2,400 |
| Large, maximum | 120 x 80 | 9,600 |

Small is a complete miniature world, not a low-quality preview. It must contain coherent land masses, at least one river and more than one geographic region.

An organism occupies one map hex. Its body-cell count, used for size and energy, is not a footprint spanning several map hexes. Many organisms and species may share a hex.

### Generation inputs

```text
generateWorld({ seed, size, geography, landFraction })

geography:    0 = broad continents; 1 = archipelago
landFraction: default 0.38; configurable from 0.35 to 0.40
```

The same inputs and generator version produce the same serializable world. Generation and later simulation use explicit, reproducible random state, never wall-clock time. Changing the day does not regenerate geography.

## 2. How geography and water are generated

### Elevation and coastlines

Generate a spatially correlated elevation field using seeded integer coordinate hashing and approximately five octaves of interpolated noise, periodic in longitude. The geography slider continuously blends adjacent integer longitude frequencies, roughly 4 through 10, rather than selecting unrelated presets.

Broad structures and connected ridges must survive the higher-frequency detail. Do not produce a checkerboard of unrelated high and low hexes. This is deterministic synthetic geography, not a tectonic simulation.

Reserve every top and bottom row hex as sea, with a negative bed elevation, before allocating the land budget. Taper terrain toward these polar rows. Choose sea level by quantile, with deterministic tie-breaking, to obtain the requested land fraction across the whole grid.

Sea surface is 0 metres. Sea beds are strictly negative. Below-sea-level inland pockets are water too; the initial model treats them as marine-level water even when disconnected from the main ocean.

For clarity, the requested land fraction measures the non-marine footprint before freshwater lakes flood above-sea-level depressions. Also expose the final dry-land fraction after lakes are formed. Do not silently report the former as the latter.

Initial vertical scaling may span approximately -6,000 metres to +5,000 metres. These are generation bounds, not requirements that every map reach both extremes. Terrain must include lowlands, elevated interiors, ridges and lower connections between some regions.

### Drainage, springs, rivers and lakes

Use a stable priority flood from all sea hexes to determine depression spill elevations and a drainage graph. Every drainage route terminates at sea, has no cycle and uses deterministic outlet choices on flats. Routing surfaces never rise downstream.

Keep actual bed elevation separate from the routing/spill surface. Finding a depression does not automatically fill it with water.

Place rare seeded groundwater springs on land above approximately 300 metres and outside depressions. Each spring has a fixed discharge; use one reference flow unit per spring initially. Accumulate that discharge along drainage routes. Tributaries add their flow, and water continues through lakes to the sea.

A land hex carrying positive accumulated flow contains a river channel. A depression becomes a lake only if spring-fed flow reaches it. Fill the whole connected basin, including side pockets, to its spill surface and route overflow through its outlet. Keep basins deeper than a few metres; sediment-fill shallower basins as whole basins, not arbitrary subsets of hexes.

This is an established-flow approximation, calculated during generation. There is no erosion, evaporation, infiltration, rainfall-driven discharge, progressive lake filling or seasonal rerouting. Climate moisture is an ecological index, not a conserved volume of river water.

### Generation quality

Derive barriers and connections from the elevation and climate fields, not from invisible walls or labels painted onto the map afterward.

Validate candidate worlds for land fraction, coherent geography, connected drainage, at least one spring-fed river, and meaningful regional separation. Use a bounded deterministic sequence of candidate seeds when a candidate fails. Record the selected candidate and generator version. A bounded failure must be reported rather than silently removing requirements.

At least some regions should be joined by a narrow or costly route. A collection of arbitrary region colors does not satisfy this requirement, nor does making every region completely inaccessible.

## 3. What each hex contains

Store physical facts separately from derived ecological interpretations.

| Field | Meaning |
|---|---|
| `id`, coordinates, neighbors | Stable identity and cylindrical adjacency |
| `bedElevation` | Ground or seabed height in metres |
| `waterType` | `none`, `sea` or `lake`; rivers are a separate feature |
| `waterLevel` | Actual water surface; null on land without a channel |
| `spillElevation`, drainage outlet | Depression/routing information, not proof that a lake exists |
| `springDischarge` | Local groundwater contribution |
| `runoff` | Accumulated channel flow in reference flow units |
| `lakeInflow` | Incoming flow relevant to the lake/basin |
| `distanceToWater` | Shortest hex distance to sea, lake or a river channel, including seam wrap |
| `temperature` | Current temperature in degrees Celsius |
| `moisture` | Current land moisture, 0-1; null on sea and lake hexes |
| `permanentIce` | Annual maximum temperature remains below 0 C |
| `traversalDifficulty` | Static reference terrain difficulty, 0-1; not universal organism passability |
| `regionId` | Stable geographic diagnostic label |

Water depth is derived from water level minus bed elevation. A river channel can use the local bed as its reference surface because channel cross-sections are not modeled.

A compatibility `water` boolean may mean `waterType !== 'none'`, but it is not enough to determine every habitat: a river-bearing land hex has both land and a water channel.

Also expose region connections/pass edges and the physical reasons for difficulty. Occupants are simulation state, not generation outputs.

## 4. Seasons and climate

A year has 360 days and begins at the northern spring equinox. The hemispheres have opposite seasonal phases. Initially, one simulation turn advances one day; time compression executes more turns without changing per-event probabilities.

`setDay(world, day)` accepts a non-negative integer and returns a new snapshot without mutating its input. Physical geography, hydrology and geographic region IDs do not change.

### Initial temperature rule

The following coefficients make the climate rule explicit; they remain balancing parameters.

```text
latitude = 90 - 180 * row / (height - 1)
season = sin(2 * pi * (day % 360) / 360)
seasonalSignal = (latitude / 90) * season

surfaceHeight = land bed elevation, or water surface elevation
meanTemperature = 28 - 60 * (abs(latitude) / 90)^2
                  - 0.0065 * max(0, surfaceHeight)

seasonalAmplitude = 4 on sea/lake hexes; 12 on land

temperature = clamp(meanTemperature
                    + seasonalAmplitude * seasonalSignal,
                    -40, 40)
```

This preserves the specified 6.5 C/km elevation adjustment and smaller seasonal temperature swings over water. Seabed depth must not cool surface organisms as though they lived on top of a mountain. River-bearing land hexes use the land climate; separate river-water temperatures are outside the initial model.

### Initial land-moisture rule

Moisture is a 0-1 environmental water-availability index, not atmospheric relative humidity. The interface can display it as a percentage.

```text
moistureDistanceScale = width / 20

moisture = clamp(
    exp(-distanceToWater / moistureDistanceScale)
    - max(0, bedElevation) / 10000
    - 0.01 * max(0, temperature - 20)
    - 0.10 * seasonalSignal,
    0, 1
)
```

Sea and lake hexes have `moisture = null`. Aquatic organisms obtain their water-availability factor from their occupied habitat, not by reading a fictitious 100% land-moisture value.

Below 0 C, water renders as pale ice and land as frosted. Seasonal freezing does not change hydrology or turn water into a walkable land bridge. Its ecological effects come from temperature efficiency. Permanent ice is a separate, annually derived hard barrier for the initial capability set; under-ice and ice-dwelling habitats are not represented.

### Map presentation

Retain the visual direction in `prompts.md`: depth-graded blue seas; a distinct desaturated teal for lakes; warm grey-tan land, lighter with elevation and relief shading; thin rivers whose width follows accumulated flow; distinct spring markers.

Provide terrain, elevation, temperature, moisture and region/pass debug layers. Temperature uses a continuous cold-to-warm ramp and land moisture a dry-to-wet ramp. Both themes must remain legible. Water has no land-moisture reading.

The map inspector should explain a barrier using physical facts and, when an organism is selected, that organism's actual crossing eligibility. A geographic region border alone must never be presented as an impassable wall.

## 5. Habitats and land adaptation

### Occupied habitat

An organism has a location and an occupied habitat: `land` or `water`. This is one non-genetic state value, not a new trait, body system or sub-hex position.

Ordinary land offers land habitat. Sea and lake hexes offer water habitat. River-bearing land offers both. In a river hex, aquatic and terrestrial organisms can coexist; they still share the hex's single light budget.

A land hex adjacent to sea or lake is coastal. River-bearing land also provides direct water access. Neither coastal adjacency nor high moisture turns ordinary land into water habitat.

### Land-adaptation states

```text
absent <-> 1 <-> 2 <-> 3
```

| State | Water habitat | Land habitat | Moisture for full land efficiency |
|---|---|---|---:|
| Absent, aquatic | Yes, factor 1.00 | No | Not applicable |
| 1, amphibious | Yes, factor 0.90 | Yes | 0.85 |
| 2, terrestrial | No | Yes | 0.50 |
| 3, dry-land adapted | No | Yes | 0.25 |

Water performance at state 1 is slightly reduced, and states 2-3 relinquish aquatic residence. Additional dry-land specialization also has an upkeep cost. These trade-offs prevent the highest state from being universally preferable.

On land:

```text
effectiveMoisture = moisture

with direct access to non-permanent-ice water:
    effectiveMoisture = max(moisture, 0.85)

moistureFactor = clamp(effectiveMoisture / fullEfficiencyMoisture, 0, 1)
```

Direct access means a river channel in the same hex or sea/lake water in a neighboring hex. It does not imply access across an impassable cliff or permanent-ice boundary.

The moisture targets are not admission thresholds. An amphibious organism can enter drier land, but produces or assimilates less energy there. At moisture 0.25 without direct water access, land factors are approximately 0.294, 0.50 and 1.00 for states 1, 2 and 3 respectively.

The habitat factor for a water occupant is the water factor in the table. Unsupported habitat is a hard incompatibility, not simply a low moisture value.

Aquatic, amphibious and terrestrial traits work independently of photosynthesis, grazing or predation. There are no separate land-animal and water-animal classes.

Freshwater and seawater have no salinity distinction in this starting gene set. Deep ocean remains surface water habitat for aquatic organisms; ocean-floor pressure, darkness and benthic life are not modeled.

## 6. Barriers and crossing difficulty

Crossing is checked for a particular organism, source, destination and habitat transition. It is not a property of `regionId`.

### Hard barriers in the initial model

A crossing is impossible when there is no valid neighboring connection; the destination lacks a supported habitat; the connection touches permanent ice; or the required terrain movement exceeds the starting capabilities.

Initial ground/shoreline limits are:

```text
land at or above 3,500 m: inaccessible to ground/shoreline traversal
absolute surface-height step of 1,000 m or more: impassable cliff
```

These are coarse simulation thresholds, not geological definitions. Apply them to ground movement and shoreline transitions, including stationary offspring dispersal. They do not prohibit swimming over a deep seabed. Water-to-water routes are governed by water connectivity and climate, not by the height of the sea floor.

There is no flight, teleportation, dormant long-distance seed transport or arbitrary chance of crossing an otherwise impossible barrier. A later capability can explicitly change these rules.

### Semi-barriers

Passes, isthmuses, straits, island chains, arid interiors, cold plateaus and river crossings can reduce passage rates or make residence unproductive without being absolutely forbidden.

Use this initial difficulty rule after hard exclusions:

```text
riverDifficulty = min(0.5, 0.1 * log2(1 + runoff))

landTraversalDifficulty = clamp(
    max(max(0, bedElevation) / 3500, riverDifficulty), 0, 1)

waterTraversalDifficulty = 0
```

Expose the dominant habitat's value as the hex's static `traversalDifficulty`. For river hexes, water traversal uses the water value rather than inheriting the ground penalty.

For a ground or shoreline connection:

```text
terrainDifficulty = max(
    applicable source and destination terrain difficulties,
    abs(destinationSurfaceHeight - sourceSurfaceHeight) / 1000
)
```

For a valid water-to-water connection, terrain difficulty is initially zero. Currents, waterfall geometry and channel cross-sections are not simulated in this version.

The actual organism-specific crossing difficulty is:

```text
D = clamp(max(
    terrainDifficulty,
    1 - destinationTemperatureFactor,
    1 - destinationHabitatFactor
), 0, 1)

passageProbability = 1 / (1 + 4 * D)
```

Thus easy passage succeeds with probability 1; difficulty 0.5 gives 1/3; difficulty 1 gives 1/5. Difficulty 1 is not the same as a hard exclusion. Poor destination conditions also affect subsequent energy acquisition, so arriving does not guarantee establishment.

These two effects represent different things: the difficulty of getting there and the difficulty of living there. Do not add another unexplained survival multiplier on top.

### Water connectivity and rivers

Adjacent sea/lake water surfaces connect normally where they physically touch. River channels connect along their actual drainage links, including lake inlets, outlets and river mouths. Treat channel links as usable in either direction initially; drainage direction does not itself simulate current.

Two neighboring river hexes are not an aquatic connection unless their channels are linked. High moisture, neighboring drainage basins and a low mountain pass do not allow a purely aquatic organism to cross dry ground.

An amphibious organism can leave a river, occupy land and reach another basin through consecutive local moves or generations. Each land step faces the normal moisture, temperature and terrain rules.

A river channel does not make its whole land hex impassable to terrestrial organisms. Ground movement through such a hex pays the river difficulty, but exact bank positions are not represented. A genuinely broad water obstruction must occupy sea/lake hexes; do not invent hidden banks that disagree with the visible grid.

### Interpreting common barriers

| Feature | Terrestrial organism | Aquatic organism | Amphibious organism |
|---|---|---|---|
| Open ocean | No water residence or crossing | Potential habitat and route | Potential route, with aquatic specialization penalty |
| Narrow strait | Still blocked without a suitable capability | Ordinary water connection | Crossable through the intervening water hexes |
| Isthmus | Potential land corridor | Separates water bodies | Potential overland route |
| Dry interior | Costly; dry adaptation can help | No route without connected water | Possible entry, often poor establishment |
| Mountain ridge/cliff | Blocked above structural limits | Seabed relief is not a wall; rivers still require actual links | Ground/shoreline limits apply |
| Permanent polar ice | Blocked | Blocked in this initial model | Blocked |

An island chain does not let a land organism skip sea hexes. It can support stepping-stone expansion only for a lineage able to use the intervening habitats. Wide ocean gaps are therefore hard geographic separation for land-only lineages, but not universal walls for sea life.

## 7. Offspring dispersal

All organisms, including stationary plants, use the same basic dispersal rule. The movement gene is not required.

For each offspring whose reproduction cost has been paid:

```text
95%: attempt establishment in the parent's hex
 5%: attempt dispersal to one uniformly selected neighboring hex
```

The neighboring hex is selected from all actual neighbors, not only favorable or passable ones. With no neighbor, use the parent's hex. Wraparound neighbors are ordinary neighbors.

Apply inheritance and the possible single mutation before evaluating the offspring's habitat capabilities. A mutation neither points toward the destination nor gets rerolled after a failed crossing.

Within the selected hex, prefer the parent's occupied habitat when it is available, connected and supported by the offspring. Otherwise use the other habitat only if it is physically present, reachable and supported. In a river hex, this can allow a locally born mutant to establish on the bank rather than in the channel. Do not inspect food, competition or future weather to pick a better habitat or hex.

For neighboring dispersal, check the hard barriers and then roll the passage probability from section 6. A blocked crossing, failed passage roll or incompatible establishment loses the offspring. The parent does not receive a refund, replacement offspring or second destination attempt. Staying in the parent hex does not require a geographical passage roll, but establishment still requires a supported habitat and respects permanent-ice and land-elevation exclusions.

An established newborn joins the destination with its own complete genome and zero stored energy. It becomes active on the following turn. It cannot disperse again, move actively, feed or reproduce during its birth turn.

Dispersal covers one adjacent hex only. A stationary lineage crosses a chain of hexes through successive successful births and local establishment; it cannot jump an uninhabitable gap. Every intervening hex and boundary matters.

## 8. Active movement

The movement gene is initially present or absent. It adds its normal gene upkeep and permits relocation during an organism's lifetime.

An organism with a trunk does not actively relocate in this initial model. It may still carry a movement gene and pay for it, and its offspring still disperse normally. This is an ecological interaction, not a rule silently deleting genes.

At the beginning of a turn, an eligible organism has:

```text
movementAttemptProbability = 0.10
                            * currentTemperatureFactor
                            * currentHabitatFactor
```

On an attempt, select uniformly among neighboring hexes, plus the alternative habitat in the same hex when one exists. Prefer continuing in the current habitat when it gives a valid connection; otherwise consider a supported habitat transition. The initial behavior is a local random search, not global pathfinding or perfect food detection.

A hard-blocked or incompatible choice is abandoned without a reroll or energy charge. For a traversable choice, calculate D as above and:

```text
movementEnergyCost = 0.10 * cells * (1 + 4 * D)
```

The cost must be available in stored energy. Otherwise the organism stays. When affordable, pay it once and roll the passage probability. A failed passage leaves the organism at its source, with that attempt cost spent. A successful passage moves it to the destination with its remaining stored energy.

A same-hex habitat switch is also a movement action, pays the basic cost adjusted for destination conditions, and observes habitat/ice restrictions and the land-elevation limit; it does not inherit an artificial across-hex cliff penalty.

At most one action is attempted per organism per turn. An organism cannot move several hexes because its destination is processed later in the same loop. Successful movers acquire energy and pay upkeep at their destination that turn, not at both locations.

Movement does not replace upkeep, manufacture energy or guarantee escape from starvation. The existing small energy stores can make some poor-habitat crossings effectively impossible even when they are not hard terrain exclusions. Seasonal improvement or a different adaptation may open such a route.

## 9. Geographic regions and evolutionary isolation

Generate stable geographic regions and a debug graph of their connections before introducing organisms. Derive them from land/water connectivity, physical difficulty, annual climate and bottlenecks such as passes and isthmuses.

A suitable deterministic partition separates easy-access cores at ridges, harsh belts or narrow connections, then records the connecting passages. Use fixed tie-breaking and scale-aware thresholds. Do not simply assign random IDs or grid rectangles.

Region IDs describe geography. They do not grant resources, prohibit crossing, assign genomes or automatically create species. Different organisms can experience different effective regions on the same map. Recompute organism-specific access from actual capabilities, not from a land-oriented region color.

Species classification follows `evolution_mechanics_summary_v3.md`: use actual occupied habitats and physically possible connections, not region IDs. A soft barrier alone does not declare speciation; it must actually lead to the persistent spatial and genetic separation required by the classifier.

## 10. Existing organism and energy rules

### Size

```text
size: integer 1 through 10; default 3
cells = 1 + 3 * size * (size - 1)
```

Examples: size 2 has 7 cells, size 3 has 19, and size 4 has 37. Size affects upkeep, storage, reproduction cost, competition and feeding. It is not another active gene charged separately.

### Light and photosynthesis

Each map hex has one fixed light budget, initially 2,000 units per turn. It is not multiplied by the number of species or habitats in that hex. Latitude and seasons affect climate, but do not yet add a separate daylight model.

An organism's maximum light absorption is its cell count times its photosynthesis capacity share. Only organisms with photosynthesis participate in light competition.

```text
photosyntheticProduction = allocatedLight
                          * temperatureFactor
                          * habitatFactor
                          * photosynthesisMultiplier
```

`habitatFactor` is the adaptation-aware moisture/water factor in section 5. This replaces multiplying production by raw humidity. A dry-adapted organism at 25% land moisture can therefore operate at full moisture efficiency rather than being permanently limited to 25%.

The photosynthesis multiplier remains a calibration parameter. It must permit positive net energy in a suitable, uncrowded starting habitat; a value of 1 cannot support the default organism because its maximum absorption is 19 and its upkeep is 20. This version does not otherwise rebalance baseline production or reproduction-cost scaling.

### Temperature tolerance

| Gene state | Full-efficiency temperature range |
|---|---:|
| Absent | 18-22 C |
| -2 | 9-14 C |
| -1 | 13-19 C |
| 0 | 16-24 C |
| +1 | 21-27 C |
| +2 | 26-31 C |

The temperature-tolerance gene first appears at expression 0. Expression changes one step per mutation. Every present expression, including 0, counts as an active gene.

Use this initial continuous penalty beyond the tolerated interval:

```text
distanceOutsideRange = max(toleratedMinimum - temperature,
                           temperature - toleratedMaximum, 0)
temperatureFactor = max(0, 1 - distanceOutsideRange / 10)
```

Efficiency is 1 inside the range, 0.5 at 5 C beyond it, and zero at 10 C beyond it. This gives the previously unspecified penalty curve an explicit starting value. Temperature affects photosynthesis and consumer energy assimilation, and also movement initiation as described above. Do not multiply the same feeding-energy calculation by the factor twice.

### Upkeep, storage and starvation

Preserve the existing base upkeep and add only the stated dry-land specialization surcharge:

```text
upkeep = cells + numberOfActiveGenes + max(0, landAdaptationState - 1)
```

Use state 0 for an absent land-adaptation gene in this cost expression. Its total contribution is therefore 0, 1, 2 or 3 energy units for absent, amphibious, terrestrial and dry-land states. Other genes retain their existing active-gene cost.

Storage capacity is one energy unit per body cell. A size-3 organism stores at most 19. After any movement expenditure and local feeding/predation resolution:

```text
available = remainingStoredEnergy + netAcquiredEnergy
shortage = max(0, upkeep - available)

deathChance = shortage / upkeep
```

If upkeep is covered, pay it, reproduce when eligible and affordable, then store the remainder up to capacity. If upkeep is not covered, roll starvation independently for that organism. A survivor has zero stored energy and cannot reproduce that turn.

| Upkeep | Available | Death chance |
|---:|---:|---:|
| 20 | 19 | 5% |
| 20 | 15 | 25% |
| 20 | 10 | 50% |
| 20 | 0 | 100% |

There is no persistent starvation counter, biomass loss or separate dehydration-health system. Hard crossing failures are transport/establishment failures, not a replacement for normal starvation after arrival.

Reproduction eligibility and the size-dependent reproduction-cost curve still require their existing separate calibration. Whenever a birth is paid for, the full cost is spent even if dispersal fails. Newborns receive no free stored-energy reserve.

### Light competition and trunk

For land occupants:

```text
landCompetitionFactor = 1 + 0.05 * size
                        + 0.003 * size^2 * trunkStrength

competitionWeight = cells * landCompetitionFactor * photosynthesisShare
```

For water occupants:

```text
competitionWeight = cells * photosynthesisShare
```

Use trunk strength 0 when absent. A trunk has no land-light competition benefit in water. Size's basic land advantage and the stronger large-body/trunk synergy remain unchanged.

| Size | No trunk | Trunk 5 | Trunk 10 |
|---:|---:|---:|---:|
| 2 | 1.10 | 1.16 | 1.22 |
| 3 | 1.15 | 1.285 | 1.42 |
| 4 | 1.20 | 1.44 | 1.68 |
| 5 | 1.25 | 1.625 | 2.00 |

Allocate light by weight subject to each organism's absorption cap, redistributing unclaimed light among remaining eligible organisms. Never allocate more than the hex budget. In a mixed river hex, each organism uses the formula for its occupied habitat within the same allocation pool.

The intended size trade-off remains cheaper reproduction for small bodies versus stronger crowded-land light competition for large bodies. Exact reproduction scaling is not settled by the movement rules.

### Feeding integration

Retain the starting gene document's feeding principles. Photosynthesis, plant feeding and animal feeding share one energy-acquisition capacity equally among the systems present. Extra feeding systems do not multiply total capacity, and reduced photosynthesis share reduces both its light cap and competition weight.

Grazers remove at most 20% of each producer's current-turn photosynthetic production, all grazers combined, with an initial 60% food-to-consumer energy conversion. They do not automatically kill whole plants. Low food density reduces encounter success, and feeding capacity limits consumption. Predation requires a suitable encounter and size relationship, kills its prey, and must not create energy.

Feeding occurs within the occupied habitat. Water occupants do not graze terrestrial occupants merely because they share a river hex, and terrestrial predators do not automatically eat fish. An amphibious consumer must occupy the relevant habitat to feed there. The capacity and encounter rules still apply; movement does not give access to an entire neighboring food population.

This document does not introduce guaranteed ecological equilibrium or immunity from local extinction.

## 11. Turn order and starting life

Use one defined day and a fixed action order:

1. Compute the current day's climate without altering geography.
2. Resolve at most one movement attempt for each organism alive at turn start; decisions use the same pre-movement snapshot and results are committed together.
3. Resolve destination-local light allocation and feeding using the resulting locations. A killed organism cannot subsequently act or reproduce.
4. Settle energy, upkeep and independent starvation outcomes.
5. Resolve eligible reproduction, inheritance, mutation and offspring dispersal; record newborns for activation next turn.
6. Cap stored energy, update spatial/genetic records and species-classification timers, then advance the day.

Use deterministic seeded ordering where conflicting actions need ordering. Never let map iteration order grant extra moves, repeated resource use or birth-turn reproduction.

The player introduces one founder lineage in one selected hex. The default founder is size 3, has photosynthesis and no land-adaptation gene, and therefore starts in water. The interface should identify a viable, non-ice starting water habitat and explain an unsuitable selection rather than secretly changing the organism's genes. Seeding density is a separate setup parameter.

There is no spontaneous life in empty regions, automatic reseeding after extinction or scripted appearance of animals.

## 12. Examples and acceptance checks

A stationary aquatic producer can expand along connected coastal water through repeated offspring dispersal. Its unchanged offspring cannot colonize a neighboring dry land hex. An offspring that acquires amphibious adaptation may establish there if the destination roll and passage succeed, but its later survival still depends on energy.

An amphibious lineage can spread from a river to a wet bank and then across humid land. A dry interior lowers energy acquisition and passage success. Terrestrial or dry-land adaptation can improve that route, at the cost of aquatic residence and additional upkeep.

A terrestrial animal cannot cross a one-hex strait simply because the opposite shore is close. An amphibious animal can enter the water, then attempt the next step on a later turn. A purely aquatic organism can use the same strait without needing a land gene.

Two identical lineages on opposite sides of a mountain ridge can become isolated without any region-specific genetic rule. A pass may permit occasional migration. If actual separation and genetic divergence persist, the evolution classifier may eventually recognize a new species.

Required checks include:

- Identical generation inputs reproduce the same world; day changes preserve geography and do not mutate the input.
- Neighbor counts and every relevant calculation work across the cylindrical seam, but never wrap north to south.
- Pre-lake land fraction is within one hex of its requested budget; final dry-land fraction is reported separately.
- Drainage has no cycles, every route ends at sea, tributary flow is conserved, and lakes exist only where fed.
- The small world retains a river, coherent regions and meaningful connections rather than noise.
- Northern and southern seasonal phases oppose each other; land moisture stays in 0-1 and is null on sea/lake hexes.
- Region IDs remain stable through the year and never directly decide organism movement or species identity.
- Seasonal ice does not create a land bridge; permanent ice is a hard exclusion for the starting capabilities.
- Aquatic organisms cannot jump between unconnected river channels, while terrestrial organisms can traverse the land portion of a river hex.
- Offspring use 95% local establishment / 5% neighboring attempts before crossing losses; destinations are not rerolled, mutations are not environment-directed, and movement is not required for dispersal.
- Hard barriers have zero crossing probability. Soft difficulty reduces but does not itself eliminate passage probability.
- Failed dispersal does not refund reproduction. Active attempts pay their stated energy cost once, never move more than one hex, and never collect resources twice.
- Mutants use their own habitat capabilities. Body size does not change map adjacency or allow a multi-hex jump.
- All organisms in a hex share one light budget, including the two habitats in a river hex.
- Changing time compression changes the number of simulated turns executed, not mutation, dispersal or movement probabilities per event.

Before calling the wider ecology balanced, test the still-open production multiplier, reproduction-cost curve and feeding coefficients. This version defines spatial and environmental behavior; it does not claim those ecological parameters have already been validated.
