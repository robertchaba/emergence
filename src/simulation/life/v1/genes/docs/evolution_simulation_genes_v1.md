# Evolution Simulation - Starting Gene Set - v1

> Relocated from `docs/` on 2026-09-16 as research for life model v1.
> The filename revision is the research revision, not the life-model version.
> See the [v1 index](../../README.md) for authority and unresolved decisions;
> this move does not implement or approve the proposed biology.

This document defines a minimal starting set of genes intended to support:

- aquatic and terrestrial organisms,
- transitional organisms living in water, coastal hexes, and very humid land,
- photosynthetic organisms,
- herbivorous animals,
- carnivorous animals,
- aquatic and terrestrial food chains.

The goal is to keep genetics as small and understandable as possible while still allowing these ecological roles to emerge through evolution.

## Design Principle

Genes provide capabilities and trade-offs.

Terms such as **plant**, **herbivore**, **omnivore**, and **carnivore** are descriptions of the resulting organism. They are not separate genes or hard-coded organism classes.

The initial gene set contains eight genes / evolvable traits:

1. photosynthesis
2. size
3. trunk
4. temperature tolerance
5. land adaptation
6. movement
7. plant feeding
8. animal feeding

---

# Existing Genes and Traits

## 1. Photosynthesis

Photosynthesis allows an organism to obtain energy from light using the existing light-competition system.

Its efficiency depends on:

- available light,
- temperature tolerance,
- humidity / water adaptation,
- competition with other photosynthetic organisms,
- the organism's available energy-acquisition capacity.

Photosynthesis is useful when light is available and competition is manageable, but maintaining it should not always be advantageous once an organism evolves alternative feeding methods.

---

## 2. Size

Size remains an evolvable organism characteristic expressed through cell count.

It affects:

- upkeep,
- stored energy capacity,
- reproduction cost,
- light competition,
- feeding capacity,
- prey suitability,
- vulnerability to predators.

Larger organisms can potentially process more food and may be too large for some predators, but they require more energy and are more expensive to reproduce.

---

## 3. Trunk

The trunk gene uses the existing size-dependent land-light competition rules.

Its benefit grows non-linearly with organism size:

- small organisms gain relatively little,
- large organisms gain much more.

The trunk increases upkeep.

A developed trunk should also reduce or prevent efficient active movement, creating a natural distinction between large stationary photosynthetic organisms and mobile animals without introducing a separate "plant" class.

---

## 4. Temperature Tolerance

The existing temperature-tolerance gene remains unchanged.

Without the gene:

```text
18-22 C
```

Possible gene expression states:

```text
-2, -1, 0, +1, +2
```

Tolerance ranges:

| Gene state | Tolerance range |
|---:|---:|
| gene absent | 18-22 C |
| -2 | 9-14 C |
| -1 | 13-19 C |
| 0 | 16-24 C |
| +1 | 21-27 C |
| +2 | 26-31 C |

Mutation changes expression by one step at a time.

For photosynthetic organisms, temperature affects photosynthetic efficiency.

For animals, temperature should also affect feeding and movement efficiency.

---

# New Genes

## 5. Land Adaptation

Land adaptation controls the transition from aquatic life to increasingly dry terrestrial environments.

Suggested states:

| State | Suitable environments |
|---|---|
| gene absent | water |
| 1 - amphibious | water, coastal land, very humid land |
| 2 - terrestrial | moderately humid land |
| 3 - dry-land adapted | land with substantially lower humidity |

Initial balancing targets:

```text
amphibious: approximately 85%+ humidity inland
terrestrial: approximately 50%+ humidity
dry-land adapted: approximately 25%+ humidity
```

These are initial simulation parameters, not biological constants.

Environmental suitability should degrade gradually near the boundaries rather than behaving as a hard pass/fail threshold.

### Coastal Hexes

A coastal hex is a land hex adjacent to water.

An amphibious organism may survive there because immediate access to water represents a sufficiently wet microenvironment even when average land humidity is somewhat lower.

### Important Interaction With Humidity

The current photosynthesis formula uses:

```text
humidity / 100
```

Once land adaptation exists, this should be replaced by a humidity-efficiency factor based on the organism's adaptation.

Otherwise a dry-adapted organism at 25% humidity would still operate at only 25% efficiency, defeating the purpose of the adaptation.

Land adaptation therefore modifies how strongly low humidity penalizes the organism.

---

## 6. Movement

Movement allows an organism to:

- actively move between hexes,
- search for food,
- pursue prey,
- escape predators,
- leave depleted habitats.

Movement has:

- a maintenance cost,
- an additional energy cost when movement actually occurs.

Movement strength may later evolve through expression levels, but the first implementation can begin with a small number of discrete states.

Movement does not determine whether an organism can reproduce into an adjacent hex. Stationary organisms such as plants can still spread through offspring dispersal.

Habitat adaptation determines whether movement is possible in water, wet land, or dry land.

---

## 7. Plant Feeding

Plant feeding allows an organism to obtain energy by grazing photosynthetic organisms.

This gene represents the minimal combined capability needed to:

- find suitable plant food,
- consume it,
- digest it.

More detailed digestive genes are intentionally postponed.

Plant feeding has its own upkeep cost and uses part of the organism's energy-acquisition capacity.

---

## 8. Animal Feeding

Animal feeding allows an organism to capture and consume other animals.

In the initial model, the gene combines:

- prey handling,
- capture capability,
- digestion of animal tissue.

A successful hunt:

- requires an encounter,
- depends on prey size,
- depends on relative movement capability,
- kills the prey.

