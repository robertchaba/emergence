/** V2 quantitative traits. Coefficients are experimental model parameters. */
export const TRAITS = Object.freeze([
  { key: 'size', min: 1, max: 10 },
  { key: 'photosynthesis', min: 0, max: 1 },
  { key: 'trunk', min: 0, max: 10 },
  { key: 'temperatureTolerance', min: -2, max: 2 },
  { key: 'landAdaptation', min: 0, max: 3 },
  { key: 'movement', min: 0, max: 4 },
  { key: 'plantFeeding', min: 0, max: 1 },
  { key: 'animalFeeding', min: 0, max: 1 },
  { key: 'poison', min: 0, max: 3 },
  { key: 'spines', min: 0, max: 3 },
  { key: 'detoxification', min: 0, max: 3 },
  { key: 'biteForce', min: 0, max: 3 },
  { key: 'skeleton', min: 0, max: 3 },
  { key: 'armor', min: 0, max: 3 },
  { key: 'armorType', min: 0, max: 3 },
  { key: 'flight', min: 0, max: 2 },
  { key: 'eyesight', min: 0, max: 3 },
  { key: 'echolocation', min: 0, max: 3 },
  { key: 'thermalSensing', min: 0, max: 3 },
  { key: 'sexualReproduction', min: 0, max: 1 },
].map(Object.freeze));

