# Life rendering

## Selected hex and energy chart — 2026-09-20

Decision 059 supersedes the historical single-total living-species chart and
sole-species auto-expansion without highlighting. Opening a sole local species
now also selects its occupied range; explicit collapse remains persistent.
Notebook details show both total species population and the selected hex's count.
The selected hex renders last with a thicker gold rim, dark contrast edge and
slightly stronger translucent fill, distinct from the pale species contours.
Theme tokens supply all colours, including the system-dark fallback.

The SVG trend optionally stacks disjoint model-supplied energy-source counts
using discrete day steps and a zero-based total scale. UI supplies translated
legend counts and an accessible explanation; mixed strategies are labelled Other.
No renderer or UI classifies genomes. Models without the extension retain their
total chart; legacy V3 history lacks the breakdown until new observations exist.
The chart is a species census, not energy intake or organism abundance.


## Population silhouettes and curved motion — 2026-09-19

Decision 052 supersedes 042's all-dot close views, radial mobile appendages,
straight waypoint interpolation and eight-update close-view ceiling. Low zoom
keeps simple dots, with the same 6 / 15 / 30 per-hex budget and abundance sampling.
At closer zoom, stationary larger producers become translucent three-leaf rosettes;
consumers become small illustrative silhouettes with rounded grazer bodies,
pointed predator bodies and dorsal segments for mixed/other roles. Body size
still scales marks, with a six-pixel consumer base radius cap and the existing
3.5-pixel plant cap. There are no enclosing dark outlines. A root-defined
`--map-life-detail` token supplies the light engraving in both themes and the
system fallback; all other role colours and coverage meanings are retained.

Mobile land groups have alternating bent limbs; mobile water groups have curved
tails and fins. This uses the supplied display habitat, role, size and mobility,
not model genomes or invented species. All anatomy is schematic. Groups remain
pooled by role/habitat/mobility, not individually tracked or identified by shape.
Joined quadratic curves give continuous positions and tangents; bodies turn to
face the local path. Their convex hull and bounded appendage lengths keep them
inside the occupied hex. No trails or journeys between hexes are inferred.
Stationary producers keep scattered fade/renewal, while stationary consumers keep
fixed positions. Neither idle consumers nor reduced-motion views animate limbs.

UI supplies at most eight cosmetic updates per second at wide views and 24 when
camera zoom reaches 3×. Pause, hidden tabs and reduced motion freeze this clock.
The renderer remains read-only, caches the same bounded summaries, and repaints
changed cells through the existing damage path. All biological state, randomness,
counts, climate and actual inter-hex dispersal are unchanged.

Validation covers deterministic bounded paths, tangent continuity, fixed
stationary consumers, habitat/role distinction, drawing budgets, zoom detail,
frozen observations, paused frames and damage repaint equivalence. Controlled
common-observation screenshots cover both themes on desktop and phone; they are
rendering fixtures, not evidence of naturally evolved species or calibrated biology.

## Compact notebook and all-size producer coverage — 2026-09-19

Decision 047 supersedes the portrait, adaptation note and tiny-producer-only
tint rules below. All producer display groups contribute to green terrain and
elevation coverage, regardless of size or mobility, while retaining dots. The
existing abundance curve, land/water caps and diagnostic fills are unchanged.

Genome portraits and their SVG helper are removed. Original artwork remains.
Species details begin with population and inherited traits. **Possible
adaptations** is a native, initially closed details/summary disclosure, with
short localized changes and approximate hex counts. Its explanatory paragraph
is removed. Accessible range-button names still identify estimates; empty
ranges remain disabled. Disclosure state survives live updates and theme/locale
changes for the same species, and resets when a different species is opened.
Collapsing does not clear the selected range. The unchanged population chart
now lives in `life-trend.js`.

## V3 established traits and estimated directions — 2026-09-19

**Historical presentation; compact disclosure and portrait removal superseded above.**

V3 supplies one established genome per species. Its ordinary inherited traits
and portrait describe that genome. Up to three `tendencies` appear separately
under **Possible adaptations**, localized in English and Polish. Each supplies
changed traits and an estimated favourable range. The note explicitly states
that these are not tracked carriers and may disappear without producing a species.
Directions with a nonempty range use native buttons to highlight the supplied
hexes through the existing variant-range overlay. Empty ranges are disabled;
no simulated position, population share or guaranteed branch is implied.

Range estimates come from the model at the completed observation revision.
UI only translates and displays them; inspection never runs evolution. Existing
partial-carrier presentation remains supported for older model observations.
The map, portrait grammar, colours and population marks retain their meanings;
no renderer imports a life model or interprets its genome internals.

## Stable near-universal gene appearance — 2026-09-17

