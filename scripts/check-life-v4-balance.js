import { generateWorld } from '../src/simulation/world.js';

// Observational paired panel, never a species-count quota. Both versions use the
// same explicit biological seed; their different genomes still change draw use.
const [daysText = '15000', size = 'medium', seed = 'emergence', siteChoice = 'water',
  version = 'v4', lifeSeed = `${seed}:life-v3`, intervalText = '3600'] = process.argv.slice(2);
const days = Number(daysText);
const interval = Number(intervalText);
if (!Number.isSafeInteger(days) || days < 1 || !Number.isSafeInteger(interval) || interval < 1
  || !['v3', 'v4'].includes(version)
  || !['water', 'land', 'dry'].includes(siteChoice) && !/^\d+$/.test(siteChoice)) {
  throw new RangeError('Usage: node scripts/check-life-v4-balance.js [days] [size] [world-seed] [water|land|dry|hex-id] [v4|v3] [life-seed] [sample-days]');
}
const { createLifeModel } = await import(`../src/simulation/life/${version}/model.js`);
const { TRAITS } = await import(`../src/simulation/life/${version}/genes/genome.js`);
const { ECOLOGY_RULES } = await import(`../src/simulation/life/${version}/ecology.js`);
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

for (let elapsed = Math.min(interval, days); ; elapsed = Math.min(elapsed + interval, days)) {
  life.advanceTo(world.day + elapsed);
  const state = life.exportState();
  const totals = new Map();
  for (const row of state.populations) totals.set(row.speciesId, (totals.get(row.speciesId) ?? 0) + row.count);
  const living = state.species.filter(row => totals.has(row.id));
  const organisms = state.populations.reduce((sum, row) => sum + row.count, 0);
  const count = predicate => living.filter(record => predicate(record.genome)).length;
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
    predationDeaths: state.stats.predationDeaths, sexualBirths: state.stats.sexualBirths,
    phenotypeSpecies, sizesByHabitat })}\n`);
  if (elapsed === days) break;
}
