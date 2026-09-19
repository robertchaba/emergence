import assert from 'node:assert/strict';
import test from 'node:test';
import { TRAITS, founderGenome, validateGenome, candidateMutations, geneticDistance,
  genomeKey, deriveGenome, describeGenome } from '../../src/simulation/life/v3/genes/genome.js';
import { founderForSite, environmentalPerformance, evaluateCommunity, scoreSpecies,
  grazingAccess, captureProbability, ECOLOGY_RULES } from '../../src/simulation/life/v3/ecology.js';

const genome = changes => ({ ...founderGenome(), landAdaptation: 2, ...changes });
const land = changes => ({ id: 0, waterType: 'none', bedElevation: 500, waterLevel: 0,
  runoff: 0, temperature: 20, humidity: 0.7, permanentIce: false, neighbors: [], ...changes });
const random = seed => { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };

test('V3 mutation candidates change exactly one reversible locus, including new tolerances', () => {
  assert.equal(TRAITS.length, 22);
  assert.equal(validateGenome(genome()), true);
  assert.equal(validateGenome(genome({ photosynthesis: 0, trunk: 1 })), false);
  assert.equal(validateGenome(genome({ elevationTolerance: 5 })), false);
  let current = genome();
  const next = random(83);
  const touched = new Set();
  for (let turn = 0; turn < 1800; turn += 1) {
    const candidates = candidateMutations(current);
    const candidate = candidates[Math.floor(next() * candidates.length)];
    assert.ok(validateGenome(candidate.genome));
    assert.equal(geneticDistance(current, candidate.genome), 1);
    assert.equal(TRAITS.filter(({ key }) => current[key] !== candidate.genome[key]).length, 1);
    assert.ok(candidateMutations(candidate.genome).some(reverse => genomeKey(reverse.genome) === genomeKey(current)));
    touched.add(candidate.key);
    current = candidate.genome;
  }
  assert.equal(touched.size, 22);
  assert.ok(describeGenome(genome({ temperatureTolerance: 0 })).find(trait => trait.key === 'temperatureTolerance').active);
});

test('V3 highland and deep-water specialization have independent benefits and real lowland costs', () => {
  const lowland = genome();
  const highland = genome({ elevationTolerance: 3 });
  const lowHex = land();
  const highHex = land({ bedElevation: 4800 });
  assert.ok(environmentalPerformance(highland, highHex, 'land') > environmentalPerformance(lowland, highHex, 'land') * 5);
  assert.ok(scoreSpecies(lowland, lowHex, 'land').score > scoreSpecies(highland, lowHex, 'land').score);
  assert.deepEqual(deriveGenome(lowland).temperatureRange, deriveGenome(highland).temperatureRange);
  const shallow = genome({ landAdaptation: 0 });
  const deep = genome({ landAdaptation: 0, depthTolerance: 3 });
  const water = land({ waterType: 'sea', bedElevation: -1000, waterLevel: 0 });
  assert.ok(environmentalPerformance(deep, water, 'water') > environmentalPerformance(shallow, water, 'water') * 5);
  assert.ok(deriveGenome(deep).upkeep > deriveGenome(shallow).upkeep);
  assert.ok(deriveGenome(highland).reproductionCost > deriveGenome(lowland).reproductionCost);
});

test('V3 every additional capability has upkeep and construction costs', () => {
  const original = founderGenome();
  const baseline = deriveGenome(original);
  for (const trait of TRAITS.filter(({ key }) => !['size', 'photosynthesis'].includes(key))) {
    const added = deriveGenome({ ...original, [trait.key]: trait.key === 'temperatureTolerance' ? 0 : 1 });
    assert.ok(added.upkeep > baseline.upkeep, `${trait.key} upkeep`);
    assert.ok(added.reproductionCost > baseline.reproductionCost, `${trait.key} construction`);
  }
});

