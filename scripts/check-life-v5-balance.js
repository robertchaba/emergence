import { generateWorld } from '../src/simulation/world.js';
import { climateAt } from '../src/simulation/climate.js';

// Observational paired panel, never a species-count quota. Both versions use the
// same explicit biological seed; their different genomes still change draw use.
const [daysText = '15000', size = 'medium', seed = 'emergence', siteChoice = 'water',
  version = 'v5', lifeSeed = `${seed}:life-v5`, intervalText = '3600'] = process.argv.slice(2);
const days = Number(daysText);
const interval = Number(intervalText);
if (!Number.isSafeInteger(days) || days < 1 || !Number.isSafeInteger(interval) || interval < 1
  || !['v4', 'v5'].includes(version)
  || !['water', 'land', 'dry'].includes(siteChoice) && !/^\d+$/.test(siteChoice)) {
  throw new RangeError('Usage: node scripts/check-life-v5-balance.js [days] [size] [world-seed] [water|land|dry|hex-id] [v5|v4] [life-seed] [sample-days]');
}
const { createLifeModel } = await import(`../src/simulation/life/${version}/model.js`);
const { TRAITS, deriveGenome } = await import(`../src/simulation/life/${version}/genes/genome.js`);
const { ECOLOGY_RULES, evaluateCommunity } = await import(`../src/simulation/life/${version}/ecology.js`);
const world = generateWorld({ seed, size });
const site = /^\d+$/.test(siteChoice) ? world.hexes.find(hex => hex.id === Number(siteChoice))
  : world.hexes.filter(hex => !hex.permanentIce && hex.temperature >= 15 && hex.temperature <= 30
    && (siteChoice === 'water' ? hex.waterType !== 'none' : hex.waterType === 'none')
    && (siteChoice !== 'dry' || !hex.runoff))
    .sort((a, b) => Math.abs(a.latitude) - Math.abs(b.latitude) || a.id - b.id)[0];
if (!site) throw new Error('No matching introduction site in this world.');
const life = createLifeModel(world, { seed: lifeSeed });
life.introduce(site.id);
const introductionHabitat = life.exportState().populations[0].habitat;

function firstExtinctionCrossover(species) {
  const events = new Map();
  const eventAt = day => {
    if (!events.has(day)) events.set(day, { origins: 0, extinctions: 0 });
    return events.get(day);
  };
  for (const record of species) {
    eventAt(record.originDay).origins += 1;
    if (record.extinctDay !== null) eventAt(record.extinctDay).extinctions += 1;
  }
  let living = 0; let extinct = 0;
  for (const [day, event] of [...events].sort((a, b) => a[0] - b[0])) {
    living += event.origins - event.extinctions;
    extinct += event.extinctions;
    if (extinct > living) return day - world.day;
  }
  return null;
}

// Re-evaluate the completed-day census and climate without advancing life or
// consuming randomness. These are current allocated food/expected prey removals
// per biological turn, not accumulated intake or realized integer deaths.
function currentPredation(state) {
  const species = new Map(state.species.map(record => [record.id, record]));
  const communities = new Map();
  for (const row of state.populations) {
    const key = `${row.hexId}|${row.habitat}`;
    if (!communities.has(key)) communities.set(key, []);
    communities.get(key).push(row);
  }
  let foodEnergyPerTurn = 0;
  let expectedPreyRemovalsPerTurn = 0;
  const huntedHexes = new Set();
  for (const residents of communities.values()) {
    const { hexId, habitat } = residents[0];
    const physical = world.hexes[hexId];
    const hex = { ...physical, ...climateAt(world, physical, state.day) };
    const scores = evaluateCommunity(hex, habitat, residents.map(row => ({
      speciesId: row.speciesId, population: row.count, habitat,
      genome: species.get(row.speciesId).genome,
    })));
    scores.forEach((score, index) => {
      const population = residents[index].count;
      foodEnergyPerTurn += population * score.predationFood;
      expectedPreyRemovalsPerTurn += population * score.predationLoss;
      if (score.predationFood > 0) huntedHexes.add(hexId);
    });
  }
  return { diagnostic: 'completed-day-expected-allocation-per-biological-turn',
    foodEnergyPerTurn, expectedPreyRemovalsPerTurn, huntedHexes: huntedHexes.size };
}

