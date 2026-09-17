import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { generateWorld } from '../../src/simulation/world.js';
import { classify } from '../../src/simulation/life/v1/classification.js';
import { founderGenome } from '../../src/simulation/life/v1/genes/genome.js';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v1/model.js';

function fixture() {
  return assignClimate({ width: 3, height: 7, day: 0, seed: 'life-fixture', version: 'fixture',
    hexes: createGrid(3, 7).map((hex) => ({ ...hex, bedElevation: -100,
      waterType: 'sea', waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0 })) });
}

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

function seed(world, settings) {
  const model = createLifeModel(world, settings);
  for (const hex of world.hexes) if (model.introduce(hex.id).ok) return model;
  throw new Error('No suitable fixture habitat.');
}

function reconcile(snapshot) {
  assert.equal(snapshot.countQuality, 'exact');
  assert.equal(snapshot.counts.organisms, snapshot.hexes.reduce((sum, hex) => sum + hex.population, 0));
  assert.equal(snapshot.counts.organisms, snapshot.species.reduce((sum, species) => sum + species.population, 0));
  assert.equal(snapshot.counts.species, snapshot.species.length);
  assert.equal(snapshot.counts.occupiedHexes, snapshot.hexes.length);
  for (const hex of snapshot.hexes) {
    assert.equal(hex.population, hex.species.reduce((sum, species) => sum + species.population, 0));
    assert.equal(hex.population, hex.display.reduce((sum, row) => sum + row.population, 0));
    assert.equal(hex.speciesCount, hex.species.length);
    assert.ok(Number.isSafeInteger(hex.population) && hex.population > 0);
    for (const species of hex.species) {
      assert.equal(species.population, snapshot.species.find((row) => row.id === species.id)
        .locations.find((row) => row.hexId === hex.hexId).population);
    }
  }
  for (const species of snapshot.species) {
    assert.equal(species.population, species.locations.reduce((sum, row) => sum + row.population, 0));
    assert.equal(species.population, species.variants.reduce((sum, row) => sum + row.population, 0));
    for (const variant of species.variants) {
      assert.equal(variant.population, variant.locations.reduce((sum, row) => sum + row.population, 0));
    }
    for (const trait of species.traits) for (const expression of trait.expressions) {
      assert.equal(expression.population, expression.locations.reduce((sum, row) => sum + row.population, 0));
      for (const location of expression.locations) {
        const carriers = species.variants.filter(variant => variant.traits.some(value => value.key === trait.key && value.value === expression.value && value.active));
        assert.equal(location.population, carriers.reduce((sum, variant) => sum + (variant.locations.find(row => row.hexId === location.hexId)?.population ?? 0), 0));
      }
    }
  }
}

test('biology takes three turns per ten physical days, retaining fractional credit through checkpoints', () => {
  const world = freeze(fixture());
  const model = seed(world);
  const initial = model.exportState();
  model.advanceTo(3);
  assert.equal(model.observe().day, 3);
  assert.equal(model.observe().biologicalTurns, 0);
  assert.equal(model.exportState().turnCredit, 9);
  assert.deepEqual(model.exportState().cohorts, initial.cohorts);
  assert.deepEqual(model.exportState().randomState, initial.randomState);
  const resumed = restoreLifeModel(world, model.exportState());
  for (const [day, turns, credit] of [[4, 1, 2], [6, 1, 8], [7, 2, 1], [10, 3, 0], [100, 30, 0]]) {
    model.advanceTo(day); resumed.advanceTo(day);
    assert.equal(model.observe().day, day);
    assert.equal(model.observe().biologicalTurns, turns);
    assert.equal(model.exportState().turnCredit, credit);
    assert.deepEqual(resumed.exportState(), model.exportState());
  }
  const delayed = createLifeModel(world);
  delayed.advanceTo(23);
  assert.equal(delayed.introduce(6).ok, true);
  delayed.advanceTo(26);
  assert.equal(delayed.observe().biologicalTurns, 0, 'introduction starts its own cadence');
  delayed.advanceTo(27);
  assert.equal(delayed.observe().biologicalTurns, 1);
  const invalid = model.exportState();
  invalid.turnCredit = 10;
  assert.throws(() => restoreLifeModel(world, invalid), /biological clock/);
  invalid.rulesRevision = 'v1-cohorts-1';
  assert.throws(() => restoreLifeModel(world, invalid), /Incompatible/);
});

