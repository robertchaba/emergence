# Rendering boundary

Reserved for presentation of read-only snapshots. There is no renderer yet.

Never mutate snapshots or simulation state, issue engine commands, or import UI
or engine implementations. UI supplies snapshots and presentation options.
Future map drawing uses Canvas 2D; illustrations and charts use SVG. Colours and
typography come from the computed CSS custom properties, never literal drawing
colours. See [the root contract](../../AGENTS.md) and
[architecture decisions](../../docs/ARCHITECTURE.md).
