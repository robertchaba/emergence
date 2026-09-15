# Rendering boundary

`map.js` presents read-only world snapshots using Canvas 2D. The UI supplies
resolved theme tokens, viewport size, a presentation camera, selected layer, and
pin. Geometry methods fit the map, locate hex centers, and pick a hex from pointer
coordinates. Wrapped connections are clipped at both cylindrical edges.

Never mutate snapshots or simulation state, issue engine commands, or import UI
or engine implementations. UI supplies snapshots and presentation options.
Map drawing uses Canvas 2D; future illustrations and charts use SVG. Colours and
typography come from the computed CSS custom properties, never literal drawing
colours. See [the root contract](../../AGENTS.md) and
[architecture decisions](../../docs/ARCHITECTURE.md).