test('v1 introduction is explicit, validates habitat, and rejected commands are atomic', () => {
  const world = freeze(fixture());
  const model = createLifeModel(world);
  const before = model.exportState();
  assert.equal(model.observe().status, 'not-introduced');
  assert.equal(model.introduce(-1).reason, 'unknown-hex');
  assert.equal(model.introduce(0).reason, 'permanent-ice');
  assert.deepEqual(model.exportState(), before);
  assert.equal(model.introduce(6, { population: 999 }).ok, true);
  assert.equal(model.observe().counts.organisms, 20);
  const introduced = model.exportState();
  assert.equal(model.introduce(7).reason, 'already-introduced');
  assert.deepEqual(model.exportState(), introduced);
  const dry = fixture();
  dry.hexes[6] = { ...dry.hexes[6], waterType: 'none', bedElevation: 10, waterLevel: null };
  const terrestrial = createLifeModel(dry);
  assert.equal(terrestrial.introduce(6).ok, true);
  assert.equal(terrestrial.exportState().cohorts[0].habitat, 'land');
  assert.ok(terrestrial.exportState().genomes[0].genome.landAdaptation > 0);
  assert.throws(() => model.inspectHex(10000), RangeError);
  assert.throws(() => model.inspectSpecies('invented-species'), RangeError);
  assert.deepEqual(model.inspectHex(0).species, []);
  const delayed = createLifeModel(world);
  delayed.advanceTo(12);
  assert.equal(delayed.introduce(6).ok, true);
  assert.equal(delayed.observe().startDay, 12);
});

test('daily advancement preserves geography, exact observations and newborn activation', () => {
  const world = freeze(fixture());
  const physicalBefore = JSON.stringify(world);
  const model = seed(world);
  model.advanceTo(4);
  assert.equal(model.observe().stats.reproductionAttempts, 20);
  assert.ok(model.observe().stats.births <= 20, 'newborns cannot reproduce on their birthday');
  const snapshot = model.observe();
  const detached = JSON.stringify(snapshot);
  const queriedState = model.exportState();
  snapshot.species[0].variants[0].traits[0].value = 999;
  assert.notEqual(model.observe().species[0].variants[0].traits[0].value, 999);
  model.inspectHex(6); model.inspectSpecies(snapshot.species[0].id); model.observe();
  assert.deepEqual(model.exportState(), queriedState, 'queries consume no random numbers');
  const stable = model.observe();
  model.advanceTo(70);
  reconcile(model.observe());
  assert.equal(JSON.stringify(stable), detached);
  assert.equal(JSON.stringify(world), physicalBefore);
  assert.equal(model.observe().day, 70);
  assert.throws(() => model.advanceTo(69), RangeError);
  assert.throws(() => model.advanceTo(70.5), RangeError);
  assert.equal(model.observe().counts.organisms,
    20 + model.observe().stats.births - model.observe().stats.deaths);
});

test('same commands replay across pacing, query frequency and complete checkpoint continuation', () => {
  const world = generateWorld({ seed: 'replay-life', size: 'small' });
  for (const energyQuantum of [0, 1 / 64]) {
    const uninterrupted = seed(world, { energyQuantum });
    const stepped = seed(world, { energyQuantum });
    uninterrupted.advanceTo(180);
    for (let day = 1; day <= 180; day += 1) { stepped.advanceTo(day); stepped.observe(); }
    assert.deepEqual(stepped.exportState(), uninterrupted.exportState());
    const checkpointed = seed(world, { energyQuantum });
    checkpointed.advanceTo(71);
    const checkpoint = JSON.parse(JSON.stringify(checkpointed.exportState()));
    const resumed = restoreLifeModel(world, checkpoint);
    resumed.advanceTo(180);
    assert.deepEqual(resumed.exportState(), uninterrupted.exportState());
    reconcile(resumed.observe());
  }
});

