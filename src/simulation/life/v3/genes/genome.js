/** V3's representative species genome. All costs are experimental model choices. */
export const TRAITS = Object.freeze([
  ['size', 1, 10], ['photosynthesis', 0, 1], ['trunk', 0, 10],
  ['temperatureTolerance', -2, 2], ['landAdaptation', 0, 3], ['movement', 0, 4],
  ['plantFeeding', 0, 1], ['animalFeeding', 0, 1], ['poison', 0, 3], ['spines', 0, 3],
  ['detoxification', 0, 3], ['biteForce', 0, 3], ['skeleton', 0, 3], ['armor', 0, 3],
  ['armorType', 0, 3], ['flight', 0, 2], ['eyesight', 0, 3], ['echolocation', 0, 3],
  ['thermalSensing', 0, 3], ['sexualReproduction', 0, 1],
  ['elevationTolerance', 0, 4], ['depthTolerance', 0, 4],
].map(([key, min, max]) => Object.freeze({ key, min, max })));

export const GENE_RULES = Object.freeze({ mixedSystemPenalty: 0.08,
  additionalSystemCost: 0.06, additionalSystemConstructionCost: 0.30,
  photosyntheticGrazingCost: 0.16, photosyntheticGrazingConstructionCost: 0.30,
  movementPhotosynthesisPenalty: 0.06, flightPhotosynthesisPenalty: 0.06 });

const thermalRanges = [[-15, 5], [0, 15], [10, 25], [20, 35], [30, 45]];
const elevationRanges = [[0, 1200], [700, 2600], [1800, 4000], [3000, 5600], [4400, 8000]];
const depthRanges = [[0, 15], [10, 80], [50, 300], [200, 1400], [900, 6000]];
const structures = [
  { upkeep: 0, construction: 0, speed: 0, defense: 0, handling: 0, flight: 0.3 },
  { upkeep: 0.025, construction: 0.04, speed: 0.13, defense: 0.1, handling: 0.1, flight: 0.4 },
  { upkeep: 0.045, construction: 0.075, speed: 0.1, defense: 0.7, handling: 0.3, flight: 0.9 },
  { upkeep: 0.065, construction: 0.095, speed: 0.2, defense: 0.25, handling: 0.6, flight: 1 },
];
const coverings = [
  { upkeep: 0, construction: 0, protection: 1, drag: 0.16 },
  { upkeep: 0.016, construction: 0.035, protection: 1.45, drag: 0.26 },
  { upkeep: 0.022, construction: 0.03, protection: 1.3, drag: 0.14 },
  { upkeep: 0.012, construction: 0.024, protection: 1.12, drag: 0.1 },
];

export function founderGenome() {
  return Object.fromEntries(TRAITS.map(({ key }) => [key,
    key === 'size' ? 3 : key === 'photosynthesis' ? 1 : key === 'temperatureTolerance' ? null : 0]));
}

export function validateGenome(genome) {
  return !!genome && TRAITS.every(({ key, min, max }) =>
    (key === 'temperatureTolerance' && genome[key] === null)
    || (Number.isInteger(genome[key]) && genome[key] >= min && genome[key] <= max))
    && (!genome.trunk || genome.photosynthesis === 1);
}

export function genomeKey(genome) {
  return TRAITS.map(({ key }) => genome[key] === null ? '_' : genome[key]).join(',');
}

/** One locus, one reversible graph edge. Structural kinds are not a ladder. */
export function mutationOptions(genome) {
  return TRAITS.map(({ key, min, max }) => {
    const current = genome[key];
    const values = key === 'temperatureTolerance' && current === null ? [0]
      : ['skeleton', 'armorType'].includes(key) ? current === 0 ? [1, 2, 3] : [0]
        : [current - 1, current + 1,
          ...(key === 'temperatureTolerance' && current === 0 ? [null] : [])]
          .filter(value => value === null || value >= min && value <= max);
    return { key, values: values.filter(value => validateGenome({ ...genome, [key]: value })), weight: 1 };
  }).filter(({ values }) => values.length);
}

export function candidateMutations(genome) {
  return mutationOptions(genome).flatMap(({ key, values }) => values.map(value => ({
    key, from: genome[key], to: value, genome: { ...genome, [key]: value },
  })));
}

export function mutateGenome(genome, random) {
  const options = mutationOptions(genome);
  const option = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  if (!option) return { ...genome };
  return { ...genome, [option.key]: option.values[Math.min(option.values.length - 1,
    Math.floor(random() * option.values.length))] };
}

export function geneticDistance(a, b) {
  return TRAITS.reduce((distance, { key }) => {
    if (a[key] === b[key]) return distance;
    if (key === 'temperatureTolerance' && (a[key] === null || b[key] === null)) {
      return distance + 1 + Math.abs(a[key] ?? b[key]);
    }
    if (['skeleton', 'armorType'].includes(key)) return distance + (a[key] && b[key] ? 2 : 1);
    return distance + Math.abs(a[key] - b[key]);
  }, 0);
}

