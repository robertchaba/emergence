# Prompt 1 — Foundation, docs, and branding

I want to build a browser-based emergent evolution sandbox. A player generates a world, seeds life in one hex, and watches resources, inheritance, mutation, and seasons shape descendants. There are no predefined species and no scripted outcomes: geography and physics come from the world, ecology emerges from life. This is a rewrite of an earlier attempt — the world generator and the simulation rules will be designed from scratch in later steps.

**This task is setup only. Do not write any simulation, world generation, or map rendering code.**

## Inputs already in the repository

- `/docs` — my research notes and design documentation. Read it before proposing anything.
- `/resources` — logos and a UI mockup. Use the logos for identity and the mockup as the reference for the visual language. `logo-dark` is the anchor for the dark theme: pull its palette, weight, and line quality into the interface so the branding and the UI read as one system.

## What I want from this task

1. **Project structure** and installed dependencies, with a working dev / build / preview loop and a test command that runs (even if it covers almost nothing yet).
2. **`README.md`** — what the project is, how to run it, where the documentation lives.
3. **`AGENTS.md`** — the contract for me and for coding agents: the rules below, the layer boundaries that must not blur, what to run before declaring work done.
4. **`docs/ARCHITECTURE.md`** — the durable decision record, started now and extended in every later step.
5. **A single static landing page**: branding from the logos, the project name and one-line description, a short explanation of what the sandbox is, and a theme switcher. Real styling, no placeholder greys — this page is where the visual language gets settled. A disabled or non-functional "Start" affordance is fine; there is nothing behind it yet.

## Tech stack

Browser-first. No backend, no application runtime dependencies. Plain JavaScript ES modules — no TypeScript, no type transpilation, no configuration for either. Vite as a dev-only server and static bundler, output to a static `dist/`. Native HTML and CSS for the interface, no UI framework. Canvas 2D for the map and SVG for illustrations and charts, later. Playwright as a dev-only real-browser check. Node 22.12+ for tooling; users need only a browser.

## Structure and boundaries — set these up now, they are expensive to retrofit

Three layers, strictly separated from the first commit:

- `src/simulation/` — headless and deterministic. No `window`, `document`, Canvas, storage, or DOM. Nothing here yet beyond the folder and its rule.
- `src/rendering/` — consumes read-only snapshots, never mutates state.
- `src/ui/` — composes screens and issues explicit commands.

Dependency direction is UI → engine and renderer, never the reverse. Simulation code must never call `Math.random()` or read wall-clock time; when it arrives it will use an explicit seeded PRNG with serializable state. Put these rules in `AGENTS.md` and `docs/ARCHITECTURE.md` now, before there is any code to break them.

## Themes and visual language

Two complete themes, switchable, both first-class. Define **every** colour, and the type scale, as CSS custom properties on `:root`, redefined per theme — nothing hardcoded anywhere, including future Canvas drawing code, which will read these tokens.

- **Light — vintage biology book**: aged paper ground, sepia and ink-brown text, hairline rules, engraved / lithograph feel, restrained botanical-plate accents, a serif for headings.
- **Dark — modern laboratory, green-tinted**: not a neutral grey dark mode. The ground is a very dark desaturated green-black (around `#101a17`), panels are slightly lifted green-greys (`#1b2b22`, `#203128`), body text is a warm off-white with a green cast (`#e4e9dc`), muted text a sage grey (`#98a698`), and the single accent is a pale lichen green (`#c4dba5`) used for primary buttons, focus rings, and active state. Hairline borders are the accent at very low opacity. Thin precise lines, monospace for numbers and readouts, tabular figures. Take `logo-dark` from `/resources` as the reference for the exact hue and mood; treat those hex values as a starting point to match against it, not as law.

The switcher respects the system preference by default and remembers an explicit choice. Both themes must be legible and deliberate on the landing page; the page has to work on a phone as well as a desktop.

## Checks

A Playwright smoke check that the page loads, both themes apply, and the layout holds at desktop and phone widths. Wire it into `npm test`.

Keep it minimal and correct. Ask me if something here is ambiguous rather than guessing.

---

# Prompt 2 — Application shell and screens

Now build the interface skeleton. **Still no world generation and no simulation** — the map surface renders a placeholder grid so that interaction can be built and tested against something.

Two screens:

- **World setup**, in the normal page: controls for seed, world size, geography (a continents ↔ archipelago slider, 0–100%), land fraction, a map preview area, and a Generate world action. The controls can be inert for now, but their state must be real and read by the code that will later call the generator.
- **Simulation workspace**, opened by a Start button, filling the whole viewport: the map fills the screen, with a header carrying an application menu (Fit world, return to World setup) and a notebook panel at the side on desktop, below the map on a phone.

Interaction on the map surface: scroll and pinch to zoom up to ~32×, drag to pan, click to pin a hex, and keyboard control when focused — arrows move the inspected cell, `+`/`−` zoom, `Escape` clears the pin. Layer toggles switch the map between terrain, elevation, temperature, and humidity views; they can all draw the same placeholder for now. The notebook is tabbed and keyboard-navigable with arrows, Home, and End; start with a single Hex tab that shows whatever is known about the pinned cell.