test('V3 penalizes mixed feeding most strongly for photosynthetic grazing, without forbidding combinations', () => {
  const hex = land({ waterType: 'sea', bedElevation: -5, waterLevel: 0 });
  const producer = genome({ size: 1, landAdaptation: 0 });
  const prey = { ...producer, photosynthesis: 0, plantFeeding: 1 };
  for (const [photosynthesis, plantFeeding, animalFeeding] of [
    [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ]) {
    const candidate = { ...producer, photosynthesis, plantFeeding, animalFeeding,
      movement: animalFeeding ? 3 : 0, eyesight: animalFeeding ? 2 : 0 };
    const systems = photosynthesis + plantFeeding + animalFeeding;
    const photoGrazer = photosynthesis && plantFeeding;
    assert.ok(validateGenome(candidate), 'all acquisition combinations remain legal');
    const community = [{ speciesId: 'plants', genome: producer, population: 60 },
      { speciesId: 'prey', genome: prey, population: animalFeeding ? 10 : 0 }];
    const current = scoreSpecies(candidate, hex, 'water', community);
    assert.ok(current.score > 0, `a resource-rich niche can support ${photosynthesis}/${plantFeeding}/${animalFeeding}`);
    // Revision 2 counterfactual: identical resource access, body and community,
    // without revision 3's additional maintenance/construction charges.
    const derived = deriveGenome(candidate);
    const charge = 0.06 * (systems - 1) + 0.16 * photoGrazer;
    const previous = scoreSpecies(candidate, hex, 'water', community, { derived: { ...derived,
      upkeep: derived.upkeep - derived.cells * charge,
      reproductionCost: derived.reproductionCost - derived.cells * (1.3 * charge + 0.30 * (systems - 1) + 0.30 * photoGrazer),
    } });
    assert.equal(current.food, previous.food, 'penalties cannot manufacture or remove a resource pool');
    assert.equal(current.production, previous.production);
    if (systems === 1) assert.deepEqual(current, previous, 'single-system feeders retain revision 2 behavior');
    else {
      assert.ok(current.score < previous.score * (photoGrazer ? 0.4 : 0.8), 'mixed strategies earn a substantially smaller surplus');
      assert.ok(scoreSpecies(candidate, hex, 'water').score < 0, 'maintaining unused feeding machinery is not free');
    }
  }
});

test('V3 founders condition their environment and add deterministic viable random traits', () => {
  const hex = land({ bedElevation: 4500, temperature: 2 });
  const first = founderForSite(hex, 'land', random(5));
  assert.deepEqual(first, founderForSite(hex, 'land', random(5)));
  assert.equal(first.photosynthesis, 1);
  assert.ok(first.elevationTolerance >= 2);
  assert.ok(first.temperatureTolerance < 0);
  assert.ok(scoreSpecies(first, hex, 'land').score > 0);
  const genomes = new Set(Array.from({ length: 25 }, (_, seed) => genomeKey(founderForSite(hex, 'land', random(seed + 1)))));
  assert.ok(genomes.size >= 10, 'conditioned founders retain seeded differences');
});

test('V3 finite community resources respond to competitors and transfer food with conversion losses', () => {
  const hex = land();
  const plant = genome();
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const residents = [{ speciesId: 'p', genome: plant, population: 500, habitat: 'land' }];
  assert.ok(scoreSpecies(plant, hex, 'land').score > scoreSpecies(plant, hex, 'land', residents).score);
  assert.equal(scoreSpecies(grazer, hex, 'land').food, 0);
  assert.ok(scoreSpecies(grazer, hex, 'land', residents).food > 0);
  const community = [...residents, { speciesId: 'g', genome: grazer, population: 40, habitat: 'land' },
    { speciesId: 'g2', genome: grazer, population: 40, habitat: 'land' }];
  const state = structuredClone(community);
  const outputs = evaluateCommunity(hex, 'land', community);
  const prepared = community.map(row => ({ ...row, derived: deriveGenome(row.genome),
    environment: environmentalPerformance(row.genome, hex, 'land') }));
  assert.deepEqual(evaluateCommunity(hex, 'land', prepared), outputs,
    'reuse of derived traits and same-day environmental factors preserves results');
  const gross = outputs.reduce((sum, output, index) => sum + output.grossProduction * community[index].population, 0);
  const remaining = outputs.reduce((sum, output, index) => sum + output.production * community[index].population, 0);
  const food = outputs.reduce((sum, output, index) => sum + output.food * community[index].population, 0);
  assert.ok(gross <= ECOLOGY_RULES.lightBudget + 1e-8);
  assert.ok(Math.abs(food - (gross - remaining) * ECOLOGY_RULES.conversion) < 1e-8);
  assert.ok(gross - remaining <= gross * ECOLOGY_RULES.grazingFraction + 1e-8);
  assert.deepEqual(community, state);
  const mixed = genome({ plantFeeding: 1 });
  assert.ok(scoreSpecies(mixed, hex, 'land', residents, { excludeSpeciesId: 'p', independentLineage: true }).food > 0,
    'a hypothetical new consumer may exploit the unchanged producer parent');
  assert.equal(scoreSpecies(mixed, hex, 'land', residents, { excludeSpeciesId: 'p' }).food, 0,
    'ordinary replacement cannot invent a self-feeding advantage');
});

test('V3 splitting vulnerable grazers into more species cannot unlock protected tissue', () => {
  const plant = { speciesId: 'plant', genome: genome({ poison: 3, spines: 3 }), population: 200, habitat: 'land' };
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const one = [plant, { speciesId: 'one', genome: grazer, population: 1000, habitat: 'land' }];
  const many = [plant, ...Array.from({ length: 10 }, (_, index) => ({
    speciesId: `split-${index}`, genome: grazer, population: 100, habitat: 'land',
  }))];
  const singleOutput = evaluateCommunity(land(), 'land', one);
  const splitOutput = evaluateCommunity(land(), 'land', many);
  const intake = (output, rows) => output.reduce((sum, row, index) => sum + row.food * rows[index].population, 0);
  assert.ok(Math.abs(intake(singleOutput, one) - intake(splitOutput, many)) < 1e-8);
  const accessible = singleOutput[0].grossProduction * plant.population * ECOLOGY_RULES.grazingFraction
    * grazingAccess(grazer, plant.genome) * ECOLOGY_RULES.conversion;
  assert.ok(intake(splitOutput, many) <= accessible + 1e-8);
});

test('V3 defenses and sensing act through paid predator/prey interactions', () => {
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const predator = genome({ photosynthesis: 0, animalFeeding: 1 });
  assert.ok(grazingAccess(grazer, genome({ poison: 3 })) < grazingAccess(grazer, genome()));
  assert.ok(grazingAccess({ ...grazer, detoxification: 3 }, genome({ poison: 3 })) > grazingAccess(grazer, genome({ poison: 3 })));
  assert.ok(captureProbability({ ...predator, eyesight: 3 }, grazer) > captureProbability(predator, grazer));
  assert.ok(captureProbability(predator, { ...grazer, armor: 3 }) < captureProbability(predator, grazer));
  const rows = [{ speciesId: 'g', genome: grazer, population: 100, habitat: 'land' },
    { speciesId: 'a', genome: predator, population: 500, habitat: 'land' },
    { speciesId: 'b', genome: predator, population: 500, habitat: 'land' }];
  const outputs = evaluateCommunity(land(), 'land', rows);
  assert.ok(outputs[0].predationLoss > 0);
  assert.ok(outputs.every(output => output.predationLoss <= ECOLOGY_RULES.preyFraction + 1e-8));
});

test('V3 movement earns its upkeep through hunting only when accessible prey exists', () => {
  const producer = genome();
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1 });
  const hunter = genome({ photosynthesis: 0, animalFeeding: 1 });
  const movingHunter = { ...hunter, movement: 1 };
  const community = [{ speciesId: 'plant', genome: producer, population: 100 },
    { speciesId: 'prey', genome: grazer, population: 60 }];
  const stationary = scoreSpecies(hunter, land(), 'land', community);
  const moving = scoreSpecies(movingHunter, land(), 'land', community);
  assert.ok(stationary.score > 0, 'a rare carnivore can live on actual consumer prey');
  assert.ok(moving.score > stationary.score + 0.005, 'pursuit can fund a selectable movement advantage');
  assert.ok(deriveGenome(movingHunter).upkeep > deriveGenome(hunter).upkeep);
  assert.ok(deriveGenome(movingHunter).reproductionCost > deriveGenome(hunter).reproductionCost);
  for (const genome of [hunter, movingHunter]) {
    const noPrey = scoreSpecies(genome, land(), 'land', community.slice(0, 1));
    assert.equal(noPrey.predationFood, 0, 'producers alone cannot feed a carnivore');
    assert.ok(noPrey.score < 0);
  }
  assert.ok(captureProbability(hunter, { ...grazer, movement: 1 }) < captureProbability(hunter, grazer),
    'movement also improves prey escape');
});

