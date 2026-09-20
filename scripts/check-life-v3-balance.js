import { generateWorld } from '../src/simulation/world.js';
import { createLifeModel } from '../src/simulation/life/v3/model.js';

// An observational panel, not a universal species-count assertion. Same sites
// as the version-comparison benchmark; no seeded consumers or forced branches.
const [horizonText = '14400', size = 'medium', seed = 'emergence', habitat = 'water'] = process.argv.slice(2);
const horizon = Number(horizonText);
if (!Number.isSafeInteger(horizon) || horizon < 1 || !['land', 'water'].includes(habitat)) {
  throw new RangeError('Usage: node scripts/check-life-v3-balance.js [days] [size] [seed] [land|water]');
}
const world = generateWorld({ seed, size });
const site = world.hexes.filter(hex => (hex.waterType === 'none') === (habitat === 'land')
  && !hex.permanentIce && hex.temperature >= 15 && hex.temperature <= 30)
  .sort((a, b) => Math.abs(a.latitude) - Math.abs(b.latitude) || a.id - b.id)[0];
if (!site) throw new Error('No suitable introduction site in this world.');
const life = createLifeModel(world);
life.introduce(site.id);
// The land-surface selector includes rivers; introduction uses their water pool.
const introductionHabitat = life.exportState().populations[0].habitat;
for (let elapsed = Math.min(3600, horizon); ; elapsed = Math.min(elapsed + 3600, horizon)) {
  life.advanceTo(world.day + elapsed);
  const state = life.exportState();
  const ids = new Set(state.populations.map(row => row.speciesId));
  const living = state.species.filter(row => ids.has(row.id));
  const count = predicate => living.filter(row => predicate(row.genome)).length;
  const sizesByHabitat = Object.fromEntries(['land', 'water'].map(habitat => [habitat,
    Object.fromEntries(['producer', 'grazer', 'predator'].map(role => [role,
      Array.from({ length: 10 }, (_, index) => living.filter(({ id, genome: g }) =>
        g.size === index + 1 && g.photosynthesis + g.plantFeeding + g.animalFeeding === 1
        && g[role === 'producer' ? 'photosynthesis' : role === 'grazer' ? 'plantFeeding' : 'animalFeeding']
        && state.populations.some(row => row.speciesId === id && row.habitat === habitat)).length),
    ])),
  ]));
  process.stdout.write(`${JSON.stringify({ rules: state.rulesRevision, seed, size, habitat, introductionHabitat, hexId: site.id,
    elapsedDays: elapsed, species: living.length,
    sizesByHabitat,
    animalFeeding: count(g => g.animalFeeding > 0),
    mixedFeeding: count(g => g.photosynthesis + g.plantFeeding + g.animalFeeding > 1),
    photosynthesisAndPlants: count(g => g.photosynthesis && g.plantFeeding),
    photosynthesisAndAnimals: count(g => g.photosynthesis && g.animalFeeding),
    plantsAndAnimals: count(g => g.plantFeeding && g.animalFeeding),
    purePredators: count(g => g.animalFeeding && !g.photosynthesis && !g.plantFeeding),
    pureGrazers: count(g => g.plantFeeding && !g.photosynthesis && !g.animalFeeding),
    mobile: count(g => g.movement > 0),
    mobileGrazers: count(g => g.plantFeeding && !g.photosynthesis && !g.animalFeeding && g.movement > 0),
    mobilePredators: count(g => g.animalFeeding && !g.photosynthesis && !g.plantFeeding && g.movement > 0),
    organisms: state.populations.reduce((sum, row) => sum + row.count, 0),
    occupiedHexes: new Set(state.populations.map(row => row.hexId)).size,
    occupiedLandHexes: new Set(state.populations.filter(row => row.habitat === 'land').map(row => row.hexId)).size,
    predatorHexes: new Set(state.populations.filter(row => living.some(species => species.id === row.speciesId
      && species.genome.animalFeeding && !species.genome.photosynthesis && !species.genome.plantFeeding))
      .map(row => row.hexId)).size,
    predationDeaths: state.stats.predationDeaths })}\n`);
  if (elapsed === horizon) break;
}
