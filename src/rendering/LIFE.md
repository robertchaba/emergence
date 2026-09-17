# Life rendering

## Current presentation — 2026-09-17

Decision 037 supersedes the optional overlay, outlined markers, automatic species
highlight, and population chart below. Life always renders. Small stationary
producers tint physical terrain and have a small colour mark on diagnostic layers;
other groups use filled colour markers without
an enclosing outline. Optional model-supplied `mobile` groups have same-colour
appendages at close zoom and a small local cosmetic drift. UI supplies `motionTime`
at at most eight animation updates per second during visible playback, honoring
reduced motion. Rendering never infers mobility from genes or advances biology.
Changed mobile cells participate in the existing damage repaint path. At most
12 marks are drawn per hex, from at most 20 role/habitat/mobility groups.

Only clicking a species enables `selectedSpeciesId`; every currently occupied hex
is highlighted using the theme's selected colour. A sole local species may open
its notebook details without highlighting. Default world geometry and stationary
marks remain stable, and all observations remain read-only. The removed outline
token leaves six life palette tokens. Explicit light selection uses ochre rather
than the earlier dark brown.

`createSpeciesTrendSvg` replaces the population chart with living and extinct
species series over up to 180 actual completed days. Discrete step paths, a shared
zero-based scale, dashed extinct series, numerical ticks, a text legend and an
accessible description distinguish the series without colour alone. UI formats
ticks and labels in the selected locale. The genome portrait is retained and
uses the most populous complete living genome of the selected species.

## Earlier implemented presentation — 2026-09-16 (superseded above)

The v1 implementation consumes completed common life observations through
`map.draw(world, { life, showLife, selectedSpeciesId, ... })`. `life.hexes` carries
physical hex IDs, species populations and model-derived display groups. The
renderer does not inspect genomes, select roles or read private cohort state.

- Producers with a supplied normalized body size at or below 0.25 tint terrain
  and elevation toward the theme's producer colour. Tint rises logarithmically
  with abundance, capped at 44% for land populations and 20% for water populations
  (48% combined). These are visual thresholds, not biological rules. Diagnostic
  temperature, humidity and region fills keep their physical meaning.
- Larger producers and all other roles use contrasting, outlined dots. Ten
  possible role/habitat groups are reduced to at most twelve representative
  markers per occupied hex. Lower zoom levels show three or six. Dot radius
  follows normalized body size, capped at eight screen pixels. Neither a dot nor
  the number of marks in a specimen portrait is an organism count.
- Selecting a species outlines its occupied hexes. Pin and hover outlines remain
  above life; rivers and geographic diagnostics remain visible. Text in the
  notebook supplies the actual population, role, traits and habitat.
- Marker positions are deterministic in hex coordinates. Camera, day, theme and
  biological random state do not drive cosmetic placement. Geometry is cached
  per physical world with at most twelve positions per hex; only one life
  observation's aggregate display cache is retained.

Life changes participate in the existing damaged-cell repaint path. Extinction
clears old marks; a new run, overlay visibility, species selection, theme, camera,
size or geography invalidates the frame. Revisions with identical visual summaries
can reuse it. Aggregation never changes supplied observations or real counts.

The seven `--map-life-*` tokens cover producer, grazer, predator, mixed, other,
outline and selected colours, resolved by UI for each theme. Role names describe
model-supplied feeding capabilities and are not predefined species or biomes.

`specimen.js` provides `createSpecimenSvg(traits, { label })`, a deterministic
abstract specimen plate for common trait observations. Size, trunk,
photosynthesis, movement and feeding traits vary the schematic membrane,
appendages and internal marks. It uses `currentColor` and CSS classes supplied
by UI. Omit the label for a decorative SVG next to text; a provided label is
escaped into an accessible image name. The drawing is illustrative, not a
prediction of anatomy or a scale-calibrated image.

Validation: renderer tests cover frozen observations, tint versus habitat,
diagnostic preservation, changed revisions, extinction, selection and overlay
visibility, bounded population-independent marker work, stable cosmetic geometry,
and safe deterministic SVG output. This validates presentation, not the model's
biological fidelity.

## Original provisional brief — preserved history

**Original documentation-only scope, superseded above on 2026-09-16.** Life rendering is future work. These are the
initial assumptions requested by the user; further instructions will refine or
replace them before/during implementation. No colours, thresholds, marker
algorithms or overlay code are added now.

| Life shown | Initial presentation |
| --- | --- |
| Very small plants | Tint the occupied hex toward green. Make the effect more pronounced on land and less pronounced on water. |
| Larger plants | Green dots. Larger body size produces a larger dot. |
| Other larger organisms | Dots in other colours, also larger for larger bodies. |

This is a presentation convention, not predefined plant/animal species or an
ecological biome assignment. Each life model derives role and body-size data
from its own rules through the [common life contract](../simulation/life/CONTRACT.md).
Rendering consumes that data without inspecting genes or classifying organisms.
The model must document its body-size measure; the renderer must not assume all
models use v1's body-cell formula or a 1–10 scale.

The definition of “very small,” tint strength versus abundance, size-to-dot
scaling, palette for other organisms, mixed feeding roles, small non-plants,
mixed land/water river hexes, marker placement, sampling and zoom behavior all
remain open for further instructions. Do not silently choose biological rules
to fill these visual gaps. A dot is not automatically one organism; any later
aggregation must remain distinguishable from the real population counts shown
in the inspector. Selection and physical map information must remain readable.

UI/browser adapters resolve all colours (including greens, alpha values and
selection states) from root theme tokens in `src/ui/styles/tokens.css` and pass
them to rendering. Both themes and phone/desktop views must be supported.
Inspection provides text/counts alongside colour so the map is not the only way
to identify life. Labels and numbers use the UI's English/Polish localization.

Tinting, dots, display aggregation, camera and drawing cadence never alter
organisms, counts, climate or biological randomness. Rendering receives read-only
observations of a completed revision; it does not import model implementations
or issue engine commands. Future visual customization belongs here and in
rendering, with any genuinely new required observation added explicitly to the
common contract.
