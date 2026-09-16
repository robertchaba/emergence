# Simulation boundary

This layer generates physical geography, derives seasonal climate, and implements
the first versioned life model. The physical modules do not own biological rules
or a browser clock.

Life/evolution implementations and their approximation methods belong in
versioned `life/v1/`, `life/v2/`, etc. The [life boundary](life/README.md) and
[common observations](life/CONTRACT.md) define how alternative models consume
shared physical inputs and expose data to UI. [V1](life/v1/README.md) implements
the eight-trait candidate and records its choices in
[DECISIONS.md](life/v1/docs/DECISIONS.md). Generation, terrain, water, temperature,
moisture, seasons and shared speed meanings are not versioned with life models;
their [rules stay in docs/](../../docs/evolution_simulation_summary_v6.md).

```js
import { generateWorld, setDay } from './world.js';

const world = generateWorld({
  seed: 'emergence', size: 'medium', geography: 0.5, landFraction: 0.38,
});
const summer = setDay(world, 90);
```

Sizes are `small` (24 × 16), `medium` (60 × 40) and `large` (120 × 80).
Geography is 0–1; land fraction is 0.35–0.40. The requested fraction counts the
non-marine footprint before freshwater lakes; `nonMarineLandFraction` and
`dryLandFraction` expose both measurements. `setDay` takes a non-negative integer
and returns a new snapshot without changing geography, hydrology or region IDs.

Snapshots contain serializable plain data. Consumers treat them as read-only.
Generation records its version, normalized seed, candidate index and stateless
integer hash inputs. V1 owns a separate seeded biological random stream and exports complete
continuation state. `climateAt(world, hex, day)` lets sparse biological work query
the same climate as the atlas without allocating an entire seasonal world.

The cylindrical odd-row grid wraps longitude only. Periodic five-octave noise
provides synthetic geography; it is not a tectonic model. Stable priority flood
derives drainage and spill surfaces. Springs supply fixed reference discharge;
fed depressions fill their entire basin. Basin depths of at most five metres
are sediment-filled. This established-flow approximation has no erosion,
evaporation, infiltration, rainfall discharge or progressive filling.

The generator tries at most twelve deterministic candidates for connected land,
a river, multiple meaningful regions and a costly pass. Exhaustion throws a
visible error rather than silently weakening those requirements. Regions and
passes are physical diagnostics, never organism movement rules or species IDs.

Run focused headless checks with `node --test tests/headless/*.test.js`.

No UI/rendering imports, DOM, `window`, `document`, Canvas, browser storage,
`Math.random()`, or wall-clock reads (`Date`, `performance.now()`). Future random
choices must use an explicit seeded PRNG with serializable state. Accept explicit
inputs and commands; expose read-only snapshots. See [the root contract](../../AGENTS.md)
and [architecture decisions](../../docs/ARCHITECTURE.md).
