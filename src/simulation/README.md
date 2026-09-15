# Simulation boundary

Reserved for the headless, deterministic engine. There is no implementation yet.

No UI/rendering imports, DOM, `window`, `document`, Canvas, browser storage,
`Math.random()`, or wall-clock reads (`Date`, `performance.now()`). Future random
choices must use an explicit seeded PRNG with serializable state. Accept explicit
inputs and commands; expose read-only snapshots. See [the root contract](../../AGENTS.md)
and [architecture decisions](../../docs/ARCHITECTURE.md).
