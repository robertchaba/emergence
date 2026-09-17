import assert from 'node:assert/strict';
import { generateWorld } from '../src/simulation/world.js';
import { createLifeModel } from '../src/simulation/life/v2/model.js';

// A reproducible exploratory panel, not a promise for every seed or introduction.
const full = process.argv.includes('--full');
const land = process.argv.includes('--land');
const seeds = process.argv.slice(2).filter(argument => !['--full', '--land'].includes(argument));
for (const seed of seeds.length ? seeds : ['emergence', 'v2-panel-1', 'v2-panel-2', 'v2-panel-3', 'v2-panel-4', 'v2-panel-5']) {
  const world = generateWorld({ seed, size: 'small' });
  const site = world.hexes.filter(hex => !hex.permanentIce && (land ? hex.waterType === 'none' && !hex.runoff && hex.bedElevation < 1500 : hex.waterType !== 'none')
    && hex.temperature >= 18 && hex.temperature <= 27).sort((a, b) => Math.abs(a.temperature - 22) - Math.abs(b.temperature - 22) || a.id - b.id)[0];
  const model = createLifeModel(world);
  model.introduce(site.id);
  const start = performance.now();
  let firstBranch = null;
  for (let day = 180; day <= 5400; day += 180) {
    model.advanceTo(day);
    const state = model.exportState();
    if (firstBranch === null && state.species.length > 1) firstBranch = state.species[1].originDay;
    assert.equal(state.cohorts.reduce((sum, cohort) => sum + cohort.count, 0), 20 + state.stats.births - state.stats.deaths);
    assert.equal(state.stats.reproductionAttempts, state.stats.births + state.stats.failedEstablishments);
    if (process.env.V2_PROGRESS) console.error(JSON.stringify({ seed, day, firstBranch, ...model.observe().counts }));
    if (!full && firstBranch !== null && day >= firstBranch + 360) break;
  }
  const observation = model.observe();
  console.log(JSON.stringify({ seed, habitat: land ? 'land' : 'water', site: site.id, firstBranchDay: firstBranch,
    firstBranchYear: firstBranch === null ? null : +(firstBranch / 360).toFixed(2),
    completedDay: observation.day, ...observation.counts, ...observation.stats,
    milliseconds: Math.round(performance.now() - start) }));
}
