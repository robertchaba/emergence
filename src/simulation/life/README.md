# Versioned life models

This directory holds alternative life/evolution models: `v1/`, later `v2/`, and
so on. **V1 is implemented.** The application runs the first model against the
shared physical atlas. Alternative-model selection remains future work; the
original research and its implementation decisions stay inside each version.

## Ownership

| Shared across models | Owned by each `life/vN/` model |
| --- | --- |
| World generation, seed interpretation for geography, grid and hex IDs | Biological initialization: what Start life here does, founder traits, number of founders, site eligibility, and repeated-start behavior |
| Terrain, water, drainage, temperature, moisture, seasons, physical regions and diagnostics | Genes, inheritance, mutation, organism state, resources, energy, feeding, reproduction, death, movement and dispersal |
| Explicit simulated days, calendar and application speed meanings | Biological updates within those days, species identity and classification, population dynamics and any model-specific limits |
| Browser pacing, Play/Pause, measured speed, visibility policy | Individual/cohort/population representations, calculation shortcuts, approximations and their validation |
| Common inspection meanings and presentation boundary | Translation of private model state into the common read-only data contract |

The shared physical implementation stays in the existing `src/simulation/`
modules, with its rules in [docs/](../../../docs/evolution_simulation_summary_v6.md)
and the [architecture record](../../../docs/ARCHITECTURE.md). Models receive
read-only physical conditions at explicit days. They do not regenerate the world,
replace climate formulas, change the calendar or speed scale, or write organisms
into physical hex records. A terrain difficulty is a geographic diagnostic;
whether an organism can cross it belongs entirely to the life model.

In particular, v1's light budget, adaptation factors and energy rules are biology
proposals, even though they depend on environmental inputs. They are not extra
shared physics that every later model must inherit.

## Dependency and execution boundary

UI/browser composition supplies explicit commands and physical inputs to the
selected headless model. The model owns its life state and exposes read-only
observations through the [common contract](CONTRACT.md). UI passes those
observations and resolved visual tokens to rendering. Neither UI nor rendering
reads private organism/cohort arrays or implements biological decisions.

Physical modules do not import a life model. Life versions do not import one
another or UI/rendering. A version can use shared headless physical utilities;
browser workers, clocks, persistence adapters and message transport stay outside
the headless layer. Rendering does not import any simulation implementation.
The browser life worker is a UI adapter, not part of a model. No cross-model
registry or implicit state migration is needed for the single implemented model.

All versions retain the repository's deterministic execution requirements:
explicit simulated time, seeded randomness with complete serializable state,
stable action ordering and tie-breaking, and no browser services or wall-clock
reads. Queries, rendering, camera, locale, theme and speed selection cannot
consume biological random state or change results at equal simulated time.

## Version identity and comparison

The folder version identifies a candidate model. The `v6`, `v3` and `v1` suffixes
on research filenames are older document revisions, not competing model IDs.
Each implemented model will also identify its rules revision, parameters and
approximation mode. These are separate from the physical generator version and
the common observation-contract version.

Keep alternative rules and their supporting notes together inside their version.
Do not move v1-specific formulas into a shared helper merely to make v2 reuse
them. Shared code requires an explicitly shared meaning, not similar code alone.
The [v1 index](v1/README.md) identifies the current research and its open questions.

Changing models starts a separate life run against the chosen shared world and
explicit starting day. There is no implicit migration of organisms, species IDs
or PRNG state between incompatible models. Any future conversion must be designed
and documented explicitly. Same terrain and seed do not promise identical biology
across models. Model selection UI and browser save/load remain future work. V1 exports a
versioned headless checkpoint for deterministic continuation.

Later implementations must validate the common inspection invariants as well as
their own biological and approximation rules. Neither this directory layout nor
passing the existing atlas tests establishes that a model works or is balanced.

## Documentation map

Each model version uses the following internal layout:

```text
vN/
  README.md     Model index and open decisions
  docs/         Model documentation and research
  genes/        Model-specific gene code
    docs/       Gene descriptions and research
```

These paths are relative to each `life/vN/`, not the repository root. Shared
world documentation stays in the repository's `docs/`. Gene code remains owned
by its model version; this layout does not create a shared gene implementation.
The v1 folders contain the implementation, gene code, and preserved research.

- [Common life observations and UI commands](CONTRACT.md)
- [Life model v1 research and open decisions](v1/README.md)
- [Provisional rendering brief](../../rendering/LIFE.md)
- [Shared world and playback rules](../../../docs/evolution_simulation_summary_v6.md)
