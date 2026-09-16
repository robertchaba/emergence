# Provisional life rendering brief

**Documentation only, 2026-09-16.** Life rendering is future work. These are the
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
