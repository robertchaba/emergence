# Rendering boundary

The [life rendering notes](LIFE.md) describe implemented producer tinting,
size-scaled population silhouettes, selected-species occupancy, and their original
provisional brief. Rendering consumes the
[common life observations](../simulation/life/CONTRACT.md), independently of a
model's internal organism/cohort representation.

`map.js` presents read-only world snapshots using Canvas 2D. The UI supplies
resolved theme tokens, viewport size, a presentation camera, selected layer, and
pin. Geometry methods fit the map, locate hex centers, and pick a hex from pointer
coordinates. Longitude wraps continuously, including picking, rivers, life marks
and selection contours; the two polar edges remain finite.
Optional `life`, `showLife` and `selectedSpeciesId` draw completed life observations
without modifying physical geography. Role colours and both selection styles
come from resolved theme tokens. Marker work is capped at 24 stationary plant
marks plus 30 other marks per occupied hex, with fewer at low zoom; marks are
samples, not literal organism counts. Three size bands preserve large
plants and animals beside abundant smaller organisms. Stationary marks do not
animate, and stationary-only hexes need no cosmetic-clock repaint.
`life-marks.js` owns cosmetic paths, size, colour and stable variant selection.
`life-shapes.js` supplies 28 silhouette families: six plant and eight consumer
forms for each of land and water. Observed habitat selects separate foliage,
bodies and appendages. Larger animals have larger size-dependent caps and slower
cosmetic movement and gait. Optional `energySources` observations distinguish
three two-source feeding combinations; unavailable detail and all-three feeding
retain the mixed colour. These are token selections, not new ecological roles.
It reads no genes and consumes no biological randomness; anatomy is illustrative.

`cover(world)` fills the viewport; `fit(world)` returns the minimum zoom that
keeps duplicate hexes, including partial copies, outside opposite viewport edges.
`constrain(world, camera)` enforces this minimum and normalizes horizontal pan
modulo the cylinder circumference. UI applies it after resizing and restoring
saved cameras as well as during interaction. Each hex is drawn at its nearest
longitude to the view center; territory contours join across the physical seam.
During climate playback, UI also supplies the original read-only `geography`
snapshot to `draw`. Its identity keys static colours and river geometry. It must
be replaced whenever physical geography changes. The renderer retains the last
frame and repaints life changes locally. Freeze/thaw changes repaint the full
engraved terrain frame to keep translucent ink edges clean; camera, selection,
size, layer, geography, life-run identity, overlay visibility, species selection
and token changes invalidate that frame. Changed life summaries repaint affected cells,
including cells that became empty. Temperature and moisture
still repaint from the current readings. These caches never alter snapshots.

Land retains its plain physical fills. Water adds faint grain, pale flecks and
flowing engraved lines. The water line field uses periodic physical coordinates,
so its curves continue across adjacent hexes and the longitude seam. Fine shore
strokes follow actual land/water edges.
Hex colour fills retain their physical shading; there is no cloudy noise wash.
Cosmetic geometry is cached by geography and anchored to the map. Detail fades
out in tiny overview cells; frost attenuates water grain, while frozen water
loses its flowing lines and shore accents. Decorations draw beneath rivers,
life marks and selections, using resolved theme tokens. They describe no extra habitats,
measured currents or organisms, and consume no biological randomness. Diagnostic
layers retain their plain fills; unchanged frames still skip raster work.

`life-trend.js` provides `createLifeTrendSvg(samples, { metric, label })` for the
latest 180 public observations. Recorded days determine horizontal spacing;
each metric's vertical scale includes zero. UI supplies the translated label,
formatters and theme styling. Genome portraits were removed in decision 047;
the chart uses SVG and `currentColor` without reading genomes.

Never mutate snapshots or simulation state, issue engine commands, or import UI
or engine implementations. UI supplies snapshots and presentation options.
Map drawing uses Canvas 2D; charts use SVG. Colours and
typography come from the computed CSS custom properties, never literal drawing
colours. See [the root contract](../../AGENTS.md) and
[architecture decisions](../../docs/ARCHITECTURE.md).