test('V3 splitting the same hunting effort cannot increase target-prey kills or transferred food', () => {
  const preyGenome = genome({ photosynthesis: 0, plantFeeding: 1 });
  const predatorGenome = genome({ photosynthesis: 0, animalFeeding: 1 });
  const prey = { speciesId: 'prey', genome: preyGenome, population: 1000, habitat: 'land' };
  const single = [prey, { speciesId: 'hunter', genome: predatorGenome, population: 100, habitat: 'land' }];
  const split = [prey, ...Array.from({ length: 10 }, (_, index) => ({
    speciesId: `hunter-${index}`, genome: predatorGenome, population: 10, habitat: 'land',
  }))];
  const one = evaluateCommunity(land(), 'land', single);
  const many = evaluateCommunity(land(), 'land', split);
  assert.ok(one[0].predationLoss > 0);
  assert.ok(Math.abs(one[0].predationLoss - many[0].predationLoss) < 1e-12);
  const targetFood = (outputs, rows) => {
    const totalFood = outputs.reduce((sum, output, index) => sum + output.predationFood * rows[index].population, 0);
    // Distinct predator species may also hunt one another. Remove those real
    // extra prey-source transfers to compare only food from the fixed target.
    const predatorTissue = deriveGenome(predatorGenome).cells * 1.4;
    const hunterFood = outputs.slice(1).reduce((sum, output, index) => sum
      + output.predationLoss * rows[index + 1].population * predatorTissue * ECOLOGY_RULES.conversion, 0);
    return totalFood - hunterFood;
  };
  assert.ok(Math.abs(targetFood(one, single) - targetFood(many, split)) < 1e-8);
  const targetTissue = deriveGenome(preyGenome).cells * 1.4;
  assert.ok(Math.abs(targetFood(many, split)
    - many[0].predationLoss * prey.population * targetTissue * ECOLOGY_RULES.conversion) < 1e-8);
});

test('V3 splitting identical prey sources does not offer free repeated hunting effort', () => {
  const preyGenome = genome({ photosynthesis: 0, plantFeeding: 1 });
  const predatorGenome = genome({ photosynthesis: 0, animalFeeding: 1 });
  const predator = { speciesId: 'hunter', genome: predatorGenome, population: 100, habitat: 'land' };
  const single = [{ speciesId: 'prey', genome: preyGenome, population: 1000, habitat: 'land' }, predator];
  const split = [...Array.from({ length: 10 }, (_, index) => ({
    speciesId: `prey-${index}`, genome: preyGenome, population: 100, habitat: 'land',
  })), predator];
  const one = evaluateCommunity(land(), 'land', single);
  const many = evaluateCommunity(land(), 'land', split);
  const kills = (outputs, rows) => outputs.reduce((sum, output, index) => sum + output.predationLoss * rows[index].population, 0);
  assert.ok(kills(one, single) > 0);
  assert.ok(Math.abs(kills(one, single) - kills(many, split)) < 1e-8);
  assert.ok(Math.abs(one.at(-1).predationFood - many.at(-1).predationFood) < 1e-8);
});
