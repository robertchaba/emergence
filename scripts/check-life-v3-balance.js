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
for (let elapsed = Math.min(3600, horizon); ; elapsed = Math.min(elapsed + 3600, horizon)) {
  life.advanceTo(world.day + elapsed);
  const state = life.exportState();
  const ids = new Set(state.populations.map(row => row.speciesId));
  const living = state.species.filter(row => ids.has(row.id));
  const count = predicate => living.filter(row => predicate(row.genome)).length;
  process.stdout.write(`${JSON.stringify({ rules: state.rulesRevision, seed, size, habitat, hexId: site.id,
    elapsedDays: elapsed, species: living.length,
    animalFeeding: count(g => g.animalFeeding > 0),
    mixedFeeding: count(g => g.photosynthesis + g.plantFeeding + g.animalFeeding > 1),
    photosynthesisAndPlants: count(g => g.photosynthesis && g.plantFeeding),
    photosynthesisAndAnimals: count(g => g.photosynthesis && g.animalFeeding),
    plantsAndAnimals: count(g => g.plantFeeding && g.animalFeeding),
    purePredators: count(g => g.animalFeeding && !g.photosynthesis && !g.plantFeeding),
    pureGrazers: count(g => g.plantFeeding && !g.photosynthesis && !g.animalFeeding),
    mobile: count(g => g.movement > 0),
    organisms: state.populations.reduce((sum, row) => sum + row.count, 0),
    occupiedHexes: new Set(state.populations.map(row => row.hexId)).size,
    predationDeaths: state.stats.predationDeaths })}\n`);
  if (elapsed === horizon) break;
}