test('stored energies are individually bounded and binning never removes a living rare genotype', () => {
  const world = fixture();
  const model = seed(world);
  const checkpoint = model.exportState();
  checkpoint.genomes.push({ id: 'variant-2', genome: { ...founderGenome(), temperatureTolerance: 0 },
    establishedOrder: 2, parentGenomeId: 'variant-1', originDay: 0 });
  checkpoint.nextGenome = 3; checkpoint.nextEstablished = 3;
  checkpoint.cohorts.push({ ...checkpoint.cohorts[0], genomeId: 'variant-2', count: 1, energy: 19 });
  const rare = restoreLifeModel(world, checkpoint);
  assert.equal(rare.observe().counts.organisms, 21);
  assert.equal(rare.observe().counts.variants, 2);
  rare.advanceTo(4);
  assert.ok(rare.observe().species[0].variants.some((variant) => variant.id === 'variant-2'));
  for (const cohort of rare.exportState().cohorts) {
    assert.ok(cohort.energy >= 0 && cohort.energy <= 19);
    assert.equal(cohort.energy * 64, Math.round(cohort.energy * 64));
    assert.ok(Number.isSafeInteger(cohort.count));
  }
  assert.equal(rare.observe().approximation.mode, 'energy-bins');
});

test('loss of all energy systems permits extinction, with historical identity and no automatic reseeding', () => {
  const world = fixture();
  const checkpoint = seed(world).exportState();
  checkpoint.genomes[0].genome.photosynthesis = 0;
  checkpoint.cohorts[0].energy = 0;
  const model = restoreLifeModel(world, checkpoint);
  model.advanceTo(4);
  assert.equal(model.observe().status, 'extinct');
  assert.deepEqual(model.observe().counts, { organisms: 0, species: 0, extinctSpecies: 1, occupiedHexes: 0, variants: 0 });
  assert.equal(model.observe().stats.deaths, 20);
  const history = model.observe().extinctSpecies[0];
  assert.equal(history.population, 0);
  assert.equal(model.inspectSpecies(history.id).extinctDay, 4);
  model.advanceTo(5);
  assert.equal(model.observe().status, 'extinct');
  assert.equal(model.observe().day, 5);
  const extinct = model.exportState();
  assert.equal(model.introduce(0).reason, 'permanent-ice');
  assert.deepEqual(model.exportState(), extinct, 'rejected restart is atomic');
  assert.equal(model.introduce(6).ok, true);
  assert.equal(model.observe().day, 5);
  assert.equal(model.observe().startDay, 5);
  assert.equal(model.observe().revision, 1);
  assert.notEqual(model.observe().runId, extinct.runId);
  assert.equal(model.observe().stats.deaths, 0);
  assert.equal(model.observe().previousAttempts[0].stats.deaths, 20);
  assert.equal(model.observe().previousAttempts[0].species[0].extinctDay, 4);
  assert.equal(model.observe().counts.organisms, 20);
  const continued = restoreLifeModel(world, model.exportState());
  model.advanceTo(20); continued.advanceTo(20);
  assert.deepEqual(model.exportState(), continued.exportState());
});

test('founding plants select local moisture and temperature traits only at introduction', () => {
  const world = fixture();
  // A northern highland is cool enough to require cold tolerance, while the
  // equivalent coastal hex's dry land surface requires a land gene.
  world.hexes[6] = { ...world.hexes[6], waterType: 'none', bedElevation: 1700,
    waterLevel: null, distanceToWater: 0 };
  assignClimate(world, 0);
  const model = createLifeModel(world);
  assert.equal(model.introduce(6).ok, true);
  const genome = model.exportState().genomes[0].genome;
  assert.equal(genome.photosynthesis, 1);
  assert.equal(genome.movement + genome.plantFeeding + genome.animalFeeding + genome.trunk, 0);
  assert.equal(genome.temperatureTolerance, -2);
  assert.equal(genome.landAdaptation, 2);
  const checkpoint = model.exportState();
  // Prevent births so any genome rewrite would be an unauthorized adaptation.
  checkpoint.cohorts[0].count = 1000;
  checkpoint.cohorts[0].energy = 0;
  const crowded = restoreLifeModel(world, checkpoint);
  crowded.advanceTo(5);
  assert.deepEqual(crowded.exportState().genomes[0].genome, genome);
  const ridge = fixture();
  ridge.hexes[6] = { ...ridge.hexes[6], waterType: 'none', bedElevation: 3500, waterLevel: null };
  assert.equal(createLifeModel(ridge).introduce(6).reason, 'unsuitable-habitat');
});

