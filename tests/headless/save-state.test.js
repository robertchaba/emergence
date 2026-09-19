import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, setDay } from '../../src/simulation/world.js';
import { createLifeModel } from '../../src/simulation/life/v3/model.js';
import { createSave, restoreSave } from '../../src/ui/save-state.js';

const world = setDay(generateWorld({ seed: 'save-continuation', size: 'small',
  geography: 0.27, landFraction: 0.371, waterAbundance: 0.63 }), 1);
const view = { camera: { zoom: 4, x: -82, y: 134 }, layer: 'temperature', pinnedId: 200, speed: 7 };
const roundTrip = value => JSON.parse(JSON.stringify(value));

test('save files restore physical conditions, complete life state and deterministic continuation', () => {
  const model = createLifeModel(world);
  const site = world.hexes.find(hex => hex.waterType === 'none' && !hex.permanentIce && hex.temperature > 15);
  model.introduce(site.id);
  model.advanceTo(138);
  const checkpoint = model.exportState();
  const restored = restoreSave(roundTrip(createSave(world, checkpoint, view)));
  assert.deepEqual(restored.world, setDay(world, 138));
  assert.deepEqual(restored.view, view);
  assert.deepEqual(restored.model.exportState(), checkpoint);
  assert.deepEqual(restored.observation, model.observe());
  model.advanceTo(360);
  restored.model.advanceTo(360);
  assert.deepEqual(restored.model.exportState(), model.exportState());
});

test('saves preserve empty, extinct and explicitly restarted worlds without seeding life', () => {
  const model = createLifeModel(world);
  for (const stage of ['empty', 'extinct', 'restarted']) {
    if (stage === 'extinct') { model.introduce(0); model.advanceTo(1001); }
    if (stage === 'restarted') model.introduce(200);
    const saved = createSave(world, model.exportState(), view);
    const restored = restoreSave(roundTrip(saved));
    assert.deepEqual(restored.model.exportState(), model.exportState());
    assert.deepEqual(restored.observation, model.observe());
    if (stage === 'empty') assert.equal(restored.observation.status, 'not-introduced');
    if (stage === 'extinct') assert.equal(restored.observation.status, 'extinct');
    if (stage === 'restarted') assert.equal(restored.observation.attempt, 2);
  }
});

test('malformed and incompatible saves fail without modifying the original model', () => {
  const model = createLifeModel(world);
  model.introduce(200);
  const original = roundTrip(createSave(world, model.exportState(), view));
  const mutations = [
    saved => { saved.format = 'emergence-save-99'; },
    saved => { saved.generatorVersion = 'physical-world-0'; },
    saved => { saved.weatherVersion = 'future-weather'; },
    saved => { saved.settings.seed = 'different-world'; },
    saved => { delete saved.settings.geography; },
    saved => { saved.settings.size = '__proto__'; },
    saved => { saved.view.camera.zoom = Infinity; },
    saved => { saved.view.pinnedId = world.hexes.length; },
    saved => { saved.view.speed = 11; },
    saved => { saved.life.rulesRevision = 'v3-populations-2'; },
    saved => { delete saved.life.randomState; },
    saved => { saved.life.randomState = [0, 0, 0, 0]; },
    saved => { delete saved.life.stats.births; },
    saved => { saved.life.nextSpecies = null; },
    saved => { saved.life.history = {}; },
    saved => { saved.life.introduced = 'true'; },
    saved => { saved.life.species[0].genomeRevision = null; },
    saved => { saved.life.populations[0].hexId = '200'; },
    saved => { saved.life.populations[0].count = -1; },
  ];
  for (const mutate of mutations) {
    const saved = roundTrip(original);
    mutate(saved);
    assert.throws(() => restoreSave(saved));
    assert.deepEqual(model.exportState(), original.life);
  }
});