export const GENE_RULES = Object.freeze({
  mutationBaseline: 0.0016,
  mutationPressureMultiplier: 7,
  eyesightMutationWeight: 3,
  mixedSystemPenalty: 0.12,
  movementPhotosynthesisPenalty: 0.16,
  flightPhotosynthesisPenalty: 0.10,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const skeletonMaintenance = [0, 0.025, 0.06, 0.08];
const skeletonConstruction = [0, 0.04, 0.08, 0.10];
const skeletonSpeed = [0, 0.10, 0.12, 0.20];
const skeletonDefense = [0, 0.10, 0.80, 0.25];
const skeletonHandling = [0, 0.10, 0.30, 0.60];
const skeletonFlight = [0.25, 0.40, 1, 1];
const armorMaintenance = [0, 0.018, 0.024, 0.014];
const armorConstruction = [0, 0.040, 0.035, 0.025];
const armorProtection = [1, 1.45, 1.30, 1.12];
const armorDrag = [0.16, 0.25, 0.14, 0.10];

export function founderGenome() {
  return { size: 3, photosynthesis: 1, trunk: 0, temperatureTolerance: null,
    landAdaptation: 0, movement: 0, plantFeeding: 0, animalFeeding: 0,
    poison: 0, spines: 0, detoxification: 0, biteForce: 0, skeleton: 0,
    armor: 0, armorType: 0, flight: 0, eyesight: 0, echolocation: 0, thermalSensing: 0,
    sexualReproduction: 0 };
}

export function genomeKey(genome) {
  return TRAITS.map(({ key }) => genome[key] === null ? '_' : genome[key]).join(',');
}

export function validateGenome(genome) {
  return !!genome && TRAITS.every(({ key, min, max }) => key === 'temperatureTolerance' && genome[key] === null
    || Number.isInteger(genome[key]) && genome[key] >= min && genome[key] <= max)
    && (!genome.trunk || genome.photosynthesis === 1);
}

/** All changes are reversible, local and independent of the environment. */
export function mutationOptions(genome) {
  return TRAITS.map(({ key, min, max }) => {
    const current = genome[key];
    let values;
    if (key === 'temperatureTolerance') {
      values = current === null ? [0]
        : [current - 1, current + 1, ...(current === 0 ? [null] : [])]
          .filter((value) => value === null || value >= min && value <= max);
    } else if (key === 'skeleton' || key === 'armorType') {
      // Structural kinds are alternatives, not a ladder of superior forms.
      values = current === 0 ? [1, 2, 3] : [0];
    } else values = [current - 1, current + 1].filter((value) => value >= min && value <= max);
    values = values.filter((value) => validateGenome({ ...genome, [key]: value }));
    return { key, values, weight: key === 'eyesight' ? GENE_RULES.eyesightMutationWeight : 1 };
  }).filter(({ values }) => values.length);
}

export function mutateGenome(genome, random) {
  const options = mutationOptions(genome);
  if (!options.length) return { ...genome };
  let choice = random() * options.reduce((sum, option) => sum + option.weight, 0);
  let option = options.at(-1);
  for (const candidate of options) {
    choice -= candidate.weight;
    if (choice < 0) { option = candidate; break; }
  }
  return { ...genome, [option.key]: option.values[Math.floor(random() * option.values.length)] };
}

/** Pressure changes frequency, never the direction or usefulness of mutations. */
export function mutationProbability(pressure = 0) {
  const bounded = Number.isFinite(pressure) ? clamp(pressure, 0, 1) : 0;
  return GENE_RULES.mutationBaseline * (1 + GENE_RULES.mutationPressureMultiplier * bounded);
}

/** Linked photosynthesis/trunk inheritance retains prerequisites without repair. */
export function recombineGenome(a, b, random) {
  const child = {};
  const producerParent = random() < 0.5 ? a : b;
  for (const { key } of TRAITS) {
    child[key] = key === 'photosynthesis' || key === 'trunk' ? producerParent[key]
      : (random() < 0.5 ? a : b)[key];
  }
  return child;
}

export function geneticDistance(a, b) {
  let distance = 0;
  for (const { key } of TRAITS) {
    if (key === 'temperatureTolerance' && (a[key] === null || b[key] === null)) {
      distance += a[key] === b[key] ? 0 : 1 + Math.abs(a[key] ?? b[key]);
    } else if (key === 'skeleton' || key === 'armorType') {
      distance += a[key] === b[key] ? 0 : a[key] === 0 || b[key] === 0 ? 1 : 2;
    } else distance += Math.abs(a[key] - b[key]);
  }
  return distance;
}

export function deriveGenome(genome) {
  const g = genome;
  const cells = 1 + 3 * g.size * (g.size - 1);
  const systems = g.photosynthesis + g.plantFeeding + g.animalFeeding;
  const activeGenes = TRAITS.filter(({ key }) => key !== 'size'
    && (key === 'temperatureTolerance' ? g[key] !== null : g[key] > 0)).length;
  const temperatureRange = g.temperatureTolerance === null ? [18, 22]
    : [[9, 14], [13, 19], [16, 24], [21, 27], [26, 31]][g.temperatureTolerance + 2];
  const temperatureCost = g.temperatureTolerance === null ? 0 : 1 + 0.18 * Math.abs(g.temperatureTolerance);
  const traitMaintenance = 0.03 * g.photosynthesis + 0.018 * g.trunk * (0.8 + 0.07 * g.size)
    + 0.025 * temperatureCost + 0.01 * g.landAdaptation
    + 0.035 * g.movement ** 1.45 + 0.04 * g.plantFeeding + 0.055 * g.animalFeeding
    + 0.027 * g.poison ** 1.2 + 0.021 * g.spines + 0.026 * g.detoxification
    + 0.03 * g.biteForce ** 1.2 + skeletonMaintenance[g.skeleton]
    + 0.028 * g.armor ** 1.35 * armorProtection[g.armorType] + armorMaintenance[g.armorType]
    + 0.10 * g.flight ** 1.4 + 0.006 * g.eyesight ** 1.15 + 0.023 * g.echolocation ** 1.2
    + 0.018 * g.thermalSensing + 0.01 * g.sexualReproduction;
  const construction = 1 + 0.12 * (g.size - 1) + 0.055 * g.movement ** 1.4
    + 0.045 * g.trunk + 0.04 * g.armor * armorProtection[g.armorType] + armorConstruction[g.armorType]
    + 0.045 * g.poison + 0.035 * g.spines
    + 0.025 * g.detoxification + 0.04 * g.biteForce + skeletonConstruction[g.skeleton]
    + 0.14 * g.flight + 0.012 * g.eyesight + 0.04 * g.echolocation + 0.03 * g.thermalSensing
    + 0.08 * g.sexualReproduction + 0.03 * g.photosynthesis
    + 0.04 * g.plantFeeding + 0.05 * g.animalFeeding + 0.015 * g.landAdaptation + 0.01 * temperatureCost;
  const flightEfficiency = g.movement ? g.flight * skeletonFlight[g.skeleton]
    / (1 + 0.15 * (g.size - 1) + armorDrag[g.armorType] * g.armor + 0.14 * g.trunk) : 0;
  const speed = g.movement * (1 + skeletonSpeed[g.skeleton]) * (1 + 0.20 * flightEfficiency)
    / (1 + 0.22 * g.trunk + armorDrag[g.armorType] * g.armor + 0.06 * (g.size - 1));
  const senses = 0.23 * g.eyesight + 0.27 * g.echolocation + 0.20 * g.thermalSensing;
  const allocation = 1 / ((systems || 1) * (1 + GENE_RULES.mixedSystemPenalty * Math.max(0, systems - 1)));
  const photoEfficiency = 1 / (1 + GENE_RULES.movementPhotosynthesisPenalty * g.movement
    + GENE_RULES.flightPhotosynthesisPenalty * g.flight);
  const role = systems > 1 ? 'mixed' : g.photosynthesis ? 'producer'
    : g.plantFeeding ? 'grazer' : g.animalFeeding ? 'predator' : 'other';
  return {
    cells, activeGenes, temperatureRange, role, size: (g.size - 1) / 9,
    upkeep: cells * (1 + 0.04 * (g.size - 1) + traitMaintenance),
    reproductionCost: cells * construction,
    photosynthesisShare: g.photosynthesis * allocation * photoEfficiency,
    grazingShare: g.plantFeeding * allocation,
    predationShare: g.animalFeeding * allocation,
    landCompetition: (1 + 0.04 * g.size + 0.028 * g.size * g.trunk) * (1 + 0.008 * g.eyesight),
    habitats: g.landAdaptation === 0 ? ['water']
      : g.landAdaptation <= 2 ? ['water', 'land'] : ['land'],
    speed, senses, sensoryReach: 1 + senses,
    flightEfficiency,
    defense: 0.65 * g.armor * armorProtection[g.armorType] + 0.42 * g.spines + skeletonDefense[g.skeleton],
    armorProtection: g.armor * armorProtection[g.armorType],
    handling: 0.70 * g.biteForce + skeletonHandling[g.skeleton],
    height: g.size * (1 + 0.10 * g.trunk),
    grazingEfficiency: 0.60,
    predationEfficiency: 0.60,
    sexual: g.sexualReproduction > 0,
  };
}

export function describeGenome(genome) {
  return TRAITS.map(({ key, min, max }) => ({ key, min, max, value: genome[key],
    active: key === 'size' || (key === 'temperatureTolerance' ? genome[key] !== null : genome[key] > 0) }));
}