Returning from the workspace to setup must restore focus to the Start button. Everything uses the theme tokens from the previous step — no new hardcoded colours.

Extend the Playwright checks to cover navigation between screens, zoom/pan/pin, keyboard inspection, and both layouts.

---

# Prompt 3 — World generation: grid, elevation, water

Build the headless generator in `src/simulation/`, and wire it to the preview and the workspace map.

**Grid.** Cylindrical odd-row hex grid. Left and right edges wrap; top and bottom do not. Interior hexes have six neighbours, polar boundary hexes four. Land, rivers, drainage, and distance calculations must all continue across the seam.

**Scale.** Three sizes, all at a 3:2 ratio: small 24×16 (384 hexes), medium 60×40 (2,400), large 120×80 (9,600). Medium is the default. 120×80 is the *largest* world in this project — it was the smallest in my previous attempt, so we are deliberately working at a much smaller scale. The small world is genuinely tiny on purpose: it is for fast iteration, debugging, and reading every hex at a glance, so the generator must still produce a coherent world at 384 hexes — continents, at least one river, and more than one region — rather than degrading into noise. Check that explicitly.

**Elevation.** `generateWorld({ seed, size, geography, landFraction })` returns a serializable snapshot. Seeded integer coordinate hashing plus about five octaves of interpolated noise, periodic in longitude. The continuous `geography` parameter from 0 (broad continents) to 1 (archipelago) blends adjacent integer longitude frequencies — roughly 4 to 10 — at each octave, rather than switching between discrete presets. Choose sea level by quantile to hit a target land fraction, ~38% and configurable between 35% and 40%. Sea beds are strictly negative metres, sea surface is zero, and inland negative terrain is water too. Reserve every top and bottom row hex as sea with a negative bed elevation *before* allocating the land budget, and taper terrain toward those poles. This is deterministic geography, not a tectonic model — say so in the architecture doc.

**Drainage and fresh water.** Derive drainage from bed elevations and adjacency using a stable priority flood starting from all sea hexes, finding each depression's lowest spill elevation. Surfaces never rise downstream, flats get a stable outlet direction, and every route terminates at sea without cycles. Place rare seeded groundwater springs on land above ~300 m and outside depressions, each with a fixed discharge. Any land hex carrying positive accumulated flow is a river channel; tributaries sum their flow and carry it through lakes to the sea. A depression becomes a lake only when spring flow enters it: the whole basin fills, side pockets included, then overflows at the spill point. Keep basins deeper than a few metres and sediment-fill the rest — whole basins, never a random subset of cells.

Track separately, per hex: bed elevation, water level (the spill surface), local spring discharge, accumulated runoff, lake inflow, and distance to the nearest water. This is an established-flow approximation computed once at generation time — no erosion, evaporation, infiltration, or progressive filling. Document that limitation rather than hiding it.

**Terrain colours**, from the theme tokens: ocean as depth-graded blue, lighter in the shallows and darker in the deeps; lakes a distinct desaturated teal; land a warm grey-tan that lightens with elevation, with hillshade-style relief shading. Rivers as thin lines whose width follows accumulated flow, springs marked distinctly.

**Do not** define forest, desert, grassland, or swamp as generation outputs. Ecological labels may one day summarise observed patterns; they must never be an input.

Add headless tests: land fraction within tolerance, seam continuity, every drainage route terminates at sea, no cycles, lakes only where fed, and identical output from an identical seed.

---

# Prompt 4 — Seasons, climate, and barriers

**Seasons.** A 360-day year beginning at the northern spring equinox, hemispheres in opposite phase. `setDay(world, day)` takes a non-negative integer day and returns a new snapshot without mutating its input. Derive temperature in °C from latitude, elevation at a 6.5 °C/km lapse rate, and a seasonal wave whose amplitude is smaller over water. Derive land humidity as a 0–1 moisture index — not atmospheric relative humidity — from distance to water, elevation, temperature, and a seasonal term; water hexes have no humidity value. Below 0 °C, water renders as pale ice and land as frosted: these are presentation states derived from temperature, and hydrology itself does not change with the season.

Wire up the remaining map layers: temperature on a continuous blue → red hue ramp, humidity from dry ochre to wet green. Both must stay legible in each theme.

**Barriers.** This is the one thing my previous attempt lacked, and I want it built into generation. The world must be partitioned into semi-isolated regions, because isolation is what will later drive divergence.

- Hard barriers: continuous high mountain ridges, wide deep-ocean gaps, permanent polar ice.
- Semi-barriers: narrow passes, isthmuses, island chains and straits, arid interiors, cold high plateaus — crossable, but costly.

Generate these as consequences of elevation, temperature, and humidity, not as decorations painted on afterwards. Expose a per-hex traversal difficulty and a region id in the world snapshot, and add a debug map layer that draws the regions and the passes between them, so I can judge whether a generated world is interestingly partitioned before any life exists. The simulation will decide later what to do with these values; generation only has to produce and expose them.

Add tests for seasonal symmetry between hemispheres, `setDay` purity, humidity bounds, and region partitioning being stable for a given seed.
