# Rendering boundary

The [life rendering notes](LIFE.md) describe implemented producer tinting,
size-scaled aggregate dots, selected-species occupancy, and their original
provisional brief. Rendering consumes the
[common life observations](../simulation/life/CONTRACT.md), independently of a
model's internal organism/cohort representation.

`map.js` presents read-only world snapshots using Canvas 2D. The UI supplies
resolved theme tokens, viewport size, a presentation camera, selected layer, and
pin. Geometry methods fit the map, locate hex centers, and pick a hex from pointer
coordinates. Wrapped connections are clipped at both cylindrical edges.
Optional `life`, `showLife` and `selectedSpeciesId` draw completed life observations
without modifying physical geography. Role colours and both selection styles
come from resolved theme tokens. Marker work is capped at twelve per occupied hex,
with fewer at low zoom; dots are samples, not literal organism counts.

`cover(world)` fills the viewport; `fit()` reveals every complete edge hex.
During climate playback, UI also supplies the original read-only `geography`
snapshot to `draw`. Its identity keys static colours and river geometry. It must
be replaced whenever physical geography changes. The renderer retains the last
frame and repaints frost/ice changes locally; camera, selection, size, layer,
geography, life-run identity, overlay visibility, species selection and token
changes invalidate that frame. Changed life summaries repaint affected cells,
including cells that became empty. Temperature and moisture
still repaint from the current readings. These caches never alter snapshots.

`specimen.js` creates a gene-responsive abstract SVG plate from public trait
observations. The pure `createSpecimenSvg(traits, { label })` helper returns
markup using `currentColor`; UI supplies styling and optional translated labels.
Its cell marks, outline and appendages are decorative, not measured anatomy.
The same module provides `createPopulationTrendSvg(samples, { label })` for the
latest 120 public population observations. Recorded days determine horizontal
spacing; the vertical scale includes zero. UI owns the sample history, translated
label and theme styling.

Never mutate snapshots or simulation state, issue engine commands, or import UI
or engine implementations. UI supplies snapshots and presentation options.
Map drawing uses Canvas 2D; specimen illustrations use SVG. Colours and
typography come from the computed CSS custom properties, never literal drawing
colours. See [the root contract](../../AGENTS.md) and
[architecture decisions](../../docs/ARCHITECTURE.md).