test('predation is habitat-local, consumes each prey once and respects smaller-animal eligibility', () => {
  const world = fixture();
  const checkpoint = seed(world).exportState();
  checkpoint.genomes = [
    { id: 'hunter', genome: { ...founderGenome(), size: 4, photosynthesis: 0, animalFeeding: 1 }, establishedOrder: 1 },
    { id: 'prey', genome: { ...founderGenome(), size: 1, photosynthesis: 0, plantFeeding: 1 }, establishedOrder: 2 },
  ];
  checkpoint.nextGenome = 3;
  checkpoint.cohorts = [
    { ...checkpoint.cohorts[0], genomeId: 'hunter', count: 80, energy: 37 },
    { ...checkpoint.cohorts[0], genomeId: 'prey', count: 100, energy: 1 },
  ];
  const model = restoreLifeModel(world, checkpoint);
  model.advanceTo(4);
  const snapshot = model.observe();
  assert.ok(snapshot.stats.predationDeaths > 0);
  assert.ok(snapshot.stats.predationDeaths <= 80, 'at most one prey per hunter');
  assert.ok(snapshot.stats.predationDeaths <= 100, 'no duplicate prey kills');
  assert.equal(snapshot.counts.organisms, 180 + snapshot.stats.births - snapshot.stats.deaths);
  reconcile(snapshot);
});

test('river banks and channels have separate feeding even when both occupy one physical hex', () => {
  const world = fixture();
  world.hexes[6] = { ...world.hexes[6], waterType: 'none', waterLevel: 0,
    bedElevation: 0, runoff: 10, distanceToWater: 0 };
  assignClimate(world, 0);
  const checkpoint = createLifeModel(world, { seed: 'separate-river-feeding' });
  assert.equal(checkpoint.introduce(6).ok, true);
  const saved = checkpoint.exportState();
  saved.genomes.push({ id: 'land-grazer', genome: { ...founderGenome(), photosynthesis: 0,
    plantFeeding: 1, landAdaptation: 1 }, establishedOrder: 2, parentGenomeId: 'variant-1', originDay: 0 });
  saved.cohorts.push({ ...saved.cohorts[0], genomeId: 'land-grazer', habitat: 'land', count: 30, energy: 0 });
  const model = restoreLifeModel(world, saved);
  model.advanceTo(4);
  assert.equal(model.observe().stats.deaths, 30, 'bank grazers cannot eat channel producers');
  assert.ok(model.observe().species[0].variants.every((variant) => variant.id !== 'land-grazer'));
  reconcile(model.observe());
});

test('active movement commits once per biological turn and trunks suppress it without deleting the gene', () => {
  const world = fixture();
  const baseline = seed(world).exportState();
  baseline.genomes[0].genome.movement = 1;
  baseline.genomes[0].genome.photosynthesis = 0;
  baseline.cohorts[0].count = 1000;
  const source = baseline.cohorts[0].hexId;
  const model = restoreLifeModel(world, baseline);
  model.advanceTo(4);
  assert.ok(model.observe().stats.movements > 0);
  assert.equal(model.observe().stats.births, 0);
  assert.ok(model.observe().hexes.every((hex) => hex.hexId === source || world.hexes[source].neighbors.includes(hex.hexId)));
  const trunk = JSON.parse(JSON.stringify(baseline));
  trunk.genomes[0].genome.photosynthesis = 1;
  trunk.genomes[0].genome.trunk = 1;
  const stationary = restoreLifeModel(world, trunk);
  stationary.advanceTo(4);
  assert.equal(stationary.observe().stats.movements, 0);
  assert.equal(stationary.observe().species[0].variants[0].traits.find((trait) => trait.key === 'movement').value, 1);
});

