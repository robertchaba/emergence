# Shared world rules — from evolution simulation summary v6

## Scope and source of truth

**Split on 2026-09-16; no physical rules changed.** This file keeps the shared
world material from the original combined v6 summary at its existing path.
The life-specific material now lives in
[life model v1's summary](../src/simulation/life/v1/evolution_simulation_summary_v6.md).
Original section numbers are retained across the split so research citations
remain traceable: sections 1–4 describe the world, 5–8 and 10–11 describe life,
and 9 and 12 are split by ownership.

All life models use the same generation, terrain, water, temperature, moisture,
seasons, geographic diagnostics, and application speed rules. The adopted
implementation and subsequent refinements are recorded in
[architecture decisions 011–015 and 021](ARCHITECTURE.md#011--deterministic-geography-and-established-flow--2026-09-15).
Those decisions take precedence over earlier proposals here; for example,
`waterAbundance` was added after the original v6 input list. Physical coefficients
remain provisional defaults, not scientific calibration.

Source history: the original v6 superseded a v5 summary absent from this checkout
and drew on [staged prompts](prompts.md),
[starting genes](../src/simulation/life/v1/evolution_simulation_genes_v1.md), and
[evolution mechanics](../src/simulation/life/v1/evolution_mechanics_summary_v3.md).
The latter two are now research for life model v1, not shared world rules.
The common [life-model boundary](../src/simulation/life/README.md) and
[UI data contract](../src/simulation/life/CONTRACT.md) explain how models consume
physical conditions without changing them.

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

A year has 360 days and begins at the northern spring equinox. The hemispheres have opposite seasonal phases.

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

Sea and lake hexes have `moisture = null`.

Below 0 C, water renders as pale ice and land as frosted. Seasonal freezing does not change hydrology. Permanent ice is derived from annual maximum temperature; the life model decides its biological consequences.

### Map presentation

Retain the visual direction in `prompts.md`: depth-graded blue seas; a distinct desaturated teal for lakes; warm grey-tan land, lighter with elevation and relief shading; thin rivers whose width follows accumulated flow; distinct spring markers.

Provide terrain, elevation, temperature, moisture and region/pass debug layers. Temperature uses a continuous cold-to-warm ramp and land moisture a dry-to-wet ramp. Both themes must remain legible. Water has no land-moisture reading.

The map inspector should explain a barrier using physical facts. A geographic region border alone must never be presented as an impassable wall. Organism-specific eligibility comes from the selected life model.

## 9. Geographic regions

Generate stable geographic regions and a debug graph of their connections before introducing organisms. Derive them from land/water connectivity, physical difficulty, annual climate and bottlenecks such as passes and isthmuses.

A suitable deterministic partition separates easy-access cores at ridges, harsh belts or narrow connections, then records the connecting passages. Use fixed tie-breaking and scale-aware thresholds. Do not simply assign random IDs or grid rectangles.

Region IDs describe geography. They do not grant resources, prohibit crossing, assign genomes or automatically create species. Different organisms can experience different effective regions on the same map. Recompute organism-specific access from actual capabilities, not from a land-oriented region color.

## 12. Physical-world acceptance checks

- Identical generation inputs reproduce the same world; day changes preserve geography and do not mutate the input.
- Neighbor counts and every relevant calculation work across the cylindrical seam, but never wrap north to south.
- Pre-lake land fraction is within one hex of its requested budget; final dry-land fraction is reported separately.
- Drainage has no cycles, every route ends at sea, tributary flow is conserved, and lakes exist only where fed.
- The small world retains a river, coherent regions and meaningful connections rather than noise.
- Northern and southern seasonal phases oppose each other; land moisture stays in 0-1 and is null on sea/lake hexes.
- Region IDs remain stable through the year and are geographic diagnostics only.

## Shared playback and time rules

These are application rules for every life-model version, retained from
[decision 015](ARCHITECTURE.md#015--open-atlas-notebook-and-playback-controls--2026-09-15).
The setup preview advances climate at 20 days/s. Start opens the atlas at the
preview's current day, paused. Atlas speed ranges from 1× to 10×, with
1× = 2 days/s and 10× = 20 days/s. The interface reports target and measured
actual speed. Hidden tabs pause without catch-up. Browser pacing and measurement
belong in `src/ui/`, outside the headless physical and life models.

A speed setting requests more simulated time per real second. It never changes
life probabilities or model parameters. The future life model must complete its
required updates for the requested days before publishing a result. Display
frames may be skipped; biological time cannot be silently skipped. The current
climate-only `setDay` shortcut is not a life-advancement operation. A slower model
reduces actual throughput rather than changing these shared speed meanings.

Starting or resuming playback is distinct from introducing life. The biological
meaning of **Start life here** belongs to the selected model; its shared command
boundary is described in the [life contract](../src/simulation/life/CONTRACT.md).
No playback or button behavior changes in this documentation step.
