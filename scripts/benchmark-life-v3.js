import { performance } from 'node:perf_hooks';
import { generateWorld } from '../src/simulation/world.js';
import { assignClimate } from '../src/simulation/climate.js';
import { createGrid } from '../src/simulation/grid.js';
import * as v2 from '../src/simulation/life/v2/model.js';
import * as v3 from '../src/simulation/life/v3/model.js';
const horizon = Number(process.argv[2] ?? 1440);
if (!Number.isSafeInteger(horizon) || horizon < 1) throw new RangeError('Supply a positive integer day horizon.');
// Same geography, starting site and completed day. Different biology makes this
// an end-to-end workload sample, not an equivalent-trajectory microbenchmark.
for (const seed of ['emergence', 'v3-compare-b']) {
  const world = generateWorld({ seed, size: 'small' });
  for (const habitat of ['land', 'water']) {
    const site = world.hexes.filter(hex => (hex.waterType === 'none') === (habitat === 'land')
      && !hex.permanentIce && hex.temperature >= 15 && hex.temperature <= 30)
      .sort((a, b) => Math.abs(a.latitude) - Math.abs(b.latitude) || a.id - b.id)[0];
    for (const [version, implementation] of [['v2', v2], ['v3', v3]]) {
      const life = implementation.createLifeModel(world);
      life.introduce(site.id);
      const started = performance.now();
      life.advanceTo(world.day + horizon);
      const elapsed = performance.now() - started;
      const saved = life.exportState();
      const snapshotStarted = performance.now();
      const observation = life.observe();
      const snapshotMilliseconds = performance.now() - snapshotStarted;
      process.stdout.write(JSON.stringify({ kind: 'world', version, seed, habitat, hexId: site.id,
        day: saved.day, milliseconds: Math.round(elapsed), snapshotMilliseconds: +snapshotMilliseconds.toFixed(2), species: observation.counts.species,
        organisms: observation.counts.organisms, occupiedHexes: observation.counts.occupiedHexes,
        records: (saved.populations ?? saved.cohorts).length,
        directions: saved.species.reduce((sum, species) => sum + (species.candidates?.length ?? 0), 0),
        bytes: JSON.stringify(saved).length }) + '\n');
    }
  }
}
// Fixed record count and one turn from fresh state, repeated for timing. Population
// magnitudes differ 1000-fold; no assertion imposes a wall-clock performance budget.
const width = 18;
const world = assignClimate({ width, height: 7, day: 0, seed: 'v3-scaling', version: 'fixture',
  hexes: createGrid(width, 7).map(hex => ({ ...hex, bedElevation: -100, waterType: 'sea',
    waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0 })) });
const base = v3.createLifeModel(world); base.introduce(width * 3);
for (const multiplier of [1, 1000]) {
  const saved = base.exportState();
  saved.populations = world.hexes.filter(hex => hex.row === 3).map(hex => ({ ...saved.populations[0],
    hexId: hex.id, count: 20 * multiplier }));
  const repeats = 300;
  let elapsed = 0;
  for (let iteration = 0; iteration < repeats + 20; iteration += 1) {
    const life = v3.restoreLifeModel(world, saved);
    const started = performance.now(); life.advanceTo(4);
    if (iteration >= 20) elapsed += performance.now() - started;
  }
  process.stdout.write(JSON.stringify({ kind: 'fixed-records', version: 'v3', multiplier,
    population: 20 * width * multiplier, records: width, repetitions: repeats,
    meanMilliseconds: Number((elapsed / repeats).toFixed(4)) }) + '\n');
}
