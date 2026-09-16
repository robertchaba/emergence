/** The eight v1 traits; null temperature tolerance is distinct from expression 0. */
export const TRAITS = Object.freeze([
  { key: 'size', min: 1, max: 10 },
  { key: 'photosynthesis', min: 0, max: 1 },
  { key: 'trunk', min: 0, max: 10 },
  { key: 'temperatureTolerance', min: -2, max: 2 },
  { key: 'landAdaptation', min: 0, max: 3 },
  { key: 'movement', min: 0, max: 1 },
  { key: 'plantFeeding', min: 0, max: 1 },
  { key: 'animalFeeding', min: 0, max: 1 },
].map(Object.freeze));

export function founderGenome() {
  return { size: 3, photosynthesis: 1, trunk: 0, temperatureTolerance: null,
    landAdaptation: 0, movement: 0, plantFeeding: 0, animalFeeding: 0 };
}

export function genomeKey(genome) {
  return TRAITS.map(({ key }) => genome[key] === null ? '_' : genome[key]).join(',');
}

export function validateGenome(genome) {
  return TRAITS.every(({ key, min, max }) => key === 'temperatureTolerance' && genome[key] === null
    || Number.isInteger(genome[key]) && genome[key] >= min && genome[key] <= max)
    && (!genome.trunk || genome.photosynthesis === 1);
}

export function mutationOptions(genome) {
  return TRAITS.map(({ key, min, max }) => {
    const current = genome[key];
    let values;
    if (key === 'temperatureTolerance') {
      values = current === null ? [0]
        : [current - 1, current + 1, ...(current === 0 ? [null] : [])]
          .filter((value) => value === null || value >= min && value <= max);
    } else values = [current - 1, current + 1].filter((value) => value >= min && value <= max);
    values = values.filter((value) => validateGenome({ ...genome, [key]: value }));
    return { key, values };
  }).filter(({ values }) => values.length);
}

export function mutateGenome(genome, random) {
  const options = mutationOptions(genome);
  if (!options.length) return { ...genome };
  const option = options[Math.floor(random() * options.length)];
  return { ...genome, [option.key]: option.values[Math.floor(random() * option.values.length)] };
}

export function geneticDistance(a, b) {
  let distance = 0;
  for (const { key } of TRAITS) {
    if (key === 'temperatureTolerance' && (a[key] === null || b[key] === null)) {
      distance += a[key] === b[key] ? 0 : 1 + Math.abs(a[key] ?? b[key]);
    } else distance += Math.abs(a[key] - b[key]);
  }
  return distance;
}

export function deriveGenome(genome) {
  const cells = 1 + 3 * genome.size * (genome.size - 1);
  const systems = genome.photosynthesis + genome.plantFeeding + genome.animalFeeding;
  const activeGenes = TRAITS.filter(({ key }) => key !== 'size'
    && (key === 'temperatureTolerance' ? genome[key] !== null : genome[key] > 0)).length;
  const temperatureRange = genome.temperatureTolerance === null ? [18, 22]
    : [[9, 14], [13, 19], [16, 24], [21, 27], [26, 31]][genome.temperatureTolerance + 2];
  const role = systems > 1 ? 'mixed' : genome.photosynthesis ? 'producer'
    : genome.plantFeeding ? 'grazer' : genome.animalFeeding ? 'predator' : 'other';
  return {
    cells, activeGenes, temperatureRange, role, size: (genome.size - 1) / 9,
    upkeep: cells + activeGenes + Math.max(0, genome.landAdaptation - 1),
    reproductionCost: cells * (1 + 0.1 * (genome.size - 1)),
    photosynthesisShare: genome.photosynthesis / (systems || 1),
    grazingShare: genome.plantFeeding / (systems || 1),
    predationShare: genome.animalFeeding / (systems || 1),
    landCompetition: 1 + 0.05 * genome.size + 0.003 * genome.size ** 2 * genome.trunk,
    habitats: genome.landAdaptation === 0 ? ['water']
      : genome.landAdaptation === 1 ? ['water', 'land'] : ['land'],
  };
}

export function describeGenome(genome) {
  return TRAITS.map(({ key, min, max }) => ({ key, min, max, value: genome[key],
    active: key === 'size' || (key === 'temperatureTolerance' ? genome[key] !== null : genome[key] > 0) }));
}