function classifierFixture() {
  const hexes = Array.from({ length: 8 }, (_, id) => ({ id, waterType: 'sea', waterLevel: 0,
    bedElevation: -100, runoff: 0, downstream: null, permanentIce: false,
    neighbors: [id - 1, id + 1].filter((neighbor) => neighbor >= 0 && neighbor < 8) }));
  const genomes = new Map([
    ['a', { genome: founderGenome(), establishedOrder: 1 }],
    ['b', { genome: { ...founderGenome(), size: 6 }, establishedOrder: 2 }],
  ]);
  const cohorts = [
    { hexId: 0, habitat: 'water', speciesId: 's1', genomeId: 'a', groupId: 'group-1', count: 30 },
    { hexId: 7, habitat: 'water', speciesId: 's1', genomeId: 'b', groupId: 'group-2', count: 20 },
  ];
  const state = { groups: [{ id: 'group-1', speciesId: 's1', foundedDay: 0 },
    { id: 'group-2', speciesId: 's1', foundedDay: 1 }], timers: {}, nextGroup: 3 };
  return { hexes, genomes, cohorts, state };
}

test('species branching requires 100 consecutive disconnected, established, majority-divergent days', () => {
  const { hexes, genomes, cohorts, state } = classifierFixture();
  const branches = [];
  const branch = (parent) => { branches.push(parent); return 's2'; };
  for (let day = 1; day < 100; day += 1) {
    if (day === 50) cohorts[0].hexId = 1; // Entire component moves; carrier identity persists.
    classify(cohorts, genomes, hexes, state, day, branch);
  }
  assert.equal(branches.length, 0);
  assert.equal(Object.values(state.timers)[0], 99);
  classify(cohorts, genomes, hexes, state, 100, branch);
  assert.deepEqual(branches, ['s1']);
  assert.equal(cohorts[0].speciesId, 's1');
  assert.equal(cohorts[1].speciesId, 's2');
  // Recontact does not merge historical species labels.
  cohorts[1].hexId = 2;
  classify(cohorts, genomes, hexes, state, 101, branch);
  assert.equal(cohorts[1].speciesId, 's2');
});

test('a one-day reconnection resets separation timers; regions do not decide connectivity', () => {
  const { hexes, genomes, cohorts, state } = classifierFixture();
  const branch = () => { throw new Error('Premature speciation'); };
  for (let day = 1; day <= 60; day += 1) classify(cohorts, genomes, hexes, state, day, branch);
  assert.equal(Object.values(state.timers)[0], 60);
  hexes[0].neighbors.push(7); hexes[7].neighbors.push(0);
  hexes[0].regionId = 1; hexes[7].regionId = 999;
  classify(cohorts, genomes, hexes, state, 61, branch);
  assert.deepEqual(state.timers, {});
  hexes[0].neighbors.pop(); hexes[7].neighbors.pop();
  classify(cohorts, genomes, hexes, state, 62, branch);
  assert.equal(Object.values(state.timers)[0], 1);
});

test('species observations aggregate present gene carriers across every living variant', () => {
  const world = fixture();
  const checkpoint = seed(world).exportState();
  const original = checkpoint.genomes[0];
  checkpoint.genomes.push({ ...original, id: 'rare', genome: { ...original.genome, movement: 1, size: 4 }, establishedOrder: 2 });
  checkpoint.cohorts.push({ ...checkpoint.cohorts[0], genomeId: 'rare', count: 5 });
  const model = restoreLifeModel(world, checkpoint);
  const before = model.exportState();
  const snapshot = model.observe();
  const species = snapshot.species[0];
  assert.equal(species.population, 25);
  assert.equal(species.traits.find(trait => trait.key === 'movement').population, 5);
  assert.equal(species.traits.find(trait => trait.key === 'photosynthesis').population, 25);
  assert.equal(species.traits.find(trait => trait.key === 'size').expressions.length, 2);
  assert.ok(species.traits.every(trait => trait.expressions.every(expression => expression.active)));
  assert.equal(species.traits.some(trait => trait.key === 'animalFeeding'), false);
  assert.equal(snapshot.hexes[0].display.find(group => group.mobile).population, 5);
  assert.deepEqual(model.exportState(), before, 'inspection and names never consume biological randomness');
  assert.equal(restoreLifeModel(world, before).observe().species[0].name, species.name);
  assert.equal(snapshot.history.at(-1).extinctSpecies, 0);
});