for (let elapsed = Math.min(interval, days); ; elapsed = Math.min(elapsed + interval, days)) {
  life.advanceTo(world.day + elapsed);
  const state = life.exportState();
  const totals = new Map();
  for (const row of state.populations) totals.set(row.speciesId, (totals.get(row.speciesId) ?? 0) + row.count);
  const living = state.species.filter(row => totals.has(row.id));
  const organisms = state.populations.reduce((sum, row) => sum + row.count, 0);
  const count = predicate => living.filter(record => predicate(record.genome)).length;
  const animalFeeders = living.filter(record => record.genome.animalFeeding > 0);
  const animalFeedingPopulation = animalFeeders.reduce((sum, record) => sum + totals.get(record.id), 0);
  const animalFeedingBiomass = animalFeeders.reduce((sum, record) =>
    sum + deriveGenome(record.genome).cells * totals.get(record.id), 0);
  const aquaticAnimalBiomassBySize = Array.from({ length: 10 }, (_, index) =>
    animalFeeders.filter(record => record.genome.size === index + 1).reduce((sum, record) =>
      sum + deriveGenome(record.genome).cells * state.populations
        .filter(row => row.speciesId === record.id && row.habitat === 'water')
        .reduce((population, row) => population + row.count, 0), 0));
  const sexualOrganisms = living.filter(record => record.genome.sexualReproduction)
    .reduce((sum, record) => sum + totals.get(record.id), 0);
  const pure = (genome, role) => genome.photosynthesis + genome.plantFeeding + genome.animalFeeding === 1
    && genome[role === 'producer' ? 'photosynthesis' : role === 'grazer' ? 'plantFeeding' : 'animalFeeding'];
  const phenotypeSpecies = Object.fromEntries(TRAITS.map(({ key }) => [key,
    count(genome => key === 'temperatureTolerance' ? genome[key] !== null : genome[key] > 0)]));
  const sizesByHabitat = Object.fromEntries(['land', 'water'].map(habitat => [habitat,
    Object.fromEntries(['producer', 'grazer', 'predator'].map(role => [role,
      Array.from({ length: 10 }, (_, index) => living.filter(({ id, genome }) =>
        genome.size === index + 1 && pure(genome, role)
        && state.populations.some(row => row.speciesId === id && row.habitat === habitat)).length),
    ])),
  ]));
  const grazerBiomassBySize = Object.fromEntries(['land', 'water'].map(habitat => [habitat,
    Array.from({ length: 10 }, (_, index) => living.filter(record => record.genome.size === index + 1
      && pure(record.genome, 'grazer')).reduce((sum, record) => sum + deriveGenome(record.genome).cells
        * state.populations.filter(row => row.speciesId === record.id && row.habitat === habitat)
          .reduce((population, row) => population + row.count, 0), 0)),
  ]));
  process.stdout.write(`${JSON.stringify({ version, rules: state.rulesRevision,
    competitionExponent: ECOLOGY_RULES.competitionExponent ?? 1, seed, lifeSeed, size,
    siteChoice, hexId: site.id, introductionHabitat, elapsedDays: elapsed, organisms,
    species: living.length, extinctSpecies: state.species.length - living.length,
    firstExtinctExceedsLivingDay: firstExtinctionCrossover(state.species),
    occupiedHexes: new Set(state.populations.map(row => row.hexId)).size,
    occupiedLandHexes: new Set(state.populations.filter(row => row.habitat === 'land').map(row => row.hexId)).size,
    sexualSpecies: count(genome => genome.sexualReproduction > 0), sexualOrganisms,
    sexualPopulationShare: organisms ? sexualOrganisms / organisms : 0,
    sexualSpeciesByRole: Object.fromEntries(['producer', 'grazer', 'predator'].map(role =>
      [role, count(genome => pure(genome, role) && genome.sexualReproduction)])),
    pureGrazers: count(genome => pure(genome, 'grazer')),
    purePredators: count(genome => pure(genome, 'predator')),
    mixedFeeding: count(genome => genome.photosynthesis + genome.plantFeeding + genome.animalFeeding > 1),
    animalFeedingSpecies: animalFeeders.length, animalFeedingPopulation, animalFeedingBiomass,
    aquaticAnimalBiomassBySize, currentPredation: currentPredation(state),
    // Cumulative model counter floors each local expectation, undercounting
    // fractional removals; use currentPredation to inspect present food uptake.
    predationDeaths: state.stats.predationDeaths, sexualBirths: state.stats.sexualBirths,
    phenotypeSpecies, sizesByHabitat, grazerBiomassBySize })}\n`);
  if (elapsed === days) break;
}