export function deriveGenome(g) {
  const cells = 1 + 3 * g.size * (g.size - 1);
  const structure = structures[g.skeleton];
  const covering = coverings[g.armorType];
  const systems = g.photosynthesis + g.plantFeeding + g.animalFeeding;
  const allocation = 1 / ((systems || 1) * (1 + GENE_RULES.mixedSystemPenalty * Math.max(0, systems - 1)));
  // Maintaining distinct acquisition machinery is paid even when one source
  // supplies no food. Photosynthetic grazing has the strongest incompatibility.
  const mixedCost = GENE_RULES.additionalSystemCost * Math.max(0, systems - 1)
    + GENE_RULES.photosyntheticGrazingCost * g.photosynthesis * g.plantFeeding;
  // A consumer can repurpose the investment released by losing photosynthesis
  // into basic locomotion. The gene must still evolve; higher levels stay paid.
  const paidMovement = Math.max(0, g.movement - Number(!g.photosynthesis && systems > 0));
  const thermalCost = g.temperatureTolerance === null ? 0 : 0.02 + 0.008 * Math.abs(g.temperatureTolerance);
  const traitCost = 0.025 * g.photosynthesis + thermalCost + 0.012 * g.landAdaptation
    + 0.015 * g.trunk + 0.016 * paidMovement ** 1.4 + 0.022 * g.plantFeeding + 0.038 * g.animalFeeding
    + 0.025 * g.poison ** 1.2 + 0.018 * g.spines + 0.02 * g.detoxification
    + 0.025 * g.biteForce ** 1.2 + structure.upkeep + covering.upkeep
    + 0.023 * g.armor ** 1.3 * covering.protection + 0.065 * g.flight ** 1.4
    + 0.006 * g.eyesight + 0.02 * g.echolocation + 0.015 * g.thermalSensing
    + 0.018 * g.sexualReproduction + 0.035 * g.elevationTolerance + 0.025 * g.depthTolerance + mixedCost;
  const construction = 1 + 0.08 * (g.size - 1) + 1.3 * traitCost
    + GENE_RULES.additionalSystemConstructionCost * Math.max(0, systems - 1)
    + GENE_RULES.photosyntheticGrazingConstructionCost * g.photosynthesis * g.plantFeeding
    + structure.construction + covering.construction + 0.035 * g.trunk
    + 0.035 * paidMovement + 0.035 * g.armor + 0.07 * g.flight;
  const flightEfficiency = g.movement ? g.flight * structure.flight
    / (1 + 0.12 * (g.size - 1) + covering.drag * g.armor + 0.15 * g.trunk) : 0;
  const speed = g.movement * (1 + structure.speed) * (1 + 0.2 * flightEfficiency)
    / (1 + 0.18 * g.trunk + covering.drag * g.armor + 0.05 * (g.size - 1));
  const senses = 0.24 * g.eyesight + 0.28 * g.echolocation + 0.2 * g.thermalSensing;
  return {
    cells, size: (g.size - 1) / 9,
    activeGenes: TRAITS.reduce((count, { key }) => count + Number(key !== 'size'
      && (key === 'temperatureTolerance' ? g[key] !== null : g[key] > 0)), 0),
    temperatureRange: [...(g.temperatureTolerance === null ? [15, 25] : thermalRanges[g.temperatureTolerance + 2])],
    elevationRange: [...elevationRanges[g.elevationTolerance]], depthRange: [...depthRanges[g.depthTolerance]],
    upkeep: cells * (0.42 + 0.016 * (g.size - 1) + traitCost),
    reproductionCost: cells * construction,
    photosynthesisShare: g.photosynthesis * allocation
      / (1 + GENE_RULES.movementPhotosynthesisPenalty * g.movement + GENE_RULES.flightPhotosynthesisPenalty * g.flight),
    grazingShare: g.plantFeeding * allocation, predationShare: g.animalFeeding * allocation,
    landCompetition: (1 + 0.12 * g.size * g.trunk) * (1 + 0.012 * g.eyesight),
    habitats: g.landAdaptation === 0 ? ['water'] : g.landAdaptation <= 2 ? ['water', 'land'] : ['land'],
    role: systems > 1 ? 'mixed' : g.photosynthesis ? 'producer' : g.plantFeeding ? 'grazer' : g.animalFeeding ? 'predator' : 'other',
    speed, senses, sensoryReach: 1 + senses, flightEfficiency,
    defense: 0.6 * g.armor * covering.protection + 0.42 * g.spines + structure.defense,
    armorProtection: g.armor * covering.protection, handling: 0.7 * g.biteForce + structure.handling,
    height: g.size * (1 + 0.12 * g.trunk), grazingEfficiency: 0.6, predationEfficiency: 0.6,
    sexual: !!g.sexualReproduction,
  };
}

export function describeGenome(genome) {
  return TRAITS.map(({ key, min, max }) => ({ key, min, max, value: genome[key],
    active: key === 'size' || (key === 'temperatureTolerance' ? genome[key] !== null : genome[key] > 0) }));
}