Decision 044 supersedes the earlier dimming of every non-universal gene. Notebook
trait labels and expression values keep their normal theme colour when their
carrier share is at least 98%, using the existing interaction cutoff before
rounding. Only shares below 98% use muted text. Thus small carrier fluctuations
that still display as 100% no longer change colour. The 2% visibility cutoff,
percentages and carrier selection retain their existing meanings; the observations
and biological rules are unchanged.

## Smaller scattered marks and local movement — 2026-09-17

Decision 042 supersedes the twelve-marker budget, fixed stationary geometry,
diagnostic-only tiny-plant marks and small orbital mobile drift described below.
All groups now receive dots, including tiny stationary producers, whose existing
terrain tint remains. Abundance gives up to ten samples per role/habitat/mobility
group, bounded to 30 per hex (six or fifteen at lower zoom). Radii are reduced,
with a 3.5 CSS-pixel cap. Stationary producers use a separate translucent
`--map-life-plant` colour in both themes and the synchronized system fallback.
Coverage retains the stronger existing producer token.

Each slot uses a reproducible cosmetic hash of hex, slot and animation interval.
Stationary marks fade out and reappear at new positions every twelve visible
playback seconds, with staggered phases. They do not crawl. Mobile marks smoothly
interpolate scattered waypoints every 3.5 seconds, retaining appendages at close
zoom. Paths stay within the occupied hex; these are representative marks, not
tracked individual organisms or inferred biological journeys. UI supplies the
clock at at most eight updates per second, stopping on pause, hidden tabs and
reduced motion. Changed marks participate in damage repainting; observations,
biological randomness and counts remain untouched.

Notebook body-size expressions use ten localized word labels across the supplied
trait range (tiny through enormous), without numeric size or cell counts. Carrier
percentages and gene selection retain their existing meanings. Neither size
labels nor marker styling changes biological body size.

## Current portrait and terrain palette — 2026-09-17

Decision 040 places the genome portrait directly below the expanded species name,
before population and gene details. It still depicts the most populous complete
living genome. The producer token is a more saturated leaf green in both themes;
bare land and relief use softly warm stone greys, halfway between the original
warm palette and the first cooler revision following user feedback. These
supersede the earlier producer and land palettes, including the
system-dark fallback. Tint strength, markers, diagnostic colour meanings and
selection styling retain their existing behavior. All colours remain root tokens
resolved by UI; neither the renderer nor the simulation gains new life rules.

## Current notebook highlights — 2026-09-17

Decision 039 supersedes decision 038's teal carrier palette and three-chart
notebook. Both themes now use a pale species outline, a dark-green dashed
carrier outline, and a substantially lighter green carrier fill. Selected
notebook controls use a separate dark-green surface with pale text, keeping
control contrast independent from the translucent Canvas fill. Geometry, the
contrast halo, pin ordering and read-only rendering boundary stay the same.

The notebook renders only the living-species trend; extinct species and
occupied-hex percentage retain their text counts. The generic SVG metric
renderer remains available. UI shows expressions covering at least 98% as plain
values and clears a carrier selection that reaches that threshold. Binary traits
show percentages without “Present”; UI still filters expressions below 2%.
These are presentation cutoffs only. The source observations and biology retain
every carrier. A selected carrier hex may also contain other expressions.

## Earlier territory and trend presentation — 2026-09-17

**Palette, chart count and universal-expression interaction superseded by 039.**

Decision 038 supersedes decision 037's per-hex selection strokes and combined
chart. Selecting a species fills its occupied range lightly and outlines the
union with a continuous, rounded stroke and contrast halo. Shared hex edges are
removed using exact integer vertex keys; disconnected patches and internal holes
retain their boundaries. At the cylindrical map cut each side closes locally,
with no line across the atlas. Geometry follows occupied hexes, without claiming
sub-hex organism positions or inventing an ecological boundary.

Selecting a notebook gene expression supplies its observed carrier hex IDs as
`selectedVariantHexIds`. The renderer adds a teal fill and narrower dashed contour
while retaining the species outline. This is an additional selection layer, not a
biological classification. It remains distinguishable even when both ranges match.
Pin/hover outlines still render above it. Changed range membership invalidates the
frame; stable contours are cached across climate, animation and population changes.
The five selection tokens are resolved from CSS by UI, including both themes
and the system fallback.

`createLifeTrendSvg` renders one metric per chart with its own zero-based scale:
living species, extinct species, and occupied-hex counts. Every chart uses the
same last 180 completed physical days, discrete step paths, current-count text,
axis ticks and a translated accessible description. The occupied-hex summary
remains a percentage; its chart plots the actual hex count. Extinction keeps its
dashed line. Compact population formatting and the 2% expression visibility filter
belong to UI, leaving exact observations unchanged.

## Earlier species-centered presentation — 2026-09-17

**Selection and chart details superseded by decision 038 above.**

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