More detailed genes such as jaws, claws, venom, vision, armor, and pack hunting can be added later if needed.

---

# Energy-Acquisition Capacity

Keeping photosynthesis should not remain universally advantageous after feeding evolves.

To create a meaningful reason to specialize, all active energy-acquisition systems share a common capacity.

The initial rule is:

| Active systems | Capacity allocation |
|---|---|
| photosynthesis only | 100% photosynthesis |
| photosynthesis + plant feeding | 50% / 50% |
| plant feeding only | 100% plant feeding |
| plant feeding + animal feeding | 50% / 50% |
| animal feeding only | 100% animal feeding |
| all three | approximately 33% each |

This is a derived property, not another gene.

For photosynthesis, the allocation should limit effective light absorption as well as resulting energy production. An organism operating photosynthesis at 50% capacity should not reserve 100% of the available light and waste half of it.

This creates a plausible evolutionary sequence:

```text
photosynthetic organism
    ->
photosynthetic feeder
    ->
specialized herbivore
```

An organism may retain both systems where flexibility is valuable, or lose photosynthesis where food provides a better energy return.

---

# Herbivory Without Destroying All Plants

Herbivores should not automatically consume entire plants.

Instead, grazing removes part of a plant's current-turn energy production.

## Grazing Limit

Initial proposal:

```text
maximum total grazing loss per plant per turn =
20% of that plant's photosynthetic production
```

This limit applies to all herbivores combined.

It is not 20% per herbivore.

Example:

```text
plant production:          25
maximum grazing loss:       5
energy left for plant:     20
```

Using an initial food conversion efficiency of 60%:

```text
energy received by grazers: 3
```

The exact 20% and 60% values require later balancing.

The important rule is structural:

- grazing removes energy rather than automatically killing the plant,
- a plant can still die if grazing creates an energy shortage,
- consumers receive less usable energy than the source organism loses.

---

# Feeding Capacity

Every animal has a maximum amount of food it can process per turn.

Feeding capacity should depend on:

- organism size,
- feeding-gene strength or expression,
- its share of energy-acquisition capacity.

Having both plant feeding and animal feeding does not double total feeding capacity.

An omnivore splits its available feeding capacity between food sources.

This prevents a single organism from consuming unlimited food simply because many prey organisms occupy the same hex.

---

# Food Search and Low-Density Protection

Animals should not automatically discover every suitable food organism in their hex.

Feeding success should decline strongly when suitable food becomes rare.

A possible initial function is:

```text
chanceOfFindingFood =
D^2 / (D^2 + K^2)
```

where:

```text
D = local density of suitable food
K = balancing constant
```

This creates the desired ecological feedback:

```text
plants decline
    ->
herbivores have more difficulty finding food
    ->
herbivores reproduce less, move away, or starve
    ->
grazing pressure falls
    ->
surviving plants can recover
```

Local extinction is still possible. The goal is not guaranteed equilibrium, but to avoid a default pattern where the first herbivore lineage simply consumes every producer and immediately collapses.

---

# Carnivory

Animal feeding creates a second consumer level.

For the initial version, a successful hunt requires:

1. a predator encounters suitable prey,
2. the prey is within an allowed size relationship,
3. capture succeeds.

A simple initial rule can allow solitary predators to kill only organisms smaller than themselves.

Capture probability should then depend partly on relative movement capability.

This produces useful evolutionary pressures:

- larger prey may become harder to kill,
- faster prey may escape more often,
- faster predators hunt more effectively,
- all these advantages require additional energy.

Unlike grazing, successful animal feeding kills the prey.

The prey's food value can be derived from existing variables such as:

- size / cell count,
- stored energy.

A separate biomass variable is not required.

The energy obtained from a prey organism must remain lower than the energy represented by constructing and maintaining that organism, so predation cannot create energy.

---

# Evolutionary Feeding Paths

The system should allow, but not force, paths such as:

```text
photosynthesis
    ->
photosynthesis + plant feeding
    ->
plant feeding
    ->
plant feeding + animal feeding
    ->
animal feeding
```

This corresponds approximately to:

```text
photosynthetic organism
    ->
mixotrophic feeder
    ->
herbivore
    ->
omnivore
    ->
carnivore
```

These are descriptive ecological roles, not explicit organism types.

Other combinations remain possible.

For example, a photosynthetic organism may also evolve animal feeding without ever becoming a conventional herbivore.

---

# Habitat Evolution Paths

Habitat adaptation evolves independently from feeding strategy.

A possible path is:

```text
aquatic
    ->
amphibious / coastal
    ->
terrestrial
    ->
dry-land adapted
```

Because habitat and feeding genes are independent, the simulation can produce:

- aquatic photosynthetic organisms,
- aquatic herbivores,
- aquatic carnivores,
- coastal amphibious organisms,
- terrestrial plants,
- terrestrial herbivores,
- terrestrial carnivores.

There is no separate land-animal or water-animal class.

---

# Initial Gene Set Summary

| Gene / trait | Primary role |
|---|---|
| photosynthesis | energy from light |
| size | body scale, upkeep, storage, competition, feeding and predation |
| trunk | improved land-light competition for larger organisms |
| temperature tolerance | adaptation to different temperature ranges |
| land adaptation | transition from water to wet and dry terrestrial environments |
| movement | food search, migration, pursuit and escape |
| plant feeding | grazing photosynthetic organisms |
| animal feeding | predation |

This is intentionally a very small starting set.

Genes for senses, armor, jaws, toxins, social behavior, specialized digestion, reproduction strategies, and similar features should be added only after the basic ecological system is working and producing meaningful evolutionary pressure.
