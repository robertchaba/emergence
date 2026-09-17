import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TRAITS, GENE_RULES, founderGenome, genomeKey, validateGenome, mutationOptions,
  mutateGenome, mutationProbability, recombineGenome, geneticDistance, deriveGenome, describeGenome,
} from '../../src/simulation/life/v2/genes/genome.js';
import { grazingAccess, preyEligible, captureProbability, establishmentProbability, competitionFitness }
  from '../../src/simulation/life/v2/ecology.js';
import { createRandom } from '../../src/simulation/life/v2/random.js';
import { allocateLight } from '../../src/simulation/life/v2/light.js';

const genome = changes => ({ ...founderGenome(), ...changes });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} differs from ${b}`);

test('V2 catalog validates complete genomes and keeps all eight original observation keys', () => {
  assert.equal(TRAITS.length, 20);
  assert.deepEqual(TRAITS.slice(0, 8).map(({ key }) => key), ['size', 'photosynthesis', 'trunk',
    'temperatureTolerance', 'landAdaptation', 'movement', 'plantFeeding', 'animalFeeding']);
  assert.ok(validateGenome(founderGenome()));
  assert.equal(validateGenome(null), false);
  assert.equal(validateGenome(genome({ movement: 5 })), false);
  assert.equal(validateGenome(genome({ eyesight: -1 })), false);
  assert.equal(validateGenome(genome({ armorType: 4 })), false);
  assert.equal(validateGenome(genome({ photosynthesis: 0, trunk: 1 })), false);
  assert.notEqual(genomeKey(founderGenome()), genomeKey(genome({ temperatureTolerance: 0 })));
  assert.equal(describeGenome(genome({ temperatureTolerance: 0 })).find(t => t.key === 'temperatureTolerance').active, true);
});

test('V2 mutation graph is reversible, retains dependent loci and separates categorical kinds', () => {
  assert.deepEqual(mutationOptions(founderGenome()).find(o => o.key === 'temperatureTolerance').values, [0]);
  assert.deepEqual(mutationOptions(genome({ temperatureTolerance: 0 })).find(o => o.key === 'temperatureTolerance').values, [-1, 1, null]);
  assert.equal(mutationOptions(genome({ trunk: 1 })).some(o => o.key === 'photosynthesis'), false);
  for (const key of ['skeleton', 'armorType']) {
    assert.deepEqual(mutationOptions(founderGenome()).find(o => o.key === key).values, [1, 2, 3]);
    assert.deepEqual(mutationOptions(genome({ [key]: 2 })).find(o => o.key === key).values, [0]);
    assert.equal(geneticDistance(genome({ [key]: 1 }), genome({ [key]: 3 })), 2);
  }
  const random = createRandom('v2-reversible-gene-walk');
  let parent = Object.freeze(founderGenome());
  const changed = new Set();
  for (let step = 0; step < 5000; step += 1) {
    const before = genomeKey(parent);
    const child = mutateGenome(parent, random.next);
    assert.ok(validateGenome(child));
    assert.equal(geneticDistance(parent, child), 1);
    assert.equal(geneticDistance(child, parent), 1);
    assert.equal(genomeKey(parent), before);
    for (const { key } of TRAITS) if (parent[key] !== child[key]) changed.add(key);
    const reverse = mutationOptions(child).find(o => o.values.some(value => genomeKey({ ...child, [o.key]: value }) === before));
    assert.ok(reverse, 'each mutation has a valid inverse');
    parent = Object.freeze(child);
  }
  assert.equal(changed.size, TRAITS.length);
});

test('pressure raises a bounded mutation rate while baseline drift and undirected changes remain', () => {
  assert.ok(mutationProbability(0) > 0 && mutationProbability(0) < 0.01);
  close(mutationProbability(0), GENE_RULES.mutationBaseline);
  close(mutationProbability(1), GENE_RULES.mutationBaseline * 8);
  assert.ok(mutationProbability(1) < 0.02);
  assert.ok(mutationProbability(0.8) > mutationProbability(0.2));
  close(mutationProbability(-100), mutationProbability(0));
  close(mutationProbability(100), mutationProbability(1));
  close(mutationProbability(Number.NaN), mutationProbability(0));
  const options = mutationOptions(founderGenome());
  assert.equal(options.find(o => o.key === 'eyesight').weight, GENE_RULES.eyesightMutationWeight);
  assert.ok(options.find(o => o.key === 'photosynthesis').values.includes(0), 'harmful acquisition loss is not protected');
});

test('sexual recombination joins parental traits, preserves linkage and never edits either parent', () => {
  const a = Object.freeze(genome({ size: 5, trunk: 3, movement: 1, eyesight: 3, sexualReproduction: 1 }));
  const b = Object.freeze(genome({ size: 3, photosynthesis: 0, plantFeeding: 1,
    movement: 4, skeleton: 3, thermalSensing: 2, sexualReproduction: 1 }));
  const random = createRandom('v2-recombination');
  const before = [genomeKey(a), genomeKey(b)];
  let combinedUsefulTraits = 0;
  for (let trial = 0; trial < 1000; trial += 1) {
    const child = recombineGenome(a, b, random.next);
    assert.ok(validateGenome(child));
    for (const { key } of TRAITS) assert.ok(child[key] === a[key] || child[key] === b[key]);
    assert.equal(child.trunk, child.photosynthesis ? 3 : 0);
    if (child.eyesight === 3 && child.movement === 4) combinedUsefulTraits += 1;
  }
  assert.ok(combinedUsefulTraits > 180 && combinedUsefulTraits < 320);
  assert.deepEqual([genomeKey(a), genomeKey(b)], before);
  const clonal = deriveGenome(genome({ sexualReproduction: 0 }));
  const sexual = deriveGenome(genome({ sexualReproduction: 1 }));
  assert.ok(sexual.upkeep > clonal.upkeep);
  assert.ok(sexual.reproductionCost > clonal.reproductionCost);
  const energyBudget = 2.4 * clonal.cells;
  const clonalReturn = 0.82 * (energyBudget - clonal.upkeep) / clonal.reproductionCost;
  const sexualReturn = (pressure) => (0.82 + 0.14 * pressure)
    * (energyBudget - sexual.upkeep) / sexual.reproductionCost;
  assert.ok(sexualReturn(0.5) > clonalReturn,
    'given a mate, pressure-dependent establishment can repay sex costs before recombination benefits');
  assert.ok(sexualReturn(0) < clonalReturn, 'stable conditions retain a real cost of sex');
});

test('every newly acquired capability costs maintenance and offspring construction', () => {
  const baseline = deriveGenome(founderGenome());
  for (const { key } of TRAITS.filter(t => !['size', 'photosynthesis'].includes(t.key))) {
    const changed = deriveGenome(genome({ [key]: key === 'temperatureTolerance' ? 0 : 1 }));
    assert.ok(changed.upkeep > baseline.upkeep, `${key} upkeep cost`);
    assert.ok(changed.reproductionCost > baseline.reproductionCost, `${key} construction cost`);
  }
  const small = deriveGenome(genome({ size: 2 }));
  const big = deriveGenome(genome({ size: 8 }));
  assert.ok(big.upkeep / big.cells > small.upkeep / small.cells);
  assert.ok(big.reproductionCost / big.cells > small.reproductionCost / small.cells);
  assert.ok(2.4 * baseline.cells >= baseline.upkeep + baseline.reproductionCost,
    'a fully productive founder can pay maintenance and one construction');
});

test('tall producers obtain more crowded light per cell and pay for their height', () => {
  const short = deriveGenome(genome({ size: 5 }));
  const tall = deriveGenome(genome({ size: 5, trunk: 4 }));
  const [shortLight, tallLight] = allocateLight([short, tall].map(g => ({ count: 100,
    cap: g.cells * g.photosynthesisShare, weight: g.cells * g.photosynthesisShare * g.landCompetition })), 2000);
  assert.ok(tallLight / tall.cells > shortLight / short.cells);
  assert.ok(tall.upkeep > short.upkeep);
  assert.ok(tall.reproductionCost > short.reproductionCost);
  close(100 * (shortLight + tallLight), 2000);
});

test('locomotion costs fertility, lowers photosynthetic economics and does not prohibit mixed life', () => {
  const still = deriveGenome(founderGenome());
  const moving = deriveGenome(genome({ movement: 3 }));
  assert.ok(moving.speed > still.speed);
  assert.ok(moving.upkeep > still.upkeep);
  assert.ok(moving.reproductionCost > still.reproductionCost);
  assert.ok(moving.photosynthesisShare > 0 && moving.photosynthesisShare < still.photosynthesisShare);
  const mixed = deriveGenome(genome({ movement: 2, plantFeeding: 1, animalFeeding: 1 }));
  assert.equal(mixed.role, 'mixed');
  assert.ok(mixed.photosynthesisShare > 0 && mixed.grazingShare > 0 && mixed.predationShare > 0);
  assert.ok(mixed.photosynthesisShare + mixed.grazingShare + mixed.predationShare < 1);
  assert.ok(deriveGenome(genome({ movement: 2, trunk: 2 })).speed > 0, 'walking woody plants remain possible');
});

test('grazing has a shared tissue fraction, size refuge, defenses and counteradaptations', () => {
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const plant = founderGenome();
  close(grazingAccess(grazer, plant, 0), 0.44);
  close(grazingAccess(grazer, plant, 1), 0.20);
  const defended = genome({ poison: 2, spines: 2 });
  assert.ok(grazingAccess(grazer, defended, 0) < grazingAccess(grazer, plant, 0));
  assert.ok(grazingAccess({ ...grazer, detoxification: 2, biteForce: 2 }, defended, 0)
    > grazingAccess(grazer, defended, 0));
  assert.equal(grazingAccess({ ...grazer, size: 1 }, genome({ size: 9, trunk: 8 }), 0), 0);
  assert.ok(grazingAccess({ ...grazer, size: 9 }, genome({ size: 9, trunk: 8 }), 0) > 0);
  assert.equal(grazingAccess(founderGenome(), plant, 0), 0);
});

test('predator and prey speed, sensing, defenses and handling exert opposing pressures', () => {
  const predator = genome({ size: 4, photosynthesis: 0, animalFeeding: 1, movement: 1 });
  const prey = genome({ size: 4, photosynthesis: 0, plantFeeding: 1, movement: 1 });
  const base = captureProbability(predator, prey);
  assert.ok(captureProbability({ ...predator, movement: 3 }, prey) > base);
  assert.ok(captureProbability(predator, { ...prey, movement: 3 }) < base);
  for (const key of ['eyesight', 'echolocation', 'thermalSensing']) {
    assert.ok(captureProbability({ ...predator, [key]: 2 }, prey) > base);
    assert.ok(captureProbability(predator, { ...prey, [key]: 2 }) < base);
  }
  const defended = { ...prey, armor: 2, spines: 2, poison: 2 };
  assert.ok(captureProbability(predator, defended) < base);
  assert.ok(captureProbability({ ...predator, biteForce: 2, detoxification: 2 }, defended)
    > captureProbability(predator, defended));
  assert.equal(preyEligible({ ...predator, size: 1, biteForce: 3 }, { ...prey, size: 10 }), false);
  assert.equal(captureProbability({ ...predator, size: 1 }, { ...prey, size: 10 }), 0);
  assert.equal(preyEligible(predator, founderGenome()), false, 'pure producers use grazing');
});

test('structural and armor alternatives exchange protection, weight and mobility', () => {
  const soft = deriveGenome(genome({ movement: 3 }));
  const hydro = deriveGenome(genome({ movement: 3, skeleton: 1 }));
  const exo = deriveGenome(genome({ movement: 3, skeleton: 2 }));
  const endo = deriveGenome(genome({ movement: 3, skeleton: 3 }));
  assert.ok(hydro.speed > soft.speed && hydro.upkeep > soft.upkeep);
  assert.ok(exo.defense > endo.defense);
  assert.ok(endo.speed > exo.speed && endo.upkeep > exo.upkeep);
  const shell = deriveGenome(genome({ movement: 3, armor: 2, armorType: 1 }));
  const plates = deriveGenome(genome({ movement: 3, armor: 2, armorType: 2 }));
  const scales = deriveGenome(genome({ movement: 3, armor: 2, armorType: 3 }));
  assert.ok(shell.defense > plates.defense && plates.defense > scales.defense);
  assert.ok(shell.speed < plates.speed && plates.speed < scales.speed);
  assert.ok(shell.upkeep > scales.upkeep);
});

test('flight has costly precursors, structural support and a body-mass penalty', () => {
  const precursor = deriveGenome(genome({ flight: 1 }));
  assert.equal(precursor.flightEfficiency, 0);
  assert.ok(precursor.upkeep > deriveGenome(founderGenome()).upkeep);
  const small = deriveGenome(genome({ size: 2, movement: 2, flight: 1, skeleton: 2 }));
  const big = deriveGenome(genome({ size: 8, movement: 2, flight: 1, skeleton: 2 }));
  assert.ok(small.flightEfficiency > big.flightEfficiency);
  assert.ok(small.flightEfficiency > deriveGenome(genome({ size: 2, movement: 2, flight: 1 })).flightEfficiency);
});

test('crowded incumbent niches favor a clear local advantage while retaining rare neutral establishment', () => {
  const candidate = deriveGenome(founderGenome());
  close(establishmentProbability(candidate), 1);
  const resident = competitionFitness(candidate);
  close(establishmentProbability(candidate, { occupancy: 1, competition: resident }), 0.06);
  const advantage = { ...candidate, landCompetition: candidate.landCompetition * 1.5 };
  assert.ok(establishmentProbability(advantage, { occupancy: 1, competition: resident }) > 0.7);
  assert.ok(establishmentProbability(candidate, { occupancy: 0.2, competition: resident }) > 0.8);
  const small = deriveGenome(genome({ size: 1 }));
  assert.ok(small.landCompetition < candidate.landCompetition);
  assert.ok(competitionFitness(small) > resident, 'growth economy contributes to local advantage');
  assert.ok(establishmentProbability(small, { occupancy: 1, competition: resident }) > 0.1);
  const tall = deriveGenome(genome({ trunk: 4 }));
  assert.ok(competitionFitness(tall, 'water') < competitionFitness(candidate, 'water'),
    'a costly trunk has no light-priority benefit under water');
  close(establishmentProbability(candidate, { occupancy: 1, habitat: 'water',
    competition: competitionFitness(candidate, 'water') }), 0.06);
});
