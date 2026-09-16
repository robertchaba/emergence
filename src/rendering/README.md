# Rendering boundary

The [provisional life rendering brief](LIFE.md) records future green hex tinting
for very small plants and size-scaled dots for larger organisms. It remains
documentation only and will be refined by later instructions. Future life
rendering consumes the [common life observations](../simulation/life/CONTRACT.md),
independently of a model's internal organism/cohort representation.

`map.js` presents read-only world snapshots using Canvas 2D. The UI supplies
resolved theme tokens, viewport size, a presentation camera, selected layer, and
pin. Geometry methods fit the map, locate hex centers, and pick a hex from pointer
coordinates. Wrapped connections are clipped at both cylindrical edges.

`cover(world)` fills the viewport; `fit()` reveals every complete edge hex.
During climate playback, UI also supplies the original read-only `geography`
snapshot to `draw`. Its identity keys static colours and river geometry. It must
be replaced whenever physical geography changes. The renderer retains the last
frame and repaints frost/ice changes locally; camera, selection, size, layer,
geography, and token changes invalidate that frame. Temperature and moisture
still repaint from the current readings. These caches never alter snapshots.

Never mutate snapshots or simulation state, issue engine commands, or import UI
or engine implementations. UI supplies snapshots and presentation options.
Map drawing uses Canvas 2D; future illustrations and charts use SVG. Colours and
typography come from the computed CSS custom properties, never literal drawing
colours. See [the root contract](../../AGENTS.md) and
[architecture decisions](../../docs/ARCHITECTURE.md).
