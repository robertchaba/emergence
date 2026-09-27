import assert from 'node:assert/strict';
import test from 'node:test';
import { founderGenome, deriveGenome } from '../../src/simulation/life/v5/genes/genome.js';
import { ECOLOGY_RULES, evaluateCommunity, scoreSpecies, captureProbability }
  from '../../src/simulation/life/v5/ecology.js';

const genome = changes => ({ ...founderGenome(), landAdaptation: 2,
  photosynthesis: 0, animalFeeding: 1, movement: 1, ...changes });
const land = { id: 0, waterType: 'none', bedElevation: 0, waterLevel: 0,
  runoff: 0, temperature: 20, humidity: 0.8, permanentIce: false };
const water = { ...land, waterType: 'sea', bedElevation: -3 };
const prey = (changes = {}, population = 10000) => ({ speciesId: 'prey', population,
  genome: genome({ size: 1, animalFeeding: 0, plantFeeding: 1, ...changes }) });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${actual} versus ${expected}`);

test('V5 modest hunting help improves actual intake without supplying food or bypassing prey defenses', () => {
  const hunter = genome();
  const derived = deriveGenome(hunter);
  const food = [prey({ size: 3, movement: 2 })];
  const before = scoreSpecies(hunter, land, 'land', food, { derived: {
    ...derived, predationShare: derived.predationShare * 3.6 / ECOLOGY_RULES.huntingEffort,
  } });
  const after = scoreSpecies(hunter, land, 'land', food);
  assert.ok(after.score > before.score + 0.005);
  close(after.food / before.food, 4.2 / 3.6);
  const empty = scoreSpecies(hunter, land, 'land');
  assert.equal(empty.food, 0);
  assert.ok(empty.score < 0);
  assert.equal(scoreSpecies(hunter, land, 'land', [prey({ size: 10 })]).predationFood, 0);
  assert.ok(captureProbability(hunter, prey({ armor: 3, spines: 3 }).genome)
    < captureProbability(hunter, prey().genome));
  const defended = scoreSpecies(hunter, land, 'land', [prey({ size: 3, movement: 2, poison: 3, armor: 3 })]);
  assert.ok(defended.predationFood < after.predationFood);
  assert.ok(defended.score < after.score);
});

test('V5 streamlining is a paid, selectable aid to large aquatic hunters with no land or stationary benefit', () => {
  const hunter = genome({ size: 8, landAdaptation: 0 });
  const community = [prey({ landAdaptation: 0 })];
  const ordinary = scoreSpecies(hunter, water, 'water', community);
  const streamlined = scoreSpecies({ ...hunter, streamlining: 1 }, water, 'water', community);
  assert.ok(streamlined.score > ordinary.score + 0.005);
  assert.ok(streamlined.predationFood > ordinary.predationFood);
  for (const [hex, habitat, changes] of [[land, 'land', { landAdaptation: 2 }],
    [water, 'water', { movement: 0 }], [water, 'water', { size: 1 }]]) {
    const plain = { ...hunter, ...changes };
    const before = scoreSpecies(plain, hex, habitat, community);
    const after = scoreSpecies({ ...plain, streamlining: 3 }, hex, habitat, community);
    close(after.predationFood, before.predationFood);
    assert.ok(after.score < before.score, 'unused streamlining still pays its costs');
  }
  const grazing = { ...hunter, animalFeeding: 0, plantFeeding: 1 };
  const plants = [{ speciesId: 'plants', population: 10000,
    genome: { ...founderGenome(), size: 1 } }];
  close(scoreSpecies(grazing, water, 'water', plants).grazingFood,
    scoreSpecies({ ...grazing, streamlining: 3 }, water, 'water', plants).grazingFood);
});

test('V5 animal filtering can reward larger bodies in prey-rich water while ordinary hunting still pays for size', () => {
  const community = [prey({ landAdaptation: 0 }, 100000)];
  const score = (size, changes = {}) => scoreSpecies(genome({ size, landAdaptation: 0, ...changes }),
    water, 'water', community);
  assert.ok(score(10).score < score(7).score, 'ordinary small-prey hunting does not universally favor giants');
  const small = score(7, { filterFeeding: 3, streamlining: 3 });
  const large = score(8, { filterFeeding: 3, streamlining: 3 });
  assert.ok(large.score > small.score + 0.005, 'body growth can become a selectable aquatic strategy');
  assert.ok(score(10, { filterFeeding: 3, streamlining: 3 }).score > large.score);
  assert.ok(score(7, { filterFeeding: 1 }).score > score(7).score + 0.005,
    'one filtering step provides a path into the specialization');
  const hunter = genome({ size: 10, landAdaptation: 0, filterFeeding: 3, streamlining: 3 });
  const scarce = scoreSpecies(hunter, water, 'water', [prey({ landAdaptation: 0 }, 10)]);
  assert.ok(scarce.score < 0, 'large bodies cannot live on a scarce prey supply');
  assert.equal(scoreSpecies(hunter, water, 'water').food, 0);
});

test('V5 animal filter specialization requires swimming and smaller size-1–3 animal prey', () => {
  for (const [hex, habitat, hunterChanges, preyChanges] of [
    [water, 'water', {}, { size: 4 }], [water, 'water', { size: 3 }, { size: 3 }],
    [water, 'water', { movement: 0 }, {}], [land, 'land', {}, {}],
  ]) {
    const hunter = genome({ size: 8, ...hunterChanges });
    const community = [prey(preyChanges)];
    const plain = scoreSpecies(hunter, hex, habitat, community);
    const filter = scoreSpecies({ ...hunter, filterFeeding: 3 }, hex, habitat, community);
    assert.ok(filter.predationFood < plain.predationFood, 'mismatched filtering reduces collection');
    assert.ok(filter.score < plain.score);
  }
  const hunter = genome({ size: 8, filterFeeding: 3, streamlining: 3 });
  const plants = [{ ...prey(), genome: { ...founderGenome(), size: 1 } }];
  assert.equal(scoreSpecies(hunter, water, 'water', plants).food, 0,
    'animal feeding cannot filter plants without its own plant-feeding system');
  const same = [{ speciesId: 'self', genome: hunter, population: 10000 }];
  assert.equal(scoreSpecies(hunter, water, 'water', same, { excludeSpeciesId: 'self' }).food, 0);
});

test('V5 aquatic hunters share finite prey tissue, keep defenses, and spend effort once across prey labels', () => {
  const hunter = genome({ size: 8, filterFeeding: 3, streamlining: 3, landAdaptation: 0 });
  for (const population of [1, 10000]) {
    const rows = [prey({ landAdaptation: 0 }), { speciesId: 'hunter', genome: hunter, population }];
    const sourceSplit = [...Array.from({ length: 10 }, (_, index) => ({
      ...rows[0], speciesId: `prey-${index}`, population: rows[0].population / 10,
    })), rows[1]];
    const hunterSplit = [rows[0], ...Array.from({ length: 10 }, (_, index) => ({
      ...rows[1], speciesId: `hunter-${index}`, population: population / 10,
    }))];
    const whole = evaluateCommunity(water, 'water', rows);
    const sources = evaluateCommunity(water, 'water', sourceSplit);
    const hunters = evaluateCommunity(water, 'water', hunterSplit);
    // Size-8 hunters cannot filter one another, but they can hunt one another.
    // Compare the shared size-1 prey's losses, not food from those added links.
    close(sources.at(-1).predationFood, whole[1].predationFood);
    close(hunters[0].predationLoss, whole[0].predationLoss);
    const tissue = deriveGenome(rows[0].genome).cells * 1.4;
    close(whole[1].predationFood * population,
      whole[0].predationLoss * rows[0].population * tissue * ECOLOGY_RULES.conversion);
    assert.ok(whole[0].predationLoss <= ECOLOGY_RULES.preyFraction + 1e-8);
    assert.ok(whole[0].predationLoss > 0);
  }
  const ordinary = [prey(), { speciesId: 'hunter', genome: hunter, population: 1 }];
  const defended = [{ ...ordinary[0], genome: { ...ordinary[0].genome, poison: 3, armor: 3 } }, ordinary[1]];
  assert.ok(evaluateCommunity(water, 'water', defended)[1].predationFood
    < evaluateCommunity(water, 'water', ordinary)[1].predationFood);
});

test('V5 real hunting pressure makes paid prey defenses selectable without rewarding them when hunters are absent', () => {
  const parent = genome({ size: 2, landAdaptation: 0, plantFeeding: 1, animalFeeding: 0 });
  const community = [{ speciesId: 'plants', genome: { ...founderGenome(), size: 1 }, population: 3000 },
    { speciesId: 'prey', genome: parent, population: 100 },
    { speciesId: 'hunter', genome: genome({ size: 2, landAdaptation: 0 }), population: 5 }];
  const score = (changes, rows) => scoreSpecies({ ...parent, ...changes }, water, 'water', rows,
    { excludeSpeciesId: 'prey' });
  const exposed = score({}, community);
  const safeRows = community.slice(0, 2);
  const safe = score({}, safeRows);
  for (const key of ['camouflage', 'herding', 'poison']) {
    const defended = score({ [key]: 1 }, community);
    assert.ok(defended.predationLoss < exposed.predationLoss);
    assert.ok(defended.score > exposed.score + 0.005, `${key} can answer actual hunting pressure`);
    assert.ok(score({ [key]: 1 }, safeRows).score < safe.score, `${key} costs energy without predators`);
  }
});
